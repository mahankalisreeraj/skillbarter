from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..serializers import UserPublicSerializer

User = get_user_model()

class PresenceViewSet(viewsets.ViewSet):
    """
    ViewSet for handling user presence via HTTP polling.
    Replaces PresenceConsumer WebSocket logic.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def heartbeat(self, request):
        """
        Update the current user's last_seen timestamp.
        Acts as a 'keep-alive' for presence.
        """
        user = request.user
        user.last_seen = timezone.now()
        user.is_online = True
        user.save(update_fields=['last_seen', 'is_online'])
        
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'])
    def online(self, request):
        """
        Fetch all users who have been seen within the last 60 seconds.
        Includes any active sessions where a peer is waiting.
        """
        from ..models import Session
        from django.db import models
        
        # Update current user's heartbeat
        user = request.user
        user.last_seen = timezone.now()
        user.is_online = True
        user.save(update_fields=['last_seen', 'is_online'])

        threshold = timezone.now() - timedelta(seconds=60)
        room_threshold = timezone.now() - timedelta(seconds=5)
        
        # Mark inactive users as offline
        User.objects.filter(is_online=True, last_seen__lt=threshold).update(is_online=False)
        
        online_users = User.objects.filter(is_online=True)
        serializer = UserPublicSerializer(online_users, many=True)

        # Check for sessions where peer is waiting but I am not in the room
        waiting_sessions = []
        sessions = Session.objects.filter(
            (models.Q(user1=user) | models.Q(user2=user)),
            is_active=True
        )
        
        for s in sessions:
            if user == s.user1:
                is_peer_in_room = s.user2_last_room_presence and s.user2_last_room_presence > room_threshold
                is_me_in_room = s.user1_last_room_presence and s.user1_last_room_presence > room_threshold
                peer_name = s.user2.name
            else:
                is_peer_in_room = s.user1_last_room_presence and s.user1_last_room_presence > room_threshold
                is_me_in_room = s.user2_last_room_presence and s.user2_last_room_presence > room_threshold
                peer_name = s.user1.name
                
            if is_peer_in_room and not is_me_in_room:
                waiting_sessions.append({
                    'id': s.id,
                    'peer_name': peer_name
                })
        
        return Response({
            'users': serializer.data,
            'waiting_sessions': waiting_sessions
        })

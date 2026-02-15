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
        """
        # Update current user's heartbeat while they are fetching online users
        request.user.last_seen = timezone.now()
        request.user.is_online = True
        request.user.save(update_fields=['last_seen', 'is_online'])

        threshold = timezone.now() - timedelta(seconds=60)
        
        # Consider users offline if they haven't been seen recently
        # First, mark inactive users as offline in the DB (batch update)
        User.objects.filter(is_online=True, last_seen__lt=threshold).update(is_online=False)
        
        online_users = User.objects.filter(is_online=True)
        serializer = UserPublicSerializer(online_users, many=True)
        
        return Response({
            'users': serializer.data
        })

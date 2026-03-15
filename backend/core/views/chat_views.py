from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from ..models.session import Session
from ..models.chat import ChatMessage
from ..serializers.chat import ChatMessageSerializer

class ChatViewSet(viewsets.ViewSet):
    """
    ViewSet for handling chat messaging via HTTP polling.
    Replaces ChatConsumer WebSocket logic.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """
        Poll for new messages in a session.
        Usage: GET /api/chat/<session_id>/messages/?since_id=<id>
        """
        session = get_object_or_404(Session, pk=pk)
        
        # Security: Verify user is participant
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)
            
        since_id = request.query_params.get('since_id')
        messages = ChatMessage.objects.filter(session=session)
        
        if since_id:
            messages = messages.filter(id__gt=since_id)
        else:
            # If no id provided, return last 50
            messages = messages.order_by('-timestamp')[:50]
            # Reverse to maintain chronological order for initial load
            messages = list(messages)[::-1]
            
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='send')
    def send_message(self, request, pk=None):
        """
        Send a message or a file to a session.
        Usage: POST /api/chat/<session_id>/send/
        """
        session = get_object_or_404(Session, pk=pk)
        
        # Security: Verify user is participant
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)
            
        message_text = request.data.get('message', '').strip()
        uploaded_file = request.FILES.get('file')
        
        if not message_text and not uploaded_file:
            return Response({'error': 'Message content or file required'}, status=status.HTTP_400_BAD_REQUEST)
        
        file_name = None
        file_size = None
        
        if uploaded_file:
            # Enforce 5MB limit
            MAX_SIZE = 5 * 1024 * 1024
            if uploaded_file.size > MAX_SIZE:
                return Response({'error': 'File too large (max 5MB)'}, status=status.HTTP_400_BAD_REQUEST)
            
            file_name = uploaded_file.name
            file_size = uploaded_file.size

        msg = ChatMessage.objects.create(
            session=session,
            sender=request.user,
            message=message_text,
            file=uploaded_file,
            file_name=file_name,
            file_size=file_size
        )
        
        serializer = ChatMessageSerializer(msg, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

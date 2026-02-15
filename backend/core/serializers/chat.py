from rest_framework import serializers
from ..models.chat import ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages."""
    
    sender_name = serializers.CharField(source='sender.name', read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'sender',
            'sender_name',
            'message',
            'timestamp',
        ]
        read_only_fields = ['id', 'timestamp']

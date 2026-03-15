from rest_framework import serializers
from ..models.chat import ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages."""
    
    sender_name = serializers.CharField(source='sender.name', read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'sender',
            'sender_name',
            'message',
            'file',
            'file_name',
            'file_size',
            'file_url',
            'timestamp',
        ]
        read_only_fields = ['id', 'timestamp', 'file_name', 'file_size', 'file_url']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

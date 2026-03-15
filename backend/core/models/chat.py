from django.db import models
from django.conf import settings

class ChatMessage(models.Model):
    """
    Stores chat messages for a session.
    """
    session = models.ForeignKey(
        'Session',
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    message = models.TextField(blank=True)
    file = models.FileField(upload_to='chat_files/', blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.BigIntegerField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']
        
    def __str__(self):
        if self.file:
            return f"{self.sender.name} sent a file: {self.file_name}"
        return f"{self.sender.name}: {self.message[:20]}..."

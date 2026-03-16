from django.db import models
from django.conf import settings
from django.utils import timezone


class Session(models.Model):
    """
    Session model connecting two users for a learning session.
    Tracks start/end time and overall session state.
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('rejected', 'Rejected'),
    ]

    user1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions_as_learner' # user1 is Learner
    )
    user2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions_as_teacher' # user2 is Teacher
    )
    learning_request = models.ForeignKey(
        'LearningRequestPost',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    # Scheduling fields
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    scheduled_time = models.DateTimeField(null=True, blank=True)
    proposed_time = models.DateTimeField(null=True, blank=True)
    proposer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='proposed_sessions'
    )
    room_id = models.CharField(max_length=100, blank=True, unique=True, null=True)

    # Lobby Presence Tracking
    user1_lobby_joined_at = models.DateTimeField(null=True, blank=True)
    user2_lobby_joined_at = models.DateTimeField(null=True, blank=True)
    
    # Collaborative data for polling sync
    whiteboard_data = models.JSONField(null=True, blank=True)
    code_data = models.JSONField(null=True, blank=True)
    # FIX: Use a manually-updated timestamp (not auto_now) so presence pings
    # don't falsely update last_sync_time and break the peer sync check.
    last_sync_time = models.DateTimeField(null=True, blank=True)
    last_sync_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='synced_sessions'
    )
    # Monotonically increasing version counter for whiteboard/code changes
    sync_version = models.PositiveIntegerField(default=0)
    
    # WebRTC Signaling via polling
    signal_data = models.JSONField(null=True, blank=True)
    signal_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_signals'
    )
    # FIX: Also manually updated so presence pings don't reset signal detection
    signal_timestamp = models.DateTimeField(null=True, blank=True)
    
    # Room Presence Tracking (Polling-based)
    user1_last_room_presence = models.DateTimeField(null=True, blank=True)
    user2_last_room_presence = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'session'
        verbose_name_plural = 'sessions'
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['is_active', '-start_time']),
        ]
    
    def __str__(self):
        return f"Session: {self.user1.name} <-> {self.user2.name}"
    
    @property
    def total_duration(self):
        """Calculate total session duration in seconds."""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return (timezone.now() - self.start_time).total_seconds()
    
    def get_teaching_time(self, user):
        """Get total teaching time for a specific user in this session."""
        # Use prefetched data if available to avoid N+1 queries
        if hasattr(self, '_prefetched_objects_cache') and 'timers' in self._prefetched_objects_cache:
            timers = [t for t in self.timers.all() if t.teacher_id == user.id]
        else:
            timers = self.timers.filter(teacher=user)
            
        total_seconds = 0
        for timer in timers:
            if timer.end_time:
                total_seconds += timer.duration_seconds
            else:
                # Include elapsed time for running timer
                elapsed = (timezone.now() - timer.start_time).total_seconds()
                total_seconds += int(elapsed)
        return total_seconds
    
    def end_session(self):
        """End the session and stop any running timers."""
        self.is_active = False
        self.status = 'completed'
        self.end_time = timezone.now()
        
        # Stop any running timers
        running_timers = self.timers.filter(end_time__isnull=True)
        for timer in running_timers:
            timer.stop()
        
        self.save(update_fields=['is_active', 'status', 'end_time'])
    
    def has_active_timer(self):
        """Check if there's an active timer in this session."""
        if hasattr(self, '_prefetched_objects_cache') and 'timers' in self._prefetched_objects_cache:
            return any(t.end_time is None for t in self.timers.all())
        return self.timers.filter(end_time__isnull=True).exists()
    
    def get_active_timer(self):
        """Get the currently running timer, if any."""
        if hasattr(self, '_prefetched_objects_cache') and 'timers' in self._prefetched_objects_cache:
            return next((t for t in self.timers.all() if t.end_time is None), None)
        return self.timers.filter(end_time__isnull=True).first()


class SessionTimer(models.Model):
    """
    Per-user teaching timer within a session.
    Only one timer can run at a time per session.
    """
    
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='timers'
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teaching_timers'
    )
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(
        default=0,
        help_text='Calculated duration when timer stops'
    )
    
    class Meta:
        verbose_name = 'session timer'
        verbose_name_plural = 'session timers'
        ordering = ['-start_time']
    
    def __str__(self):
        return f"Timer: {self.teacher.name} teaching in session {self.session.id}"
    
    @property
    def is_running(self):
        """Check if this timer is currently running."""
        return self.end_time is None
    
    def stop(self):
        """Stop the timer and calculate duration."""
        if self.end_time is None:
            self.end_time = timezone.now()
            self.duration_seconds = int(
                (self.end_time - self.start_time).total_seconds()
            )
            self.save(update_fields=['end_time', 'duration_seconds'])
    
    @classmethod
    def start_timer(cls, session, teacher):
        """
        Start a new timer for a teacher in a session.
        Stops any running timer first.
        """
        # Stop any running timer in this session
        running_timer = session.get_active_timer()
        if running_timer:
            running_timer.stop()
        
        # Create new timer
        return cls.objects.create(
            session=session,
            teacher=teacher,
            start_time=timezone.now()
        )

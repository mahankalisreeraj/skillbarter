from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from decimal import Decimal


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""
    
    def create_user(self, email, name, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError('Users must have an email address')
        
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        
        # New users get 15 credits on signup
        if 'credits' not in extra_fields:
            user.credits = Decimal('15.00')
        
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, name, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model for Link & Learn.
    Uses email as the unique identifier instead of username.
    """
    
    email = models.EmailField(
        verbose_name='email address',
        max_length=255,
        unique=True,
    )
    name = models.CharField(max_length=150, unique=True)
    credits = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('15.00'),  # New users get 15 credits
        help_text='User credit balance'
    )
    is_online = models.BooleanField(
        default=False,
        help_text='Whether user is currently online'
    )
    availability = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text='User availability (e.g., "Mon-Fri 9am-5pm")'
    )
    last_seen = models.DateTimeField(
        null=True, 
        blank=True,
        help_text='Last time user was seen active'
    )
    
    # Support credit tracking
    last_support_request = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last time user requested support credits'
    )
    
    # Login Streak Tracking
    last_login_date = models.DateField(
        null=True,
        blank=True,
        help_text='Last date the user logged in for streak tracking'
    )
    login_streak = models.IntegerField(
        default=0,
        help_text='Current consecutive login streak in days'
    )
    
    # Standard Django user fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    
    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ['-date_joined']
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        return self.name
    
    def get_short_name(self):
        return self.name.split()[0] if self.name else self.email
    
    @property
    def average_rating(self):
        """Calculate average rating from received reviews."""
        from .review import Review
        reviews = Review.objects.filter(reviewee=self)
        if not reviews.exists():
            return None
        return reviews.aggregate(models.Avg('rating'))['rating__avg']
    
    @property
    def total_reviews(self):
        """Count of received reviews."""
        from .review import Review
        return Review.objects.filter(reviewee=self).count()

    @property
    def total_credits_earned(self):
        """Calculate total credits earned (all time)."""
        from .credit import CreditTransaction
        earned_types = ['TEACHING', 'SIGNUP', 'BOUNTY']
        earned_transactions = CreditTransaction.objects.filter(
            user=self,
            transaction_type__in=earned_types,
            amount__gt=0
        )
        total = earned_transactions.aggregate(models.Sum('amount'))['amount__sum']
        return total if total else Decimal('0.00')

    @property
    def hours_taught(self):
        """Calculate total hours taught (all time)."""
        from .session import SessionTimer
        timers = SessionTimer.objects.filter(teacher=self, end_time__isnull=False)
        total_seconds = timers.aggregate(models.Sum('duration_seconds'))['duration_seconds__sum']
        if not total_seconds:
            return 0.0
        return round(total_seconds / 3600.0, 2)

    def get_weekly_activity(self):
        """Array of the past 7 days showing hours taught and credits earned."""
        from .credit import CreditTransaction
        from .session import SessionTimer
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.now().date()
        activity = []

        earned_types = ['TEACHING', 'SIGNUP', 'BOUNTY']

        for i in range(6, -1, -1):
            target_date = today - timedelta(days=i)
            
            # Credits earned on this day
            credits_earned = CreditTransaction.objects.filter(
                user=self,
                transaction_type__in=earned_types,
                amount__gt=0,
                created_at__date=target_date
            ).aggregate(models.Sum('amount'))['amount__sum'] or Decimal('0.00')

            # Seconds taught on this day
            seconds_taught = SessionTimer.objects.filter(
                teacher=self,
                end_time__isnull=False,
                end_time__date=target_date
            ).aggregate(models.Sum('duration_seconds'))['duration_seconds__sum'] or 0

            activity.append({
                'date': target_date.strftime('%Y-%m-%d'),
                'hours_taught': round(seconds_taught / 3600.0, 2),
                'credits_earned': float(credits_earned),
            })
            
        return activity

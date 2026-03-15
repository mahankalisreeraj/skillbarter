from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from ..serializers import UserSerializer, UserCreateSerializer


class SignupView(APIView):
    """
    User registration endpoint.
    Creates a new user and returns JWT tokens.
    New users automatically receive 15 credits.
    """
    
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        return Response({
            'detail': 'This is the registration endpoint. Use POST to signup.',
            'tip': 'If you are looking for the signup page, please visit the frontend application (usually at port 5173).'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    User login endpoint.
    Authenticates user and returns JWT tokens.
    """
    
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        return Response({
            'detail': 'This is the login endpoint. Use POST to login.',
            'tip': 'If you are looking for the login page, please visit the frontend application (usually at port 5173).'
        }, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def post(self, request):
        from django.contrib.auth import authenticate
        from django.utils import timezone
        
        email = request.data.get('email', '').lower().strip()
        password = request.data.get('password', '')
        
        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(request, username=email, password=password)
        
        if user is None:
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'Account is disabled.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Streak logic
        today = timezone.now().date()
        streak_rewarded = False
        
        if user.last_login_date != today:
            if user.last_login_date == today - timezone.timedelta(days=1):
                # Consecutive day login
                user.login_streak += 1
            else:
                # Missed a day or first login
                user.login_streak = 1
                
            user.last_login_date = today
            
            # Check for 7-day reward
            if user.login_streak >= 7:
                from ..models import CreditTransaction
                from decimal import Decimal
                
                reward_amount = Decimal('7.00')
                user.credits += reward_amount
                
                CreditTransaction.objects.create(
                    user=user,
                    amount=reward_amount,
                    transaction_type='BOUNTY',
                    balance_after=user.credits,
                    description='7-Day Login Streak Reward'
                )
                
                user.login_streak = 0
                streak_rewarded = True
                
            user.save(update_fields=['last_login_date', 'login_streak', 'credits'])
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'streak_rewarded': streak_rewarded,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class LogoutView(APIView):
    """
    User logout endpoint.
    Sets user offline and clears presence cache.
    """

    def post(self, request):
        user = request.user
        # Mark user as offline
        user.is_online = False
        user.save(update_fields=['is_online'])

        # Clear presence cache counter
        from django.core.cache import cache
        cache.delete(f'user_presence_{user.id}')

        return Response({'detail': 'Logged out successfully.'})

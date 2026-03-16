from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
import uuid

from ..models import Session, SessionTimer, CreditTransaction, Bank, LearningRequestPost
from ..serializers import (
    SessionSerializer,
    SessionCreateSerializer,
    SessionTimerSerializer
)
from ..utils import calculate_credits

User = get_user_model()


class SessionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for learning sessions.
    
    Endpoints:
    - GET /sessions/ - List user's sessions
    - POST /sessions/ - Create a new session
    - GET /sessions/{id}/ - Get session details
    - POST /sessions/{id}/timer/start/ - Start teaching timer
    - POST /sessions/{id}/timer/stop/ - Stop teaching timer
    - POST /sessions/{id}/end/ - End session and process credits
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return sessions where user is a participant."""
        user = self.request.user
        return Session.objects.filter(
            user1=user
        ) | Session.objects.filter(
            user2=user
        )
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SessionCreateSerializer
        return SessionSerializer

    def create(self, request, *args, **kwargs):
        """
        Create a new session request (from Teacher to Learner).
        Usage: POST /api/sessions/ { "post_id": 123 }
        """
        post_id = request.data.get('post_id')
        if not post_id:
            return Response({'error': 'post_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        post = get_object_or_404(LearningRequestPost, pk=post_id)
        
        if post.creator == request.user:
            return Response({'error': 'Cannot teach your own post.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if post.is_completed:
            return Response({'error': 'This post is already fulfilled.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check for existing pending/active request
        from django.db.models import Q
        existing = Session.objects.filter(
            user1=post.creator,
            user2=request.user,
            is_active=True
        ).exclude(status__in=['completed', 'expired', 'rejected']).first()
        
        if existing:
            return Response(SessionSerializer(existing).data, status=status.HTTP_200_OK)
            
        # Create pending session: user1=Learner, user2=Teacher
        session = Session.objects.create(
            user1=post.creator,
            user2=request.user,
            status='pending',
            is_active=True
        )
        
        return Response(SessionSerializer(session, context={'request': request}).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='timer/start')
    def start_timer(self, request, pk=None):
        """
        Start teaching timer for the current user.
        Only one timer can run at a time in a session.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if session is active
        if not session.is_active:
            return Response(
                {'error': 'Session is not active.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if there's already a running timer
        active_timer = session.get_active_timer()
        if active_timer:
            if active_timer.teacher == user:
                return Response(
                    {'error': 'Your timer is already running.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Stop the other user's timer first
            active_timer.stop()
        
        # Start new timer
        timer = SessionTimer.start_timer(session, user)
        
        return Response({
            'message': 'Timer started.',
            'timer': SessionTimerSerializer(timer).data
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], url_path='timer/stop')
    def stop_timer(self, request, pk=None):
        """
        Stop the current user's teaching timer.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Find running timer for this user
        active_timer = session.get_active_timer()
        
        if not active_timer:
            return Response(
                {'error': 'No active timer to stop.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if active_timer.teacher != user:
            return Response(
                {'error': 'You can only stop your own timer.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Stop timer
        active_timer.stop()
        
    @action(detail=True, methods=['post'], url_path='respond')
    def respond_to_request(self, request, pk=None):
        """Learner accepts or rejects the teacher's request."""
        session = self.get_object()
        if request.user != session.user1:
            return Response({'error': 'Only the learner can respond to the request.'}, status=status.HTTP_403_FORBIDDEN)
            
        decision = request.data.get('decision') # 'accept' or 'reject'
        if decision == 'accept':
            session.status = 'accepted'
            session.save(update_fields=['status'])
        elif decision == 'reject':
            session.status = 'rejected'
            session.is_active = False
            session.save(update_fields=['status', 'is_active'])
        else:
            return Response({'error': 'Invalid decision.'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response(SessionSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='propose-time')
    def propose_time(self, request, pk=None):
        """Either user proposes a time."""
        session = self.get_object()
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant.'}, status=status.HTTP_403_FORBIDDEN)
            
        proposed_time = request.data.get('time') # ISO format
        if not proposed_time:
            return Response({'error': 'time is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        session.proposed_time = proposed_time
        session.proposer = request.user
        session.save(update_fields=['proposed_time', 'proposer'])
        
        return Response(SessionSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='confirm-time')
    def confirm_time(self, request, pk=None):
        """User agrees to the proposed time."""
        session = self.get_object()
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant.'}, status=status.HTTP_403_FORBIDDEN)
            
        if not session.proposed_time or session.proposer == request.user:
            return Response({'error': 'No time to confirm or you are the proposer.'}, status=status.HTTP_400_BAD_REQUEST)
            
        session.scheduled_time = session.proposed_time
        session.status = 'scheduled'
        session.room_id = str(uuid.uuid4())
        session.save(update_fields=['scheduled_time', 'status', 'room_id'])
        
        return Response(SessionSerializer(session, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='join-lobby')
    def join_lobby(self, request, pk=None):
        """Signal presence in the waiting room."""
        session = self.get_object()
        from django.utils import timezone
        now = timezone.now()
        
        if request.user == session.user1:
            session.user1_lobby_joined_at = now
            session.save(update_fields=['user1_lobby_joined_at'])
        elif request.user == session.user2:
            session.user2_lobby_joined_at = now
            session.save(update_fields=['user2_lobby_joined_at'])
        else:
            return Response({'error': 'Not a participant.'}, status=status.HTTP_403_FORBIDDEN)
            
        # If both are in lobby and it's near or after scheduled time, activate session
        if session.user1_lobby_joined_at and session.user2_lobby_joined_at:
            if session.status == 'scheduled':
                session.status = 'active'
                session.save(update_fields=['status'])
                
        return Response(SessionSerializer(session, context={'request': request}).data)
    
    @action(detail=True, methods=['get'])
    def updates(self, request, pk=None):
        """
        Poll for session updates. 
        Also handles auto-start and expiration/penalties.
        """
        from datetime import timedelta
        from django.utils import timezone
        from ..models import CreditTransaction
        
        session = self.get_object()
        user = request.user
        now = timezone.now()
        
        if user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)
            
        # 1. Update Room Presence (existing logic)
        update_fields = []
        if user == session.user1:
            session.user1_last_room_presence = now
            update_fields.append('user1_last_room_presence')
        else:
            session.user2_last_room_presence = now
            update_fields.append('user2_last_room_presence')
            
        # 2. Check for Session Activation (if both are in presence)
        # (This is a more real-time version of join_lobby check)
        threshold = now - timedelta(seconds=30)
        u1_present = session.user1_last_room_presence and session.user1_last_room_presence > threshold
        u2_present = session.user2_last_room_presence and session.user2_last_room_presence > threshold
        
        if u1_present and u2_present and session.status == 'scheduled':
            session.status = 'active'
            if 'status' not in update_fields:
                update_fields.append('status')

        # 3. Check for Expiration & Penalties (10 minutes after scheduled time)
        penalty_applied = False
        if session.status == 'scheduled' and session.scheduled_time:
            expiry_limit = session.scheduled_time + timedelta(minutes=10)
            if now > expiry_limit:
                # If either or both failed to join the lobby/presence
                u1_joined = session.user1_lobby_joined_at or u1_present
                u2_joined = session.user2_lobby_joined_at or u2_present
                
                # Penalty Logic: Lose 1 credit if not joined
                if not u1_joined:
                    CreditTransaction.record_transaction(
                        user=session.user1,
                        amount=-1,
                        transaction_type='PENALTY',
                        session=session,
                        description="Penalty: Failed to join scheduled session."
                    )
                    penalty_applied = True
                
                if not u2_joined:
                    CreditTransaction.record_transaction(
                        user=session.user2,
                        amount=-1,
                        transaction_type='PENALTY',
                        session=session,
                        description="Penalty: Failed to join scheduled session."
                    )
                    penalty_applied = True
                
                session.status = 'expired'
                session.is_active = False
                update_fields.extend(['status', 'is_active'])

        if update_fields:
            session.save(update_fields=update_fields)
            
        # Determine peer presence for UI
        is_peer_in_room = u2_present if user == session.user1 else u1_present
            
        data = {
            'session': SessionSerializer(session, context={'request': request}).data,
            'is_peer_in_room': is_peer_in_room,
            'whiteboard_data': session.whiteboard_data,
            'code_data': session.code_data,
            'last_sync_time': session.last_sync_time,
            'last_sync_by': session.last_sync_by_id,
            'your_credits': float(user.credits),
            'penalty_applied': penalty_applied,
            'signal_data': session.signal_data,
            'signal_sender': session.signal_sender_id,
            'signal_timestamp': session.signal_timestamp
        }
        
        return Response(data)

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """
        Receive whiteboard/code updates from clients.
        """
        session = self.get_object()
        
        # Verify user is participant
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)
            
        whiteboard_data = request.data.get('whiteboard_data')
        code_data = request.data.get('code_data')
        signal_data = request.data.get('signal_data')
        
        update_fields = ['last_sync_time', 'last_sync_by']
        session.last_sync_by = request.user
        
        if whiteboard_data is not None:
            # Strip source: 'local' to ensure polling clients accept it
            if isinstance(whiteboard_data, dict):
                whiteboard_data.pop('source', None)
            session.whiteboard_data = whiteboard_data
            update_fields.append('whiteboard_data')
            
        if code_data is not None:
            # Strip source: 'local'
            if isinstance(code_data, dict):
                code_data.pop('source', None)
            session.code_data = code_data
            update_fields.append('code_data')
            
        if signal_data is not None:
            # Initialize if empty
            if not session.signal_data:
                session.signal_data = {}
            
            sig_type = signal_data.get('type')
            # Add sender info to signal_data if not present
            signal_data['sender_id'] = request.user.id
            
            if sig_type in ['offer', 'answer']:
                session.signal_data[sig_type] = signal_data
            elif sig_type == 'ready':
                role = 'caller' if request.user == session.user1 else 'callee'
                session.signal_data[f'ready_{role}'] = True
                # Also store the raw signal for dispatch
                session.signal_data['ready_signal'] = signal_data
            elif sig_type == 'candidate':
                # Separate candidates by role to avoid overwriting
                role = 'caller' if request.user == session.user1 else 'callee'
                key = f'candidates_{role}'
                candidates = session.signal_data.get(key, [])
                candidates.append(signal_data)
                session.signal_data[key] = candidates[-10:] # Keep last 10
            
            session.signal_sender = request.user
            update_fields.extend(['signal_data', 'signal_sender', 'signal_timestamp'])
            
        session.save(update_fields=update_fields)
        
        return Response({'status': 'synced'})
    
    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """
        End the session and process credit transfers.
        Credits are transferred based on teaching time.
        Bank takes 10% cut from each transfer.
        """
        session = self.get_object()
        user = request.user
        
        # Verify user is participant
        if user not in [session.user1, session.user2]:
            return Response(
                {'error': 'You are not a participant in this session.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if session is already ended
        if not session.is_active:
            return Response(
                {'error': 'Session is already ended.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # End session (this also stops any running timers)
        session.end_session()
        
        # Calculate and transfer credits
        credit_summary = self._process_credit_transfers(session)
        
        return Response({
            'message': 'Session ended.',
            'session': SessionSerializer(session).data,
            'credit_summary': credit_summary
        })

    @action(detail=False, methods=['post'], url_path='dm/(?P<user_id>\\d+)')
    def get_dm_session(self, request, user_id=None):
        """
        Get or create a direct message (DM) session with another user.
        If an active session exists, return it.
        If not, create a new session without a learning request.
        """
        user = request.user
        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        if user == target_user:
            return Response({'error': 'Cannot chat with yourself.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check for existing active session
        from django.db.models import Q
        active_session = Session.objects.filter(
            (Q(user1=user, user2=target_user) | Q(user1=target_user, user2=user)),
            is_active=True
        ).first()
        
        if active_session:
            return Response(SessionSerializer(active_session).data)
            
        # Create new session
        # User1 is always the requester (current user)
        session = Session.objects.create(
            user1=user,
            user2=target_user,
            learning_request=None # DM session
        )
        
        return Response(SessionSerializer(session).data, status=status.HTTP_201_CREATED)
    
    def _process_credit_transfers(self, session):
        """
        Process credit transfers based on teaching time.
        5 minutes teaching = 1 credit
        Bank takes 10% cut from teacher earnings.
        """
        from django.db import transaction
        
        user1_teaching_seconds = session.get_teaching_time(session.user1)
        user2_teaching_seconds = session.get_teaching_time(session.user2)
        
        credit_summary = {
            'user1': {
                'id': session.user1.id,
                'name': session.user1.name,
                'teaching_seconds': user1_teaching_seconds,
                'credits_earned': 0,
                'credits_spent': 0,
            },
            'user2': {
                'id': session.user2.id,
                'name': session.user2.name,
                'teaching_seconds': user2_teaching_seconds,
                'credits_earned': 0,
                'credits_spent': 0,
            },
            'bank_cut': 0
        }
        
        bank = Bank.get_instance()
        
        with transaction.atomic():
            # User1 taught, User2 learns
            if user1_teaching_seconds > 0:
                # Refresh from DB to get latest credits
                session.user1.refresh_from_db()
                session.user2.refresh_from_db()
                
                credits_needed = calculate_credits(user1_teaching_seconds)
                
                # Check learner (user2) balance
                learner_balance = session.user2.credits
                actual_credits = min(credits_needed, learner_balance)
                
                if actual_credits > 0:
                    bank_cut = actual_credits * Decimal('0.10')
                    teacher_receives = actual_credits - bank_cut
                    
                    # Deduct from learner (user2)
                    CreditTransaction.record_transaction(
                        user=session.user2,
                        amount=-actual_credits,
                        transaction_type='LEARNING',
                        session=session,
                        description=f'Learning from {session.user1.name}'
                    )
                    credit_summary['user2']['credits_spent'] = float(actual_credits)
                    
                    # Add to teacher (user1) - minus bank cut
                    CreditTransaction.record_transaction(
                        user=session.user1,
                        amount=teacher_receives,
                        transaction_type='TEACHING',
                        session=session,
                        description=f'Teaching {session.user2.name}'
                    )
                    credit_summary['user1']['credits_earned'] = float(teacher_receives)
                    
                    # Bank takes cut
                    bank.add_credits(bank_cut)
                    credit_summary['bank_cut'] += float(bank_cut)
            
            # User2 taught, User1 learns
            if user2_teaching_seconds > 0:
                # Refresh from DB to get latest credits
                session.user1.refresh_from_db()
                session.user2.refresh_from_db()

                credits_needed = calculate_credits(user2_teaching_seconds)
                
                # Check learner (user1) balance
                learner_balance = session.user1.credits
                actual_credits = min(credits_needed, learner_balance)
                
                if actual_credits > 0:
                    bank_cut = actual_credits * Decimal('0.10')
                    teacher_receives = actual_credits - bank_cut
                    
                    # Deduct from learner (user1)
                    CreditTransaction.record_transaction(
                        user=session.user1,
                        amount=-actual_credits,
                        transaction_type='LEARNING',
                        session=session,
                        description=f'Learning from {session.user2.name}'
                    )
                    credit_summary['user1']['credits_spent'] = float(actual_credits)
                    
                    # Add to teacher (user2) - minus bank cut
                    CreditTransaction.record_transaction(
                        user=session.user2,
                        amount=teacher_receives,
                        transaction_type='TEACHING',
                        session=session,
                        description=f'Teaching {session.user1.name}'
                    )
                    credit_summary['user2']['credits_earned'] = float(teacher_receives)
                    
                    # Bank takes cut
                    bank.add_credits(bank_cut)
                    credit_summary['bank_cut'] += float(bank_cut)
        
        return credit_summary

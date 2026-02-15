from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Session, SessionTimer, CreditTransaction, Bank
from ..serializers import (
    SessionSerializer,
    SessionCreateSerializer,
    SessionTimerSerializer
)
from ..utils import calculate_credits


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
        Create a new session.
        If an active session already exists with this user, return it (Idempotent).
        """
        user2_data = request.data.get('user2')
        if user2_data:
            try:
                from django.db.models import Q
                # Check for existing active session (Direct lookup handles ID text/int)
                # We use user2_id to match the FK field directly
                existing = Session.objects.filter(
                    (Q(user1=request.user, user2_id=user2_data) | Q(user1__id=user2_data, user2=request.user)),
                    is_active=True
                ).first()

                if existing:
                    return Response(SessionSerializer(existing).data, status=status.HTTP_200_OK)
            except Exception:
                # If any error in lookup (e.g. invalid ID format), fall back to standard create
                pass

        return super().create(request, *args, **kwargs)
    
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
        
        return Response({
            'message': 'Timer stopped.',
            'timer': SessionTimerSerializer(active_timer).data
        })
    
    @action(detail=True, methods=['get'])
    def updates(self, request, pk=None):
        """
        Poll for session updates (timer status, credits, collaborative data).
        """
        session = self.get_object()
        
        # Verify user is participant
        if request.user not in [session.user1, session.user2]:
            return Response({'error': 'Not a participant'}, status=status.HTTP_403_FORBIDDEN)
            
        data = {
            'session': SessionSerializer(session).data,
            'whiteboard_data': session.whiteboard_data,
            'code_data': session.code_data,
            'last_sync_time': session.last_sync_time,
            'last_sync_by': session.last_sync_by_id,
            'your_credits': float(request.user.credits),
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

import os
import sys
import django
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal

# Setup Django environment
sys.path.append('f:/skillbarter/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import CreditTransaction, Session, SessionTimer

User = get_user_model()

def generate_mock_data():
    print("Generating Mock Performance Data...")
    
    # Get active user
    try:
        user = User.objects.get(email='raj@gmail.com')
        print(f"Targeting active user: {user.name}")
    except User.DoesNotExist:
        user = User.objects.first()
        if not user:
            print("No users found to apply mock data to.")
            return
        print(f"Targeting fallback user: {user.name}")

    # Generate data for the past 6 days + today
    today = timezone.now().date()
    now = timezone.now()

    print("\nDropping old mock transactions for this user...")
    CreditTransaction.objects.filter(user=user, description__startswith="Mock Data:").delete()
    
    print("\nAdding new mock sessions and transactions...")
    for i in range(7):
        target_time = now - timedelta(days=i)
        
        # Add a mock teaching credit
        credits_to_add = Decimal(str(2.5 * (7 - i))) # more credits closer to today
        CreditTransaction.objects.create(
            user=user,
            amount=credits_to_add,
            transaction_type='TEACHING',
            balance_after=user.credits + credits_to_add,
            description=f'Mock Data: Taught on day {i}'
        )
        
        # We also need to backdate the created_at to bypass auto_now_add
        last_txn = CreditTransaction.objects.last()
        last_txn.created_at = target_time
        last_txn.save(update_fields=['created_at'])

        # Create a mock session timer to simulate hours taught
        dummy_student = User.objects.exclude(id=user.id).first()
        if dummy_student:
            session = Session.objects.create(
                user1=user,
                user2=dummy_student,
                start_time=target_time,
                end_time=target_time + timedelta(hours=1),
                is_active=False
            )
            SessionTimer.objects.create(
                session=session,
                teacher=user,
                start_time=target_time,
                end_time=target_time + timedelta(seconds=3600 * (1 + (i*0.5))), # 1.0 hr, 1.5 hr etc.
                duration_seconds=int(3600 * (1 + (i*0.5)))
            )

    
    print("\nDone! Verify the stats in the browser profile.")
    
    # Print the properties to confirm it works
    user.refresh_from_db()
    print(f"\n--- Output Check ---")
    print(f"Total Credits Earned: {user.total_credits_earned}")
    print(f"Hours Taught: {user.hours_taught}")
    print(f"Weekly Array Length: {len(user.get_weekly_activity())}")
    for day in user.get_weekly_activity():
        print(f" -> {day}")


if __name__ == '__main__':
    generate_mock_data()

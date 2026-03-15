import os
import sys
import django
from datetime import timedelta
from django.utils import timezone

# Setup Django environment
sys.path.append('f:/skillbarter/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import CreditTransaction
from rest_framework.test import APIClient

User = get_user_model()
client = APIClient(SERVER_NAME='localhost')

def test_streak_logic():
    print("Starting Streak Logic Tests...")
    
    # Create test user
    email = 'streak_test@test.com'
    password = 'testpassword123'
    name = 'Streak Tester'
    
    # Delete if exists
    User.objects.filter(email=email).delete()
    
    user = User.objects.create_user(email=email, password=password, name=name)
    print(f"\n[Test 1] Initial State:")
    print(f"  Streak: {user.login_streak}")
    print(f"  Credits: {user.credits}")
    
    # 1. First Login
    print("\n--- 1. First Login ---")
    response = client.post('/api/auth/login/', {'email': email, 'password': password})
    user.refresh_from_db()
    print(f"  Response Status: {response.status_code}")
    print(f"  Streak in DB: {user.login_streak}")
    print(f"  Last Login: {user.last_login_date}")
    assert user.login_streak == 1, "First login should set streak to 1"
    
    # 2. Same Day Login
    print("\n--- 2. Same Day Login ---")
    response = client.post('/api/auth/login/', {'email': email, 'password': password})
    user.refresh_from_db()
    print(f"  Streak in DB: {user.login_streak}")
    assert user.login_streak == 1, "Same day login should not increase streak"

    # 3. Next Day Login (Consecutive)
    print("\n--- 3. Consecutive Login ---")
    user.last_login_date = timezone.now().date() - timedelta(days=1)
    user.save()
    response = client.post('/api/auth/login/', {'email': email, 'password': password})
    user.refresh_from_db()
    print(f"  Streak in DB: {user.login_streak}")
    assert user.login_streak == 2, "Consecutive login should increase streak to 2"
    
    # 4. Missed Day Login
    print("\n--- 4. Missed Day Login ---")
    user.last_login_date = timezone.now().date() - timedelta(days=2)
    user.save()
    response = client.post('/api/auth/login/', {'email': email, 'password': password})
    user.refresh_from_db()
    print(f"  Streak in DB: {user.login_streak}")
    assert user.login_streak == 1, "Missed day login should reset streak to 1"

    # 5. 7-Day Reward
    print("\n--- 5. 7-Day Reward Validation ---")
    user.login_streak = 6
    user.last_login_date = timezone.now().date() - timedelta(days=1)
    initial_credits = user.credits
    user.save()
    
    response = client.post('/api/auth/login/', {'email': email, 'password': password})
    user.refresh_from_db()
    
    data = response.json()
    streak_rewarded = data.get('streak_rewarded', False)
    
    print(f"  API Response streak_rewarded flag: {streak_rewarded}")
    print(f"  Streak in DB (should reset): {user.login_streak}")
    print(f"  Initial Credits: {initial_credits}")
    print(f"  New Credits: {user.credits}")
    
    assert streak_rewarded is True, "API should return streak_rewarded=True"
    assert user.login_streak == 0, "Streak should reset to 0 after reward"
    assert user.credits == initial_credits + 7, "User should receive 7 credits"
    
    # Verify transaction
    transaction_exists = CreditTransaction.objects.filter(
        user=user, 
        amount=7.00, 
        description='7-Day Login Streak Reward'
    ).exists()
    print(f"  Reward Transaction Created: {transaction_exists}")
    assert transaction_exists is True, "Credit transaction should be created"

    print("\nAll tests passed successfully! ✅")

if __name__ == '__main__':
    test_streak_logic()
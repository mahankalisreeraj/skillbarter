import os
import django
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.first()
if user:
    print(f"USER_ID: {user.id}")
    print(f"HAS_NAME: {hasattr(user, 'name')}")
    print(f"HAS_USERNAME: {hasattr(user, 'username')}")
    print(f"HAS_EMAIL: {hasattr(user, 'email')}")
    if hasattr(user, 'name'): print(f"NAME_VAL: {user.name}")
    if hasattr(user, 'username'): print(f"USERNAME_VAL: {user.username}")
    print(f"EMAIL_VAL: {user.email}")
else:
    print("NO_USERS")

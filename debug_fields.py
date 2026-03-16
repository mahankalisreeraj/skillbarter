import os
import django
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import Session

User = get_user_model()

print("--- User Model Fields ---")
for field in User._meta.fields:
    print(f"{field.name}: {field.get_internal_type()}")

print("\n--- AUTH_USER_MODEL Setting ---")
from django.conf import settings
print(f"AUTH_USER_MODEL: {settings.AUTH_USER_MODEL}")

print("\n--- Testing Attribute Access ---")
user = User.objects.first()
if user:
    print(f"User ID: {user.id}")
    try:
        print(f"User name: {user.name}")
    except AttributeError as e:
        print(f"Error accessing .name: {e}")
    
    try:
        print(f"User username: {user.username}")
    except AttributeError as e:
        print(f"Error accessing .username: {e}")
else:
    print("No users found in database.")

print("\n--- Session Model Fields ---")
for field in Session._meta.fields:
    print(f"{field.name}: {field.get_internal_type()}")

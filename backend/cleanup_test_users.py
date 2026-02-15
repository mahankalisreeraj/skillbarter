import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from core.models.user import User

test_emails = ['testuser@example.com', 'testuser2@example.com']
test_names = ['Test User', 'Test User 2']

deleted_count, _ = User.objects.filter(email__in=test_emails).delete()
print(f"Deleted {deleted_count} users by email.")

deleted_count, _ = User.objects.filter(name__in=test_names).delete()
print(f"Deleted {deleted_count} users by name.")

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'skillbarter.settings')
django.setup()

from django.test import RequestFactory
from core.views.presence import PresenceViewSet
from core.views.session import SessionViewSet
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(is_active=True).first()

if not user:
    print("No user found. Exiting.")
    exit(0)

factory = RequestFactory()

try:
    print("Testing /api/presence/online/")
    request = factory.get('/api/presence/online/')
    request.user = user
    view = PresenceViewSet.as_view({'get': 'online'})
    response = view(request)
    print("Presence Response:", response)
    if hasattr(response, 'data'):
        print("Presence Data:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("\nTesting /api/sessions/")
    request = factory.get('/api/sessions/')
    request.user = user
    view = SessionViewSet.as_view({'get': 'list'})
    response = view(request)
    print("Sessions Response:", response)
    if hasattr(response, 'data'):
        print("Sessions Data:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()

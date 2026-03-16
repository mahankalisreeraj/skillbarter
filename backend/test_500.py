import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from core.views.session import SessionViewSet
from core.models.session import Session, SessionTimer
from core.models.user import User

user = User.objects.filter(is_active=True).first()
if not user:
    print("No user found.")
    exit(0)

# Create a new active session
user2 = User.objects.exclude(id=user.id).first()
session = Session.objects.create(
    user1=user,
    user2=user2,
    status='active',
    is_active=True
)
print(f"Created Session {session.id}")

factory = RequestFactory()

print(f"\nTesting /api/sessions/{session.id}/timer/start/")
request = factory.post(f'/api/sessions/{session.id}/timer/start/')
force_authenticate(request, user=user)
view = SessionViewSet.as_view({'post': 'start_timer'})
try:
    response = view(request, pk=session.id)
    print("Start Timer Response:", response.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()

print(f"\nTesting /api/sessions/{session.id}/timer/stop/")
request = factory.post(f'/api/sessions/{session.id}/timer/stop/')
force_authenticate(request, user=user)
view = SessionViewSet.as_view({'post': 'stop_timer'})
try:
    response = view(request, pk=session.id)
    print("Stop Timer Response:", response.status_code)
    if hasattr(response, 'data'):
        print("Data:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()

print(f"\nTesting /api/sessions/{session.id}/end/")
request = factory.post(f'/api/sessions/{session.id}/end/')
force_authenticate(request, user=user)
view = SessionViewSet.as_view({'post': 'end'})
try:
    response = view(request, pk=session.id)
    print("End Session Response:", response.status_code)
except Exception as e:
    import traceback
    traceback.print_exc()



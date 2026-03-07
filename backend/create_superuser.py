import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'linklearn.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

email = 'sudhamshbalabhadra@gmail.com'
password = 'linklearn@143'
name = 'Sudhamsh'

try:
    user = User.objects.get(email=email)
    print(f"User {email} already exists.")
    user.set_password(password)
    user.save()
    print("Password updated successfully.")
    
    if not user.is_superuser:
        print("User is not a superuser. Promoting to superuser...")
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print("User promoted to superuser.")
    else:
        print("User is already a superuser.")

except User.DoesNotExist:
    print(f"User {email} does not exist. Creating superuser...")
    User.objects.create_superuser(email=email, name=name, password=password)
    print(f"Superuser {email} created successfully.")
except Exception as e:
    print(f"An error occurred: {e}")

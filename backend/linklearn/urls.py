"""
URL configuration for Link & Learn project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.shortcuts import redirect
from django.urls import re_path
from django.views.static import serve

def root_redirect(request):
    return redirect('api/')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('', root_redirect),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()

# Serve media files on Render even in production (ephemeral storage)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {
        'document_root': settings.MEDIA_ROOT,
    }),
]

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.laboratory.admin_dashboard import admin_dashboard_view

urlpatterns = [
    path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.laboratory.api_urls')),
    path('', include('apps.laboratory.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
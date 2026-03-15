from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import api_views

router = DefaultRouter()
router.register(r'courses', api_views.CourseViewSet, basename='course')
router.register(r'groups', api_views.StudentGroupViewSet, basename='group')
router.register(r'assignments', api_views.AssignmentViewSet, basename='assignment')
router.register(r'submissions', api_views.SubmissionViewSet, basename='submission')
router.register(r'admin/submissions', api_views.AdminSubmissionViewSet, basename='admin-submission')
router.register(r'admin/users', api_views.AdminUserViewSet, basename='admin-user')

urlpatterns = [
    path('', include(router.urls)),
    path('public/groups/', api_views.public_groups, name='api-public-groups'),
    path('auth/me/', api_views.me, name='api-me'),
    path('auth/register/', api_views.RegisterView.as_view(), name='api-register'),
    path('auth/login/', api_views.TokenObtainPairWith2FAView.as_view(), name='api-token'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('auth/password-change/', api_views.password_change, name='api-password-change'),
    path('auth/password-reset/request/', api_views.password_reset_request, name='api-password-reset-request'),
    path('auth/password-reset/confirm/', api_views.password_reset_confirm, name='api-password-reset-confirm'),
    path('auth/2fa/setup/', api_views.twofa_setup, name='api-2fa-setup'),
    path('auth/2fa/enable/', api_views.twofa_enable, name='api-2fa-enable'),
    path('auth/2fa/disable/', api_views.twofa_disable, name='api-2fa-disable'),
    path('admin/stats/', api_views.admin_stats, name='api-admin-stats'),
    path('export/course/<int:course_id>/', api_views.export_course_submissions, name='api-export-course'),
    path('export/group/<int:group_id>/', api_views.export_group_submissions, name='api-export-group'),
    path('export/assignment/<uuid:assignment_id>/', api_views.export_assignment_submissions, name='api-export-assignment'),
    path('export/smart/<uuid:assignment_id>/', api_views.export_smart_submissions, name='api-export-smart'),
]

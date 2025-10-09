
from django.urls import path
from . import views
from django.contrib.auth.views import LogoutView

app_name = 'laboratory'

urlpatterns = [
    path('', views.index, name='index'),
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.custom_logout, name='logout'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),
    path('assignment/<uuid:assignment_uuid>/', views.assignment_detail, name='assignment_detail'),
    path('teacher/', views.teacher_panel, name='teacher_panel'),
    path('teacher/create_group/', views.create_group, name='create_group'),
    path('teacher/create_assignment/', views.create_assignment, name='create_assignment'),
    path('export/course/<int:course_id>/', views.export_submissions, name='export_course'),
    path('export/group/<int:group_id>/', views.export_submissions, name='export_group'),
]
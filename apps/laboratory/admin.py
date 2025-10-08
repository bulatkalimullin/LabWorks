
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Course, StudentGroup, Assignment, Submission

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительная информация', {'fields': ('full_name', 'student_groups')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Дополнительная информация', {'fields': ('full_name', 'student_groups')}),
    )

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'open_time', 'close_time')
    filter_horizontal = ('student_groups',)

admin.site.register(Course)
admin.site.register(StudentGroup)
admin.site.register(Submission)

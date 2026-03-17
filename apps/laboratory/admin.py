
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from unfold.admin import ModelAdmin
from unfold.contrib.import_export.forms import ExportForm, ImportForm
from import_export import resources
from import_export.admin import ImportExportModelAdmin as _ImportExportBase
from django.utils.safestring import mark_safe


class ImportExportModelAdmin(_ImportExportBase, ModelAdmin):
    """Combines django-unfold styling with django-import-export functionality."""
    import_form_class = ImportForm
    export_form_class = ExportForm

from .models import (
    CustomUser, Course, CourseImage, StudentGroup,
    Assignment, Submission, Comment, AssignmentEvent, LoginLog,
    SiteSettings, get_site_settings, STUDENT_LABELS,
)


class CustomUserResource(resources.ModelResource):
    class Meta:
        model = CustomUser
        fields = ("id", "username", "full_name", "label", "is_staff", "is_active")
        export_order = ("id", "username", "full_name", "label", "is_staff", "is_active")


class CourseResource(resources.ModelResource):
    class Meta:
        model = Course
        fields = "__all__"


class StudentGroupResource(resources.ModelResource):
    class Meta:
        model = StudentGroup
        fields = "__all__"


class AssignmentResource(resources.ModelResource):
    class Meta:
        model = Assignment
        fields = "__all__"


class SubmissionResource(resources.ModelResource):
    class Meta:
        model = Submission
        fields = (
            "id", "assignment", "student", "submitted_at",
            "admin_note", "admin_flags",
            "verification_payload", "verification_signature",
        )


@admin.action(description="Сбросить пароль на Password1!")
def reset_password(modeladmin, request, queryset):
    for user in queryset:
        user.set_password("Password1!")
        user.save(update_fields=["password"])
    modeladmin.message_user(
        request, f"Пароль сброшен для {queryset.count()} пользователей."
    )


@admin.register(CustomUser)
class CustomUserAdmin(ImportExportModelAdmin, UserAdmin):
    resource_class = CustomUserResource
    list_display = ("username", "full_name", "label_display", "is_staff", "is_active", "date_joined")
    list_filter = ("is_staff", "is_active", "label")
    search_fields = ("username", "full_name")
    fieldsets = UserAdmin.fieldsets + (
        ("Дополнительная информация", {"fields": ("full_name", "student_groups", "label")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Дополнительная информация", {"fields": ("full_name", "student_groups", "label")}),
    )
    actions = [reset_password]

    @admin.display(description="Метка")
    def label_display(self, obj):
        if not obj.label:
            return "—"
        label_dict = dict(STUDENT_LABELS)
        return label_dict.get(obj.label, obj.label)

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        if request.resolver_match and 'add' in (request.resolver_match.url_name or ''):
            if not get_site_settings().registration_open:
                initial['is_active'] = False
        return initial


class CourseImageInline(admin.StackedInline):
    model = CourseImage
    extra = 2
    fields = ('image', 'title', 'order')
    verbose_name = 'Фон'
    verbose_name_plural = 'Фоны курса (загрузите изображения — они будут на карточке и на странице курса)'


@admin.register(Course)
class CourseAdmin(ImportExportModelAdmin):
    resource_class = CourseResource
    inlines = (CourseImageInline,)
    list_display = ("name", "images_count")
    fieldsets = (
        (None, {"fields": ("name",)}),
    )

    @admin.display(description="Фонов")
    def images_count(self, obj):
        return obj.images.count()


@admin.register(CourseImage)
class CourseImageAdmin(ModelAdmin):
    list_display = ("thumbnail", "course", "title", "order")
    list_filter = ("course",)
    search_fields = ("title", "course__name")
    list_editable = ("order",)

    @admin.display(description="Превью")
    def thumbnail(self, obj):
        if not obj.image:
            return "—"
        return mark_safe(f'<img src="{obj.image.url}" style="height:40px;border-radius:4px;" />')


@admin.register(StudentGroup)
class StudentGroupAdmin(ImportExportModelAdmin):
    resource_class = StudentGroupResource


@admin.register(Assignment)
class AssignmentAdmin(ImportExportModelAdmin):
    resource_class = AssignmentResource
    list_display = ("title", "course", "open_time", "close_time", "submissions_count")
    list_filter = ("course",)
    filter_horizontal = ("student_groups",)

    @admin.display(description="Сдач")
    def submissions_count(self, obj):
        return obj.submissions.count()


@admin.register(Submission)
class SubmissionAdmin(ImportExportModelAdmin):
    resource_class = SubmissionResource
    list_display = (
        "id", "student", "student_label", "assignment", "submitted_at",
        "flags_display", "verification_key_short",
    )
    list_filter = ("student__label", "assignment__course")
    search_fields = ("student__username", "student__full_name", "verification_payload", "admin_note")
    readonly_fields = ("submitted_at", "verification_payload", "verification_signature")

    @admin.display(description="Метка студента")
    def student_label(self, obj):
        if not obj.student.label:
            return "—"
        label_dict = dict(STUDENT_LABELS)
        return label_dict.get(obj.student.label, obj.student.label)

    @admin.display(description="Флаги")
    def flags_display(self, obj):
        if not obj.admin_flags:
            return "—"
        return ", ".join(obj.admin_flags)

    @admin.display(description="Верификационный ключ")
    def verification_key_short(self, obj):
        if obj.verification_signature:
            return obj.verification_signature[:16] + "…"
        return "—"


@admin.register(AssignmentEvent)
class AssignmentEventAdmin(ModelAdmin):
    list_display = ("student", "assignment", "event_type", "created_at")
    list_filter = ("event_type", "assignment__course")
    search_fields = ("student__username", "student__full_name")
    readonly_fields = ("student", "assignment", "event_type", "created_at")
    date_hierarchy = "created_at"


@admin.register(LoginLog)
class LoginLogAdmin(ModelAdmin):
    list_display = ("user", "ip_address", "short_user_agent", "created_at")
    list_filter = ("user", "ip_address", "created_at")
    search_fields = ("user__username", "user__full_name", "ip_address", "user_agent")
    readonly_fields = ("user", "ip_address", "user_agent", "created_at")
    date_hierarchy = "created_at"

    @admin.display(description="User-Agent")
    def short_user_agent(self, obj):
        if not obj.user_agent:
            return "—"
        if len(obj.user_agent) > 60:
            return obj.user_agent[:57] + "…"
        return obj.user_agent


@admin.register(SiteSettings)
class SiteSettingsAdmin(ModelAdmin):
    list_display = ("registration_open",)
    list_display_links = ("registration_open",)

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

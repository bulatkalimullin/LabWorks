from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from apps.laboratory.admin_dashboard import admin_dashboard_view
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.utils import timezone
import os

urlpatterns = [
    path('admin/dashboard/', admin_dashboard_view, name='admin-dashboard'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.laboratory.api_urls')),
    path('', include('apps.laboratory.urls')),
]

# DEV ONLY: serve MEDIA via authenticated, object-level protected fallback.
# This endpoint exists to support X-Accel-Redirect-style flows in local development.
if settings.DEBUG:
    from django.contrib.auth.decorators import login_required
    from apps.laboratory.models import Assignment, Submission, CourseImage

    @login_required
    def course_image_dev_serve(request, subpath: str):
        """
        DEV ONLY: serve only course cover images at /media/course_images/... .
        This avoids re-enabling public access to other sensitive /media/ files.
        """
        file_path = f'course_images/{subpath}'
        img = CourseImage.objects.filter(image=file_path).first()
        if not img or not img.image:
            raise Http404
        filename = os.path.basename(img.image.name)
        return FileResponse(img.image.open('rb'), as_attachment=False, filename=filename)

    @login_required
    def protected_media_fallback(request, subpath: str):
        file_path = subpath

        now = timezone.now()
        if file_path.startswith('submissions/'):
            submission = (
                Submission.objects.select_related('assignment', 'student')
                .filter(file=file_path)
                .first()
            )
            if not submission:
                raise Http404
            if not request.user.is_staff and submission.student_id != request.user.id:
                return HttpResponseForbidden()
            if not request.user.is_staff and not (submission.assignment.open_time <= now <= submission.assignment.close_time):
                return HttpResponseForbidden()

            filename = os.path.basename(submission.file.name)
            return FileResponse(submission.file.open('rb'), as_attachment=True, filename=filename)

        if file_path.startswith('assignments/'):
            assignment = Assignment.objects.select_related('course').filter(files=file_path).first()
            if not assignment:
                raise Http404

            if not request.user.is_staff:
                if not (assignment.open_time <= now <= assignment.close_time):
                    return HttpResponseForbidden()
                user_groups = request.user.student_groups.all()
                if not assignment.student_groups.filter(pk__in=user_groups).exists():
                    return HttpResponseForbidden()

            filename = os.path.basename(assignment.files.name) if assignment.files else 'file'
            return FileResponse(assignment.files.open('rb'), as_attachment=True, filename=filename)

        raise Http404

    urlpatterns += [
        path('media/course_images/<path:subpath>/', course_image_dev_serve, name='course-image-dev'),
        path('protected-media/<path:subpath>/', protected_media_fallback, name='protected-media-dev'),
    ]
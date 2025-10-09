from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.http import HttpResponse, HttpResponseForbidden
from django.contrib.auth import login, authenticate, logout
from .models import Course, Assignment, Submission, StudentGroup
from .forms import CustomUserCreationForm, SubmissionForm, GroupForm, AssignmentForm
from django.utils import timezone
from django.http.response import HttpResponseNotFound
from django.contrib import messages
import zipfile
from io import BytesIO
import os

def is_teacher(user):
    return user.is_staff

def index(request):
    courses = Course.objects.all()
    return render(request, 'laboratory/index.html', {'courses': courses})

def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Регистрация успешно завершена!')
            return redirect('laboratory:index')
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки ниже.')
    else:
        form = CustomUserCreationForm()
    return render(request, 'laboratory/register.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            messages.success(request, 'Вход успешно выполнен!')
            return redirect('laboratory:index')
        else:
            messages.error(request, 'Неверное имя пользователя или пароль.')
    return render(request, 'laboratory/login.html')

def custom_logout(request):
    if request.user.is_authenticated:
        logout(request)
        messages.success(request, 'Вы успешно вышли из системы!')
    return redirect('laboratory:index')

@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    now = timezone.now()
    if request.user.is_staff:
        assignments = course.assignments.all()
    else:
        assignments = course.assignments.filter(
            student_groups__in=request.user.student_groups.all(),
            open_time__lte=now,
            close_time__gte=now
        ).distinct()
    return render(request, 'laboratory/course_detail.html', {'course': course, 'assignments': assignments, 'now': now})

@login_required
def assignment_detail(request, assignment_uuid):
    now = timezone.now()
    if request.user.is_staff:
        # Staff can access any assignment
        try:
            assignment = Assignment.objects.get(
                id=assignment_uuid,
            )
        except Assignment.DoesNotExist:
            return HttpResponseNotFound()
    else:
        # Non-staff users must be in assignment's groups and within time window
        try:
            assignment = Assignment.objects.get(
                id=assignment_uuid,
                open_time__lte=now,
                close_time__gte=now
            )
        except Assignment.DoesNotExist:
            return HttpResponseForbidden()
    # Get user's submissions for non-staff users
    user_submissions = Submission.objects.filter(assignment=assignment, student=request.user) if not request.user.is_staff else []
    # Handle download all submissions for staff
    if request.method == 'POST' and request.user.is_staff and 'download_submissions' in request.POST:
        submissions = Submission.objects.filter(assignment=assignment)
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for submission in submissions:
                # Get student's groups linked to this assignment
                student_groups = submission.student.student_groups.filter(assignments=assignment)
                group_name = student_groups.first().name if student_groups.exists() else "NoGroup"
                # Sanitize student full name for folder name
                student_name = submission.student.full_name.replace('/', '_').replace('\\', '_')
                # Add file submission if it exists
                if submission.file:
                    file_path = submission.file.path
                    file_extension = submission.file.name.split('.')[-1]
                    arcname = f"{group_name}/{student_name}/{submission.file.name}.{file_extension}"
                    zip_file.write(file_path, arcname)
                # Add text response as a .txt file if it exists
                if submission.text_response:
                    text_filename = f"{group_name}/{student_name}/{submission.student.username}_{submission.assignment.title}_text_response.txt"
                    zip_file.writestr(text_filename, submission.text_response)
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{assignment.title}_submissions.zip"'
        return response
    if request.method == 'POST' and not request.user.is_staff:
        form = SubmissionForm(request.POST, request.FILES)
        if form.is_valid():
            # Check file extension if a file is uploaded
            if 'file' in request.FILES:
                file_extension = request.FILES['file'].name.split('.')[-1].lower()
                allowed_extensions = [ext.lower() for ext in assignment.allowed_extensions.split(',')]
                if file_extension not in allowed_extensions:
                    messages.error(request, f'Недопустимое расширение файла. Разрешённые расширения: {", ".join(allowed_extensions)}.')
                    return render(request, 'laboratory/assignment_detail.html', {
                        'assignment': assignment,
                        'form': form,
                        'now': now,
                        'user_submissions': user_submissions
                    })
            submission = form.save(commit=False)
            submission.assignment = assignment
            submission.student = request.user
            submission.save()
            messages.success(request, 'Работа успешно отправлена!')
            return redirect('laboratory:course_detail', course_id=assignment.course.id)
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки в форме.')
    else:
        form = SubmissionForm()
    return render(request, 'laboratory/assignment_detail.html', {
        'assignment': assignment,
        'form': form,
        'now': now,
        'user_submissions': user_submissions
    })

@user_passes_test(is_teacher)
def teacher_panel(request):
    courses = Course.objects.all()
    group_form = GroupForm(request.POST or None)
    assignment_form = AssignmentForm(request.POST or None, request.FILES or None)
    if request.method == 'POST':
        if 'group_form' in request.POST and group_form.is_valid():
            group_form.save()
            messages.success(request, 'Группа успешно создана!')
            return redirect('laboratory:teacher_panel')
        elif 'assignment_form' in request.POST and assignment_form.is_valid():
            assignment_form.save()
            messages.success(request, 'Задание успешно создано!')
            return redirect('laboratory:teacher_panel')
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки ниже.')
    return render(request, 'laboratory/teacher_panel.html', {
        'courses': courses,
        'group_form': group_form,
        'assignment_form': assignment_form
    })

@user_passes_test(is_teacher)
def create_group(request):
    if request.method == 'POST':
        form = GroupForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Группа успешно создана!')
            return redirect('laboratory:teacher_panel')
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки ниже.')
    else:
        form = GroupForm()
    return render(request, 'laboratory/create_group.html', {'form': form})

@user_passes_test(is_teacher)
def create_assignment(request):
    if request.method == 'POST':
        form = AssignmentForm(request.POST, request.FILES)
        if form.is_valid():
            assignment = form.save()
            messages.success(request, 'Задание успешно создано!')
            return redirect('laboratory:teacher_panel')
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки ниже.')
    else:
        form = AssignmentForm()
    return render(request, 'laboratory/create_assignment.html', {'form': form})

@user_passes_test(is_teacher)
def export_submissions(request, course_id=None, group_id=None):
    if course_id:
        submissions = Submission.objects.filter(assignment__course_id=course_id)
        name = Course.objects.get(id=course_id).name
    elif group_id:
        submissions = Submission.objects.filter(student__student_groups__id=group_id)
        name = StudentGroup.objects.get(id=group_id).name
    else:
        submissions = Submission.objects.all()
        name = 'all'
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for submission in submissions:
            if submission.file:  # Check if file exists
                file_path = submission.file.path
                arcname = f"{submission.student.username}_{submission.assignment.title}.{submission.file.name.split('.')[-1]}"
                zip_file.write(file_path, arcname)
    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename={name}_submissions.zip'
    return response
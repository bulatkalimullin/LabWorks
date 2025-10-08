
from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser, Submission, Course, StudentGroup, Assignment

import re

class CustomSelectMultiple(forms.Select):
    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex, attrs)
        if value == '':
            option['attrs']['disabled'] = True
            option['label'] = 'Выберите группу'
        return option

    def optgroups(self, name, value, attrs=None):
        # Add the placeholder option as the first option
        groups = super().optgroups(name, value, attrs)
        placeholder = [('', [{'name': '', 'value': '', 'label': 'Выберите группу', 'selected': False, 'index': '0', 'attrs': {'disabled': True}}])]
        return placeholder + groups

class CustomUserCreationForm(UserCreationForm):
    student_groups = forms.ModelMultipleChoiceField(
        queryset=StudentGroup.objects.all(),
        required=False,
        label='Группы',
        widget=CustomSelectMultiple(attrs={'class': 'form-control'})
    )
    class Meta:
        model = CustomUser
        fields = ('username', 'full_name', 'student_groups', 'password1', 'password2')
        labels = {
            'username': 'Имя пользователя',
            'full_name': 'ФИО',
            'student_groups': 'Группы',
            'password1': 'Пароль',
            'password2': 'Подтверждение пароля',
        }
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'full_name': forms.TextInput(attrs={'class': 'form-control'}),
            'password1': forms.PasswordInput(attrs={'class': 'form-control'}),
            'password2': forms.PasswordInput(attrs={'class': 'form-control'}),
        }

    def clean_full_name(self):
        full_name = self.cleaned_data.get('full_name')
        if not full_name:
            raise forms.ValidationError('Поле ФИО не может быть пустым.')
        # Split the full name into words (remove extra spaces)
        words = full_name.strip().split()
        # Check for at least two words
        if len(words) < 2:
            raise forms.ValidationError('ФИО должно содержать как минимум два слова.')
        # Check each word has at least two letters
        for word in words:
            if len(word) < 2:
                raise forms.ValidationError('Каждое слово в ФИО должно содержать как минимум две буквы.')
        return full_name

    def clean_password1(self):
        password = self.cleaned_data.get('password1')
        if not password:
            raise forms.ValidationError('Поле пароля не может быть пустым.')
        # Check minimum length
        if len(password) < 8:
            raise forms.ValidationError('Пароль должен содержать как минимум 8 символов.')
        # Check for at least one uppercase letter
        if not re.search(r'[A-Z]', password):
            raise forms.ValidationError('Пароль должен содержать как минимум одну заглавную букву.')
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise forms.ValidationError('Пароль должен содержать как минимум один специальный символ (!@#$%^&*(),.?":{}|<>).')
        return password

class SubmissionForm(forms.ModelForm):
    class Meta:
        model = Submission
        fields = ('file', 'text_response')
        labels = {
            'file': 'Файл',
            'text_response': 'Текстовый ответ',
        }
        widgets = {
            'text_response': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'file': forms.FileInput(attrs={'class': 'form-control'}),
        }

class GroupForm(forms.ModelForm):
    class Meta:
        model = StudentGroup
        fields = ('name', 'course')
        labels = {
            'name': 'Название группы',
            'course': 'Курс',
        }
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'course': forms.Select(attrs={'class': 'form-control'}),
        }

class AssignmentForm(forms.ModelForm):
    class Meta:
        model = Assignment
        fields = ('title', 'description', 'course', 'student_groups', 'allowed_extensions', 'open_time', 'close_time', 'files')
        labels = {
            'title': 'Название задания',
            'description': 'Описание',
            'course': 'Курс',
            'student_groups': 'Группы',
            'allowed_extensions': 'Разрешённое расширение',
            'open_time': 'Время открытия',
            'close_time': 'Время закрытия',
            'files': 'Файлы задания',
        }
        widgets = {
            'open_time': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'form-control'}),
            'close_time': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'form-control'}),
            'title': forms.TextInput(attrs={'class': 'form-control'}),
            'description': forms.Textarea(attrs={'rows': 4, 'class': 'form-control'}),
            'course': forms.Select(attrs={'class': 'form-control'}),
            'student_groups': forms.SelectMultiple(attrs={'class': 'form-control'}),
            'allowed_extensions': forms.TextInput(attrs={'class': 'form-control'}),
            'files': forms.FileInput(attrs={'class': 'form-control'}),
        }

from io import BytesIO

from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from django.test import TestCase

from apps.laboratory.models import CustomUser, Course, StudentGroup, Assignment, Submission, AssignmentEvent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username='student1', password='testpass99', is_staff=False, full_name='Test User'):
    return CustomUser.objects.create_user(
        username=username,
        password=password,
        is_staff=is_staff,
        full_name=full_name,
    )


def get_tokens(client, username, password='testpass99'):
    r = client.post('/api/v1/auth/login/', {'username': username, 'password': password})
    return r.data


def auth_client(user, password='testpass99'):
    c = APIClient()
    tokens = get_tokens(c, user.username, password)
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
    return c


def make_assignment(course, groups=(), open_offset=-1, close_offset=1):
    now = timezone.now()
    a = Assignment.objects.create(
        title='Test Assignment',
        description='desc',
        course=course,
        allowed_extensions='txt,pdf',
        open_time=now + timedelta(hours=open_offset),
        close_time=now + timedelta(hours=close_offset),
    )
    for g in groups:
        a.student_groups.add(g)
    return a


# ---------------------------------------------------------------------------
# Auth Tests
# ---------------------------------------------------------------------------

class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        r = self.client.post('/api/v1/auth/register/', {
            'username': 'newuser',
            'full_name': 'Ivan Petrov',
            'password': 'strongpass99',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)

    def test_register_duplicate_username(self):
        make_user('dupuser')
        r = self.client.post('/api/v1/auth/register/', {
            'username': 'dupuser',
            'full_name': 'Ivan Petrov',
            'password': 'strongpass99',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_full_name(self):
        r = self.client.post('/api/v1/auth/register/', {
            'username': 'shortname',
            'full_name': 'Ivan',
            'password': 'strongpass99',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        make_user('loginuser')
        r = self.client.post('/api/v1/auth/login/', {
            'username': 'loginuser',
            'password': 'testpass99',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)

    def test_login_wrong_password(self):
        make_user('badpass')
        r = self.client.post('/api/v1/auth/login/', {
            'username': 'badpass',
            'password': 'wrongpassword',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_authenticated(self):
        user = make_user('meuser')
        c = auth_client(user)
        r = c.get('/api/v1/auth/me/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['username'], 'meuser')
        self.assertIn('is_staff', r.data)

    def test_me_unauthenticated(self):
        r = self.client.get('/api/v1/auth/me/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Course Tests
# ---------------------------------------------------------------------------

class CourseTests(TestCase):
    def setUp(self):
        self.student = make_user('course_student')
        self.staff = make_user('course_staff', is_staff=True, full_name='Staff User')
        self.student_client = auth_client(self.student)
        self.staff_client = auth_client(self.staff)

    def test_list_courses_authenticated(self):
        Course.objects.create(name='Math')
        Course.objects.create(name='Physics')
        r = self.student_client.get('/api/v1/courses/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)

    def test_list_courses_unauthenticated(self):
        r = APIClient().get('/api/v1/courses/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_course_student_forbidden(self):
        r = self.student_client.post('/api/v1/courses/', {'name': 'New Course'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_course_staff_ok(self):
        r = self.staff_client.post('/api/v1/courses/', {'name': 'New Course'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['name'], 'New Course')


# ---------------------------------------------------------------------------
# Assignment Tests
# ---------------------------------------------------------------------------

class AssignmentTests(TestCase):
    def setUp(self):
        self.staff = make_user('asgn_staff', is_staff=True, full_name='Staff User')
        self.student = make_user('asgn_student')
        self.other_student = make_user('asgn_other', full_name='Other Student')

        self.course = Course.objects.create(name='CS101')
        self.group = StudentGroup.objects.create(name='Group A', course=self.course)
        self.student.student_groups.add(self.group)

        self.assignment = make_assignment(self.course, groups=[self.group])

        self.staff_client = auth_client(self.staff)
        self.student_client = auth_client(self.student)
        self.other_client = auth_client(self.other_student)

    def test_assignment_list_student_sees_own_group(self):
        r = self.student_client.get('/api/v1/assignments/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [a['id'] for a in r.data]
        self.assertIn(str(self.assignment.pk), ids)

    def test_assignment_list_other_student_sees_nothing(self):
        r = self.other_client.get('/api/v1/assignments/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 0)

    def test_assignment_list_staff_sees_all(self):
        r = self.staff_client.get('/api/v1/assignments/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(r.data), 1)

    def test_assignment_events_open_page(self):
        r = self.student_client.post(
            f'/api/v1/assignments/{self.assignment.pk}/events/',
            {'event_type': 'OPEN_PAGE'},
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertTrue(
            AssignmentEvent.objects.filter(
                student=self.student,
                assignment=self.assignment,
                event_type='OPEN_PAGE',
            ).exists()
        )

    def test_assignment_events_behavior(self):
        for event_type in ('CLIPBOARD_CHANGE', 'TAB_SWITCH', 'PASTE_DETECTED'):
            r = self.student_client.post(
                f'/api/v1/assignments/{self.assignment.pk}/events/',
                {'event_type': event_type, 'metadata': {}},
                format='json',
            )
            self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), msg=event_type)

    def test_keylog_batch_event(self):
        r = self.student_client.post(
            f'/api/v1/assignments/{self.assignment.pk}/events/',
            {'event_type': 'KEYLOG_BATCH', 'metadata': {'keys': [{'key': 'a', 't': 100}]}},
            format='json',
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        event = AssignmentEvent.objects.filter(
            student=self.student,
            assignment=self.assignment,
            event_type='KEYLOG_BATCH',
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.metadata['keys'][0]['key'], 'a')


# ---------------------------------------------------------------------------
# Submission Tests
# ---------------------------------------------------------------------------

class SubmissionTests(TestCase):
    def setUp(self):
        self.staff = make_user('sub_staff', is_staff=True, full_name='Staff User')
        self.student1 = make_user('sub_student1')
        self.student2 = make_user('sub_student2', full_name='Second Student')

        self.course = Course.objects.create(name='CS102')
        self.group = StudentGroup.objects.create(name='Group B', course=self.course)
        self.student1.student_groups.add(self.group)
        self.student2.student_groups.add(self.group)

        self.assignment = make_assignment(self.course, groups=[self.group])

        self.student1_client = auth_client(self.student1)
        self.student2_client = auth_client(self.student2)

    def test_submit_text_response(self):
        r = self.student1_client.post('/api/v1/submissions/', {
            'assignment': str(self.assignment.pk),
            'text_response': 'My solution here',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Submission.objects.filter(student=self.student1, assignment=self.assignment).exists()
        )

    def test_submit_with_behavior_fields(self):
        r = self.student1_client.post('/api/v1/submissions/', {
            'assignment': str(self.assignment.pk),
            'text_response': 'Solution',
            'behavior_clipboard_changes': '3',
            'behavior_paste_count': '1',
            'behavior_paste_chars': '50',
            'behavior_keystrokes': '120',
            'behavior_tab_switches': '2',
            'behavior_gpt_score': '4',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        sub = Submission.objects.get(student=self.student1, assignment=self.assignment)
        self.assertEqual(sub.behavior_clipboard_changes, 3)
        self.assertEqual(sub.behavior_gpt_score, 4)

    def test_submit_file(self):
        fake_file = BytesIO(b'hello world content')
        fake_file.name = 'solution.txt'
        r = self.student1_client.post('/api/v1/submissions/', {
            'assignment': str(self.assignment.pk),
            'file': fake_file,
        }, format='multipart')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_submit_empty_fails(self):
        r = self.student1_client.post('/api/v1/submissions/', {
            'assignment': str(self.assignment.pk),
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_sees_only_own_submissions(self):
        Submission.objects.create(
            assignment=self.assignment,
            student=self.student1,
            text_response='s1 solution',
        )
        Submission.objects.create(
            assignment=self.assignment,
            student=self.student2,
            text_response='s2 solution',
        )
        r = self.student1_client.get('/api/v1/submissions/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        usernames = [s.get('student_username') for s in r.data]
        self.assertTrue(all(u == 'sub_student1' for u in usernames if u))

    def test_double_submit_allowed(self):
        for _ in range(2):
            self.student1_client.post('/api/v1/submissions/', {
                'assignment': str(self.assignment.pk),
                'text_response': 'attempt',
            })
        self.assertEqual(
            Submission.objects.filter(student=self.student1, assignment=self.assignment).count(),
            2,
        )

import json
import os
import uuid
from datetime import datetime, timezone

import pika
from django.conf import settings

from .rabbitmq_config import (
    CHECKER_DEPLOY_QUEUE,
    DEPLOY_EXCHANGE,
    DEPLOY_REQUEST_ROUTING_KEY,
    DEPLOY_RESULT_ROUTING_KEY,
    LABWORKS_RESULTS_QUEUE,
)


def _get_url():
    return getattr(settings, 'RABBITMQ_URL', os.environ.get('RABBITMQ_URL', ''))


def _connect():
    url = _get_url()
    if not url:
        raise RuntimeError('RABBITMQ_URL is not configured')
    return pika.BlockingConnection(pika.URLParameters(url))


def setup_topology(channel):
    channel.exchange_declare(exchange=DEPLOY_EXCHANGE, exchange_type='topic', durable=True)
    channel.queue_declare(queue=CHECKER_DEPLOY_QUEUE, durable=True)
    channel.queue_bind(queue=CHECKER_DEPLOY_QUEUE, exchange=DEPLOY_EXCHANGE, routing_key=DEPLOY_REQUEST_ROUTING_KEY)
    channel.queue_declare(queue=LABWORKS_RESULTS_QUEUE, durable=True)
    channel.queue_bind(queue=LABWORKS_RESULTS_QUEUE, exchange=DEPLOY_EXCHANGE, routing_key=DEPLOY_RESULT_ROUTING_KEY)


from .deploy_phases import DEPLOY_PHASE_QUEUED


def publish_deploy_request(submission, trigger: str = 'auto'):
    from .models import StudentDeployment

    student = submission.student
    group = student.student_groups.first()
    group_name = group.name if group else 'Без группы'
    public_base = getattr(settings, 'LABWORKS_PUBLIC_URL', 'http://localhost').rstrip('/')
    file_url = f'{public_base}/api/v1/internal/deploy/submissions/{submission.uuid}/file/'
    payload = {
        'event_id': str(uuid.uuid4()),
        'submission_uuid': str(submission.uuid),
        'assignment_uuid': str(submission.assignment_id),
        'student_id': student.id,
        'student_full_name': student.full_name,
        'group_name': group_name,
        'file_name': submission.file.name.split('/')[-1] if submission.file else '',
        'file_url': file_url,
        'trigger': trigger,
        'requested_at': datetime.now(timezone.utc).isoformat(),
    }

    from .services.deploy_status import checker_public_url

    checker_base = checker_public_url()
    deployment, _ = StudentDeployment.objects.get_or_create(student=student)
    deployment.status = DEPLOY_PHASE_QUEUED
    deployment.last_submission_uuid = submission.uuid
    deployment.deploy_url = ''
    deployment.deploy_snapshot = {
        'label': 'Подготовка',
        'hint': 'Скоро начнём публикацию вашего проекта на стенде',
        'progress': 12,
        'message': 'Подготовка',
        'messages': [{
            'text': 'Скоро начнём публикацию вашего проекта на стенде',
            'phase': 'queued',
            'kind': 'hint',
            'at': datetime.now(timezone.utc).isoformat(),
        }],
        'links': {
            'docs': f'{checker_base}/docs/',
            'panel': f'{checker_base}/deploy/panel/?submission_uuid={submission.uuid}&embed=1',
            'status_api': f'{checker_base}/api/deploy/status/',
        },
    }
    deployment.save(update_fields=['status', 'last_submission_uuid', 'deploy_url', 'deploy_snapshot', 'updated_at'])

    from .services.realtime import broadcast_deployment_update
    broadcast_deployment_update(deployment)

    connection = _connect()
    try:
        channel = connection.channel()
        setup_topology(channel)
        channel.basic_publish(
            exchange=DEPLOY_EXCHANGE,
            routing_key=DEPLOY_REQUEST_ROUTING_KEY,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2, content_type='application/json'),
        )
    finally:
        connection.close()

    return payload

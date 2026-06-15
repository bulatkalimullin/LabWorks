import json

from django.core.management.base import BaseCommand

from apps.laboratory.deploy_publisher import setup_topology
from apps.laboratory.models import StudentDeployment
from apps.laboratory.rabbitmq_config import LABWORKS_RESULTS_QUEUE
from apps.laboratory.deploy_publisher import _connect


class Command(BaseCommand):
    help = 'Consume deploy.result messages and update StudentDeployment records'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Listening for deploy results...'))
        connection = _connect()
        channel = connection.channel()
        setup_topology(channel)
        channel.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):
            self._handle_result(body)
            ch.basic_ack(delivery_tag=method.delivery_tag)

        channel.basic_consume(queue=LABWORKS_RESULTS_QUEUE, on_message_callback=callback)
        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            channel.stop_consuming()
        finally:
            connection.close()

    def _handle_result(self, body: bytes):
        data = json.loads(body)
        student_id = data.get('student_id')
        if not student_id:
            return
        deployment = StudentDeployment.objects.filter(student_id=student_id).first()
        if not deployment:
            deployment = StudentDeployment.objects.create(student_id=student_id)

        deployment.status = data.get('status', 'error')
        deployment.access_urls = data.get('public_urls') or []
        deployment.traceback = data.get('traceback') or ''
        deployment.public_base_url = data.get('public_base_url') or ''
        if data.get('submission_uuid'):
            deployment.last_submission_uuid = data['submission_uuid']
        deployment.checker_project_id = data.get('checker_project_id')
        deployment.save()
        self.stdout.write(f'Updated deployment for student {student_id}: {deployment.status}')

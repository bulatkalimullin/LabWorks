import json
import re

from django.core.management.base import BaseCommand
from apps.laboratory.deploy_publisher import setup_topology, _connect
from apps.laboratory.services.deploy_status import apply_checker_payload_to_deployment
from apps.laboratory.models import StudentDeployment
from apps.laboratory.rabbitmq_config import LABWORKS_RESULTS_QUEUE


class Command(BaseCommand):
    help = 'Consume deploy.result messages and update StudentDeployment records'

    @staticmethod
    def _sanitize_traceback(raw: str) -> str:
        text = (raw or '').strip()
        if not text:
            return ''
        if text.lstrip().startswith('<') or '<!doctype' in text.lower():
            match = re.search(r'<title>([^<]+)</title>', text, re.I)
            return f'HTML-ошибка: {match.group(1)}' if match else 'HTML-ошибка от checker'
        return text[:4000]

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

        apply_checker_payload_to_deployment(deployment, data)
        deployment.traceback = self._sanitize_traceback(
            data.get('error_details') or data.get('traceback') or data.get('docker_log') or '',
        )
        deployment.save()
        self.stdout.write(f'Updated deployment for student {student_id}: {deployment.status}')

        from apps.laboratory.services.realtime import broadcast_deployment_update
        broadcast_deployment_update(deployment)

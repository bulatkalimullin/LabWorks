import os

DEPLOY_EXCHANGE = os.environ.get('DEPLOY_EXCHANGE', 'labworks.deploy')
DEPLOY_REQUEST_ROUTING_KEY = 'deploy.request'
DEPLOY_RESULT_ROUTING_KEY = 'deploy.result'
CHECKER_DEPLOY_QUEUE = os.environ.get('CHECKER_DEPLOY_QUEUE', 'demo_exam_checker.deploy')
LABWORKS_RESULTS_QUEUE = os.environ.get('LABWORKS_RESULTS_QUEUE', 'labworks.deploy.results')

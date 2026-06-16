import { Rocket, AlertCircle } from 'lucide-react'
import DeploymentStatus, { type DeploymentInfo } from './DeploymentStatus'
import DeployDocsCard from './DeployDocsCard'
import { useDeploymentForStudent } from '../hooks/useDeploymentLive'
import { useDeployStatusPoll } from '../hooks/useDeployStatusPoll'
import {
  checkerPanelEmbedUrl,
  deploymentDocsUrl,
  isDeploymentInProgress,
  mergeDeploymentInfo,
  normalizeDeploymentInfo,
} from '../lib/deployStatus'

const PANEL_MODE = (import.meta.env.VITE_DEPLOY_PANEL_MODE as string | undefined) || 'custom'

const PENDING_DEPLOYMENT: DeploymentInfo = normalizeDeploymentInfo({
  phase: 'queued',
  status: 'pending',
  label: 'Подготовка',
  hint: 'Скоро начнём публикацию вашего проекта на стенде',
  progress: 12,
  access_urls: [],
})

type Props = {
  studentId?: number
  submissionUuid?: string | null
  fallback?: DeploymentInfo | null
  pending?: boolean
  submitError?: string | null
}

export default function StudentDeploymentPanel({
  studentId,
  submissionUuid,
  fallback,
  pending = false,
  submitError = null,
}: Props) {
  const live = useDeploymentForStudent(studentId)
  const shouldPoll = Boolean(
    submissionUuid && (pending || isDeploymentInProgress(live ?? fallback ?? null)),
  )
  const polled = useDeployStatusPoll(submissionUuid, shouldPoll)

  const deployment = mergeDeploymentInfo(
    mergeDeploymentInfo(live, polled),
    fallback ?? (pending ? PENDING_DEPLOYMENT : null),
  )

  const docsUrl = deploymentDocsUrl(deployment)
  const sessionKey = submissionUuid ?? deployment?.last_submission_uuid ?? null
  const useIframe = PANEL_MODE === 'iframe' && Boolean(submissionUuid)

  if (!deployment && !submitError && !useIframe) return null

  if (useIframe && submissionUuid) {
    return (
      <div className="glass deploy-panel deploy-panel--iframe">
        <iframe
          src={checkerPanelEmbedUrl(submissionUuid)}
          className="deploy-panel__iframe"
          title="Публикация проекта"
        />
      </div>
    )
  }

  return (
    <div className="glass deploy-panel">
      <div className="deploy-panel__head">
        <h3 className="deploy-panel__title">
          <Rocket size={18} aria-hidden />
          Публикация проекта
        </h3>
        <p className="deploy-panel__subtitle">
          После сдачи архив автоматически публикуется на тестовом стенде — прогресс и статусы обновляются здесь.
        </p>
      </div>

      {submitError && (
        <details className="deploy-status__submit-error" open>
          <summary>
            <AlertCircle size={16} aria-hidden />
            Ошибка при отправке работы
          </summary>
          <pre>{submitError}</pre>
        </details>
      )}

      {deployment && (
        <DeploymentStatus
          deployment={deployment}
          showProgress
          sessionKey={sessionKey}
        />
      )}

      <DeployDocsCard href={docsUrl} />
    </div>
  )
}

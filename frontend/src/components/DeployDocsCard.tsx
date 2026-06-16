import { BookOpen, ExternalLink, LifeBuoy } from 'lucide-react'

type Props = {
  href: string
  compact?: boolean
}

export default function DeployDocsCard({ href, compact = false }: Props) {
  return (
    <a
      className={`deploy-docs-card${compact ? ' deploy-docs-card--compact' : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span className="deploy-docs-card__icon-wrap" aria-hidden>
        <BookOpen size={20} />
      </span>
      <span className="deploy-docs-card__body">
        <span className="deploy-docs-card__title">Документация по деплою</span>
        <span className="deploy-docs-card__desc">
          Требования к архиву, порты, типичные ошибки и как проверить проект на стенде
        </span>
      </span>
      <span className="deploy-docs-card__cta">
        <LifeBuoy size={15} aria-hidden />
        <span>Открыть</span>
        <ExternalLink size={13} aria-hidden />
      </span>
    </a>
  )
}

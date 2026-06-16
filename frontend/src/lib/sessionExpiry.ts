const SESSION_TZ = 'Europe/Moscow'

type TokenPayload = {
  exp?: number
  session_exp?: number
  session_start?: number
  iat?: number
}

function parseTokenPayload(): TokenPayload | null {
  try {
    const token = localStorage.getItem('access')
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as TokenPayload
  } catch {
    return null
  }
}

function moscowCalendarDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-CA', { timeZone: SESSION_TZ })
}

/** Unix seconds when the session ends (fixed at login, not extended on refresh). */
export function getSessionExpUnix(): number | null {
  const payload = parseTokenPayload()
  if (!payload) return null
  const exp = payload.session_exp ?? payload.exp
  return typeof exp === 'number' ? exp : null
}

export function getSessionStartUnix(): number | null {
  const payload = parseTokenPayload()
  if (!payload) return null
  const start = payload.session_start ?? payload.iat
  return typeof start === 'number' ? start : null
}

export function formatSessionEnd(unixSeconds: number): string {
  const formatted = new Date(unixSeconds * 1000).toLocaleString('ru-RU', {
    timeZone: SESSION_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatted} (МСК)`
}

export function getSessionEndLabel(): string | null {
  const exp = getSessionExpUnix()
  if (exp === null) return null
  return formatSessionEnd(exp)
}

export function isSessionExpired(): boolean {
  const nowSec = Math.floor(Date.now() / 1000)

  const exp = getSessionExpUnix()
  if (exp !== null && nowSec >= exp) return true

  const start = getSessionStartUnix()
  if (start !== null && moscowCalendarDate(nowSec) > moscowCalendarDate(start)) {
    return true
  }

  return false
}

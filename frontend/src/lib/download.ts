/** Parse filename from Content-Disposition (RFC 5987 filename* + legacy filename). */
export function filenameFromContentDisposition(
  header: string | null,
  fallback = 'download',
): string {
  if (!header) return fallback

  const star = header.match(/filename\*=(?:UTF-8''|utf-8'')(.*?)(?:;|$)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      /* use fallback below */
    }
  }

  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]

  const plain = header.match(/filename=([^;\s]+)/i)
  if (plain?.[1]) return plain[1].replace(/^["']|["']$/g, '')

  return fallback
}

/**
 * Native browser download via same-origin link (streams file, no blob/memory limit).
 * API must accept ?access= JWT (JWTAuthHeaderOrQuery on backend).
 */
export function triggerNativeDownload(apiUrl: string, accessToken: string): void {
  const sep = apiUrl.includes('?') ? '&' : '?'
  const href = `${apiUrl}${sep}access=${encodeURIComponent(accessToken)}`
  const a = document.createElement('a')
  a.href = href
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 2000)
}

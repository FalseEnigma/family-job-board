const CONNECTION_ERROR_PATTERNS = ['Failed to fetch', 'NetworkError']

export function getFriendlyErrorMessage(raw: string | null): string | null {
  if (!raw) return null
  if (CONNECTION_ERROR_PATTERNS.some(p => raw.includes(p))) {
    return 'Connection error. Check your internet and try again.'
  }
  return raw
}

export function isConnectionError(msg: string | null): boolean {
  return !!msg && CONNECTION_ERROR_PATTERNS.some(p => msg.includes(p))
}

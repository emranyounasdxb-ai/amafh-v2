export type AuditRoute = { mode: 'list' } | { mode: 'detail'; id: string }
export function auditRouteFromPath(path: string): AuditRoute | null {
  if (path === '/administration/audit-log') return { mode: 'list' }
  const match = /^\/administration\/audit-log\/([^/]+)$/.exec(path)
  if (!match) return null
  try { return { mode: 'detail', id: decodeURIComponent(match[1]) } } catch { return null }
}

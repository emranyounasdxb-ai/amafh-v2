export type ApprovalRoute = { mode: 'list' } | { mode: 'create' } | { mode: 'detail' | 'edit'; id: string }
export function approvalRouteFromPath(path: string): ApprovalRoute | null {
  if (path === '/administration/approval-centre') return { mode: 'list' }
  if (path === '/administration/approval-centre/new') return { mode: 'create' }
  const match = /^\/administration\/approval-centre\/([^/]+?)(?:\/(edit))?$/.exec(path)
  if (!match) return null
  try { return { mode: match[2] ? 'edit' : 'detail', id: decodeURIComponent(match[1]) } } catch { return null }
}

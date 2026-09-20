export type CustomerRoute = { mode: 'list' } | { mode: 'detail' | 'edit'; id: string }
export function customerRouteFromPath(path: string): CustomerRoute | null {
  if (path === '/customers') return { mode: 'list' }
  const match = /^\/customers\/([^/]+?)(?:\/(edit))?$/.exec(path)
  if (!match || match[1] === 'new') return null
  try { return { mode: match[2] ? 'edit' : 'detail', id: decodeURIComponent(match[1]) } } catch { return null }
}
export const isCreateApplicationPath = (path: string) => path === '/applications/new'

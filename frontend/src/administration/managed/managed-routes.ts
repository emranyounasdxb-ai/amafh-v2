import type { ManagedConfig } from './managed-model'
export type ManagedRoute = { mode: 'list'; kind: string | null } | { mode: 'create'; kind: string } | { mode: 'detail' | 'edit'; kind: string; id: string }
export function managedRouteFromPath(config: ManagedConfig, path: string): ManagedRoute | null {
  const base = `/administration/${config.slug}`
  if (path === base) return { mode: 'list', kind: null }
  const tail = path.startsWith(`${base}/`) ? path.slice(base.length + 1).split('/') : []
  if (!config.kinds.some(kind => kind.id === tail[0])) return null
  if (tail.length === 1) return { mode: 'list', kind: tail[0] }
  if (tail.length === 2 && tail[1] === 'new') return { mode: 'create', kind: tail[0] }
  if (tail.length === 2 || tail.length === 3 && tail[2] === 'edit') {
    try { return { mode: tail.length === 3 ? 'edit' : 'detail', kind: tail[0], id: decodeURIComponent(tail[1]) } } catch { return null }
  }
  return null
}
export const managedTitle = (config: ManagedConfig, route: ManagedRoute) => {
  const kind = config.kinds.find(item => item.id === route.kind)
  return route.mode === 'create' ? `Create ${kind?.singular}` : route.mode === 'edit' ? `Edit ${kind?.singular}` : route.mode === 'detail' ? `${kind?.singular} detail` : kind?.label ?? config.label
}

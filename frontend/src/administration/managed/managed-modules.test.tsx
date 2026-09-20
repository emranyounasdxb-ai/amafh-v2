import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ManagedModule } from './managed-module'
import { managedRouteFromPath } from './managed-routes'
import { managedStorageKey, type ManagedRepository } from './managed-repository'
import { managedModules } from './registry'
import type { ManagedRecord } from './managed-model'

beforeEach(() => { localStorage.clear(); Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } }); Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } }) })
afterEach(() => { cleanup(); delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal; delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close })

for (const { config, repository } of managedModules) {
  test(`${config.label}: validation, persistence, delete and malformed local data`, async () => {
    const records = await repository.list()
    const kind = config.kinds[0]
    const draft = { kind: kind.id, name: `New ${kind.singular}`, description: 'Local description.', status: 'active' as const, parentId: '', extra: kind.extraLabel ? 'Local value' : '' }
    const created = await repository.create(draft)
    expect((await repository.list()).find(item => item.id === created.id)).toBeTruthy()
    await expect(repository.create({ ...draft, name: ` new   ${kind.singular.toUpperCase()} ` })).rejects.toThrow()
    const updated = await repository.update(created.id, { ...draft, name: `Updated ${kind.singular}`, status: 'inactive' })
    expect(updated.status).toBe('inactive')
    await repository.remove(created.id)
    expect((await repository.list()).some(item => item.id === created.id)).toBe(false)
    if (config.kinds.some(item => item.parentKind)) {
      await expect(repository.remove(records[0].id)).rejects.toThrow(/related record depends/)
      expect((await repository.list()).some(item => item.parentId === records[0].id)).toBe(true)
    }
    localStorage.setItem(managedStorageKey(config.slug), JSON.stringify({ version: 1, records: [] }))
    expect(await repository.list()).toEqual([])
    localStorage.setItem(managedStorageKey(config.slug), '{broken')
    await expect(repository.list()).rejects.toThrow(/could not be read/)
    expect(managedRouteFromPath(config, `/administration/${config.slug}/${kind.id}/new`)).toEqual({ mode: 'create', kind: kind.id })
  })

  test(`${config.label}: loading, empty and recoverable error states`, async () => {
    let resolve!: (items: ManagedRecord[]) => void
    const stub = (list: ManagedRepository['list']): ManagedRepository => ({ list, create: vi.fn(), update: vi.fn(), remove: vi.fn() })
    const { unmount } = render(<ManagedModule config={config} route={{ mode: 'list', kind: null }} onNavigate={vi.fn()} repository={stub(() => new Promise(result => { resolve = result }))} />)
    expect(screen.getByText('Loading records')).toBeTruthy()
    resolve([])
    expect(await screen.findByText('Nothing here yet')).toBeTruthy()
    unmount()
    render(<ManagedModule config={config} route={{ mode: 'list', kind: null }} onNavigate={vi.fn()} repository={stub(vi.fn().mockRejectedValue(new Error('Unavailable')))} />)
    expect(await screen.findByText('Could not load records')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
}

test('Banks & Products: blocked parent deletion is explained in confirmation', async () => {
  const { config, repository } = managedModules[0]
  const parent = (await repository.list())[0]
  render(<ManagedModule config={config} route={{ mode: 'detail', kind: parent.kind, id: parent.id }} onNavigate={vi.fn()} repository={repository} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Bank' }))
  expect(screen.getByText(/Cannot delete Sample Bank: 1 related record depends/)).toBeTruthy()
  expect((screen.getByRole('button', { name: /^Delete$/ }) as HTMLButtonElement).disabled).toBe(true)
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
})

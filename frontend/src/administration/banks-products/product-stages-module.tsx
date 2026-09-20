import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { SelectField } from '../../components/ui/select-field'
import { TextField } from '../../components/ui/text-field'
import { WorkspaceState } from '../../components/feedback/workspace-state'
import { ConfirmationDialog, FormSection } from '../../patterns/shared-patterns'
import { banksProductsRepository } from './banks-products'
import { productStagesRepository, type ProductStageDraft, type ProductStageRecord } from './product-stages'
import { apiProductStagesRepository } from './api-product-stages'
import { loadApiCatalogue } from '../../customers/api-customer-repository'
import { usePermissionPreview } from '../../operations/permissions'
import { mockUsersRepository } from '../users/mock-users-repository'
import type { UserRecord } from '../users/users-model'
import { mockUserTypesRepository } from '../user-types/mock-user-types-repository'
import type { UserTypeRecord } from '../user-types/user-types-model'
import { mockPermissionsRepository } from '../permissions/mock-permissions-repository'
import type { PermissionRecord } from '../permissions/permissions-model'
import { CASE_PREVIEW_ACTOR_KEY, caseActionAllowed } from '../../cases/case-permissions'
import './product-stages.css'

const emptyDraft = (): ProductStageDraft => ({ name: '', expectedDurationHours: 24, status: 'active' })
const apiMode = import.meta.env.MODE !== 'test' && import.meta.env.VITE_AUTH_PROVIDER !== 'mock'
export function ProductStagesModule({ productId }: { productId: string }) {
  const preview = usePermissionPreview()
  const repository = apiMode ? apiProductStagesRepository : productStagesRepository
  const [productName, setProductName] = useState('')
  const [stages, setStages] = useState<ProductStageRecord[]>([])
  const [usedIds, setUsedIds] = useState<string[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [types, setTypes] = useState<UserTypeRecord[]>([])
  const [permissions, setPermissions] = useState<PermissionRecord[]>([])
  const [actorId, setActorId] = useState(() => sessionStorage.getItem(CASE_PREVIEW_ACTOR_KEY) ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductStageDraft>(emptyDraft)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [catalogue, stageRecords, userRecords, typeRecords, permissionRecords] = await Promise.all([apiMode ? loadApiCatalogue() : banksProductsRepository.list(), repository.list(productId), apiMode ? Promise.resolve([]) : mockUsersRepository.list(), apiMode ? Promise.resolve([]) : mockUserTypesRepository.list(), apiMode ? Promise.resolve([]) : mockPermissionsRepository.list()])
      const product = catalogue.find(item => item.id === productId && item.kind === 'products')
      if (!product) throw new Error('Product was not found.')
      setProductName(product.name); setStages(stageRecords); setUsedIds((await Promise.all(stageRecords.map(async item => await repository.isUsed(item.id) ? item.id : ''))).filter(Boolean))
      setUsers(userRecords); setTypes(typeRecords); setPermissions(permissionRecords)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load Product Stages.') }
    finally { setLoading(false) }
  }, [productId])
  useEffect(() => { void reload() }, [reload])
  const allowed = (action: string) => apiMode ? preview.can('Cases', action) : caseActionAllowed(action, actorId, users, types, permissions)
  const selected = stages.find(item => item.id === editing)
  const permitted = !selected ? allowed('add-stage') : (draft.name.trim() === selected.name || allowed('edit-stage')) && (draft.status === selected.status || allowed('activate-stage')) && (Number(draft.expectedDurationHours) === selected.expectedDurationHours || allowed('set-stage-duration'))
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true); setActionError('')
    try { await operation(); setEditing(null); setDeleting(null); setDraft(emptyDraft()); await reload() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not update Product Stages.') }
    finally { setBusy(false) }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!permitted) { setActionError('Assign the required Product Stage actions to this User Type in Administration → Permissions.'); return }
    void run(() => selected ? repository.update(selected.id, { ...draft, expectedDurationHours: Number(draft.expectedDurationHours) }, actorId) : repository.create(productId, { ...draft, expectedDurationHours: Number(draft.expectedDurationHours) }, actorId))
  }
  if (loading) return <WorkspaceState kind="loading" title="Loading Product Stages" />
  if (error) return <WorkspaceState kind="error" title="Could not load Product Stages" description={error} action={<Button onClick={() => { void reload() }}>Try again</Button>} />
  return <div className="amafh-product-stages">
    <FormSection title={`${productName} · Product Stages`} description="Sequence and Expected Duration are configured for this Product. Existing Case timing keeps its stage-entry snapshot.">
      {!apiMode && <div className="amafh-case-actor"><SelectField label="Acting user (local permission preview)" value={actorId} onValueChange={id => { setActorId(id); sessionStorage.setItem(CASE_PREVIEW_ACTOR_KEY, id); setActionError('') }} options={users.filter(item => item.status === 'active').map(item => ({ value: item.id, label: `${item.fullName} · ${item.userType}` }))} /><p>Stage actions require separately assigned Case permissions. Selecting a user does not grant any action.</p></div>}
      {actionError && <p role="alert" className="amafh-case-error">{actionError}</p>}
      {stages.length === 0 ? <WorkspaceState kind="empty" title="No Product Stages" description="Add the first Stage for this Product." /> : <ol className="amafh-product-stages__list">{stages.map((stage, index) => {
        const used = usedIds.includes(stage.id)
        return <li key={stage.id}><div><strong>{stage.sequence}. {stage.name}</strong> <Badge tone={stage.status === 'active' ? 'success' : 'neutral'}>{stage.status === 'active' ? 'Active' : 'Inactive'}</Badge>{used && <Badge tone="info">Used by Case</Badge>}<p>Expected Duration: {stage.expectedDurationHours} hours</p></div><div className="amafh-product-stages__actions">
          {allowed('reorder-stage') && <><Button variant="secondary" size="compact" disabled={busy || index === 0 || used || usedIds.includes(stages[index - 1]?.id)} onClick={() => { void run(() => repository.move(stage.id, -1, actorId)) }}>Move up</Button><Button variant="secondary" size="compact" disabled={busy || index === stages.length - 1 || used || usedIds.includes(stages[index + 1]?.id)} onClick={() => { void run(() => repository.move(stage.id, 1, actorId)) }}>Move down</Button></>}
          {(allowed('edit-stage') || allowed('set-stage-duration') || allowed('activate-stage')) && <Button variant="secondary" size="compact" onClick={() => { setEditing(stage.id); setDraft({ name: stage.name, expectedDurationHours: stage.expectedDurationHours, status: stage.status }); setActionError('') }}>Edit Stage</Button>}
          {allowed('delete-stage') && <Button variant="danger" size="compact" disabled={used} onClick={() => setDeleting(stage.id)}>Delete Stage</Button>}
        </div></li>
      })}</ol>}
    </FormSection>
    {(allowed('add-stage') || editing) && <form noValidate onSubmit={submit}><FormSection title={selected ? `Edit ${selected.name}` : 'Add Stage'} description={selected && usedIds.includes(selected.id) ? 'This Stage is used by a Case. Its name and state are protected; Expected Duration changes apply only to future entries.' : undefined}><div className="amafh-product-stages__fields"><TextField label="Stage Name" value={draft.name} disabled={Boolean(selected && usedIds.includes(selected.id)) || Boolean(selected && !allowed('edit-stage'))} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} required /><TextField label="Expected Duration (hours)" type="number" min="0.01" step="any" value={draft.expectedDurationHours} disabled={Boolean(selected && !allowed('set-stage-duration'))} onChange={event => setDraft(current => ({ ...current, expectedDurationHours: Number(event.target.value) }))} required /><SelectField label="Stage State" value={draft.status} disabled={Boolean(selected && (usedIds.includes(selected.id) || !allowed('activate-stage')))} onValueChange={status => setDraft(current => ({ ...current, status: status as ProductStageDraft['status'] }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div><div className="amafh-product-stages__actions"><Button type="submit" disabled={!permitted} loading={busy}>{selected ? 'Save Stage' : 'Add Stage'}</Button>{selected && <Button variant="secondary" onClick={() => { setEditing(null); setDraft(emptyDraft()) }}>Cancel</Button>}</div></FormSection></form>}
    <ConfirmationDialog open={Boolean(deleting)} title="Delete Product Stage" description="Delete this unused Stage? Existing Case history is never rewritten." confirmLabel="Delete" danger pending={busy} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting && allowed('delete-stage')) void run(() => repository.remove(deleting, actorId)) }} />
  </div>
}

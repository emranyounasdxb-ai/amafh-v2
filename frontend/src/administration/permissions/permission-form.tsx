import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { Checkbox, Switch } from '../../components/ui/selection'
import { SelectField } from '../../components/ui/select-field'
import { TextareaField } from '../../components/ui/text-field'
import { FormSection } from '../../patterns/shared-patterns'
import type { UserTypeRecord } from '../user-types/user-types-model'
import { emptyPermissionDraft, permissionDomains, validatePermissionDraft, type PermissionDraft, type PermissionErrors, type PermissionRecord } from './permissions-model'

export function PermissionForm({ initial, records, types, editingId, onSave, onCancel }: { initial?: PermissionDraft; records: PermissionRecord[]; types: UserTypeRecord[]; editingId?: string; onSave: (draft: PermissionDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<PermissionDraft>(() => initial ?? emptyPermissionDraft())
  const [errors, setErrors] = useState<PermissionErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const update = <K extends keyof PermissionDraft>(key: K, value: PermissionDraft[K]) => { setDraft(current => ({ ...current, [key]: value })); setErrors({}); setSaveError('') }
  const domain = permissionDomains.find(item => item.name === draft.domain)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const next = validatePermissionDraft(draft, records, types, editingId)
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    setSaveError('')
    try { await onSave(draft) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save the permission.') }
    finally { setPending(false) }
  }
  return <form className="amafh-permissions-form" noValidate onSubmit={event => { void submit(event) }}>
    <FormSection title="Permission definition" description="Define an action right for a module. This local configuration does not enforce access."><div className="amafh-permissions-form__fields">
      <SelectField label="Domain" value={draft.domain} onValueChange={value => { setDraft(current => ({ ...current, domain: value, action: '' })); setErrors({}); setSaveError('') }} options={permissionDomains.map(item => ({ value: item.name, label: item.name }))} error={errors.domain} required />
      <SelectField label="Action" value={draft.action} onValueChange={value => update('action', value)} options={(domain?.actions ?? []).map(action => ({ value: action, label: action[0].toUpperCase() + action.slice(1) }))} error={errors.action} disabled={!domain} required />
      <TextareaField label="Description" value={draft.description} onChange={event => update('description', event.target.value)} error={errors.description} className="amafh-permissions-form__wide" required />
      <div className="amafh-permissions-form__wide"><Switch label="Enabled" checked={draft.enabled} onChange={event => update('enabled', event.target.checked)} />{errors.enabled && <p role="alert" className="amafh-permissions-form__error">{errors.enabled}</p>}</div>
    </div></FormSection>
    <FormSection title="User Type assignment" description="Action rights are assigned to User Types. Data scope and visibility are configured separately.">
      <div className="amafh-permissions-form__types">{types.length ? types.map(type => <Checkbox key={type.id} label={`${type.name} (${type.status})`} checked={draft.userTypeIds.includes(type.id)} onChange={event => update('userTypeIds', event.target.checked ? [...draft.userTypeIds, type.id] : draft.userTypeIds.filter(id => id !== type.id))} />) : <p>No User Types are available.</p>}</div>
      {errors.userTypeIds && <p role="alert" className="amafh-permissions-form__error">{errors.userTypeIds}</p>}
    </FormSection>
    {Object.keys(errors).length > 0 && <p className="amafh-permissions-form__error" role="alert">Check the highlighted fields.</p>}
    {saveError && <p className="amafh-permissions-form__error" role="alert">{saveError}</p>}
    <div className="amafh-permissions-form__actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : 'Create Permission'}</Button></div>
  </form>
}

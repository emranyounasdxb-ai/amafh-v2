import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { TextField, TextareaField } from '../../components/ui/text-field'
import { FormSection } from '../../patterns/shared-patterns'
import { emptyOrganizationDraft, kindDefinition, validateOrganizationDraft, type OrganizationDraft, type OrganizationErrors, type OrganizationKind, type OrganizationRecord } from './organization-model'

export function OrganizationForm({ kind, initial, records, editingId, onSave, onCancel }: { kind: OrganizationKind; initial?: OrganizationDraft; records: OrganizationRecord[]; editingId?: string; onSave: (draft: OrganizationDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<OrganizationDraft>(() => initial ?? emptyOrganizationDraft(kind))
  const [errors, setErrors] = useState<OrganizationErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const definition = kindDefinition(kind)
  const parents = records.filter(item => (definition.parents as readonly string[]).includes(item.kind))
  const update = <K extends keyof OrganizationDraft>(key: K, value: OrganizationDraft[K]) => { setDraft(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: undefined })); setSaveError('') }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const next = validateOrganizationDraft(draft, records, editingId)
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true); setSaveError('')
    try { await onSave(draft) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save the organization record.') }
    finally { setPending(false) }
  }
  return <form className="amafh-organization-form" noValidate onSubmit={event => { void submit(event) }}>
    <FormSection title={`${definition.singular} details`} description="Structure and relationships only; these records do not control user access."><div className="amafh-organization-form__fields">
      <TextField label="Name" value={draft.name} onChange={event => update('name', event.target.value)} error={errors.name} required />
      <SelectField label="Status" value={draft.status} onValueChange={value => update('status', value as OrganizationDraft['status'])} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} error={errors.status} required />
      {definition.parents.length > 0 && <SelectField label="Parent" value={draft.parentId} onValueChange={value => update('parentId', value)} options={parents.map(item => ({ value: item.id, label: `${item.name} · ${kindDefinition(item.kind).singular}` }))} placeholder="Select parent" error={errors.parentId} required />}
      <TextareaField label="Description" value={draft.description} onChange={event => update('description', event.target.value)} error={errors.description} className="amafh-organization-form__wide" required />
    </div></FormSection>
    {Object.keys(errors).length > 0 && <p className="amafh-organization-form__error" role="alert">Check the highlighted fields.</p>}
    {saveError && <p className="amafh-organization-form__error" role="alert">{saveError}</p>}
    <div className="amafh-organization-form__actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : `Create ${definition.singular}`}</Button></div>
  </form>
}

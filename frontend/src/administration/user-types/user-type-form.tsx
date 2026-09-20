import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { TextField, TextareaField } from '../../components/ui/text-field'
import { FormSection } from '../../patterns/shared-patterns'
import { emptyUserTypeDraft, validateUserTypeDraft, type UserTypeDraft, type UserTypeErrors, type UserTypeRecord } from './user-types-model'

export function UserTypeForm({ initial, types, editingId, assignedCount = 0, onSave, onCancel }: { initial?: UserTypeDraft; types: UserTypeRecord[]; editingId?: string; assignedCount?: number; onSave: (draft: UserTypeDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<UserTypeDraft>(() => initial ?? emptyUserTypeDraft())
  const [errors, setErrors] = useState<UserTypeErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const update = <K extends keyof UserTypeDraft>(key: K, value: UserTypeDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
    setSaveError('')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const nextErrors = validateUserTypeDraft(draft, types, editingId, assignedCount)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setPending(true)
    setSaveError('')
    try { await onSave(draft) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save the user type.') }
    finally { setPending(false) }
  }

  return <form className="amafh-user-types-form" noValidate onSubmit={event => { void submit(event) }}>
    <FormSection title="User Type details" description="Labels and status only; no permissions are configured here."><div className="amafh-user-types-form__fields">
      <TextField label="Name" value={draft.name} onChange={event => update('name', event.target.value)} error={errors.name} helperText={assignedCount > 0 ? 'Name cannot change while users are assigned.' : undefined} disabled={assignedCount > 0} required />
      <SelectField label="Status" value={draft.status} onValueChange={value => update('status', value as UserTypeDraft['status'])} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} error={errors.status} required />
      <TextareaField label="Description" value={draft.description} onChange={event => update('description', event.target.value)} error={errors.description} className="amafh-user-types-form__wide" required />
    </div></FormSection>
    {Object.keys(errors).length > 0 && <p className="amafh-user-types-form__error" role="alert">Check the highlighted fields.</p>}
    {saveError && <p className="amafh-user-types-form__error" role="alert">{saveError}</p>}
    <div className="amafh-user-types-form__actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : 'Create User Type'}</Button></div>
  </form>
}

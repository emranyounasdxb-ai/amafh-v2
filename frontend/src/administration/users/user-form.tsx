import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/button'
import { SelectField } from '../../components/ui/select-field'
import { TextField } from '../../components/ui/text-field'
import { FormSection } from '../../patterns/shared-patterns'
import { departmentOptions, emptyUserDraft, officeOptions, organizationOptions, scopeOptions, teamOptions, userTypeOptions, validateUserDraft, type UserDraft, type UserErrors, type UserRecord } from './users-model'

const options = (values: string[]) => values.map(value => ({ value, label: value }))

export function UserForm({ initial, users, editingId, onSave, onCancel }: { initial?: UserDraft; users: UserRecord[]; editingId?: string; onSave: (draft: UserDraft) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<UserDraft>(() => initial ?? emptyUserDraft())
  const [errors, setErrors] = useState<UserErrors>({})
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(false)
  const update = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
    setSaveError('')
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const nextErrors = validateUserDraft(draft, users, editingId)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setPending(true)
    setSaveError('')
    try { await onSave(draft) }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save the user.') }
    finally { setPending(false) }
  }

  return <form className="amafh-users-form" noValidate onSubmit={event => { void submit(event) }}>
    <FormSection title="Identity"><div className="amafh-users-form__grid">
      <TextField label="Full name" value={draft.fullName} onChange={event => update('fullName', event.target.value)} error={errors.fullName} required autoComplete="name" />
      <TextField label="Email" type="email" value={draft.email} onChange={event => update('email', event.target.value)} error={errors.email} required autoComplete="email" />
      <SelectField label="Status" value={draft.status} onValueChange={value => update('status', value as UserDraft['status'])} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      <SelectField label="User Type" value={draft.userType} onValueChange={value => update('userType', value)} options={options(userTypeOptions)} placeholder="Select user type" error={errors.userType} required />
      <SelectField label="Reporting Manager" value={draft.reportingManagerId || 'none'} onValueChange={value => update('reportingManagerId', value === 'none' ? '' : value)} options={[{ value: 'none', label: 'None' }, ...users.filter(user => user.id !== editingId).map(user => ({ value: user.id, label: user.fullName }))]} error={errors.reportingManagerId} />
    </div></FormSection>
    <FormSection title="Organization assignment" description="Local assignment details only; no access rules are applied."><div className="amafh-users-form__grid">
      <SelectField label="Organization" value={draft.organization} onValueChange={value => update('organization', value)} options={options(organizationOptions)} placeholder="Select organization" error={errors.organization} required />
      <SelectField label="Organization Scope" value={draft.organizationScope} onValueChange={value => update('organizationScope', value as UserDraft['organizationScope'])} options={scopeOptions} placeholder="Select scope" error={errors.organizationScope} required />
      <SelectField label="Office / Branch" value={draft.officeBranch} onValueChange={value => update('officeBranch', value)} options={options(officeOptions)} placeholder="Select office or branch" error={errors.officeBranch} />
      <SelectField label="Department" value={draft.department} onValueChange={value => update('department', value)} options={options(departmentOptions)} placeholder="Select department" error={errors.department} />
      <SelectField label="Team" value={draft.team} onValueChange={value => update('team', value)} options={options(teamOptions)} placeholder="Select team" error={errors.team} />
    </div></FormSection>
    {Object.keys(errors).length > 0 && <p className="amafh-users-form__error" role="alert">Check the highlighted fields.</p>}
    {saveError && <p className="amafh-users-form__error" role="alert">{saveError}</p>}
    <div className="amafh-users-form__actions"><Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{editingId ? 'Save changes' : 'Create User'}</Button></div>
  </form>
}

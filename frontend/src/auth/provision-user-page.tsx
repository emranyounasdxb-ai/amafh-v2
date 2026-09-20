import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { TextField } from '../components/ui/text-field'
import { SelectField } from '../components/ui/select-field'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { Workspace } from '../templates/workspace'
import { FormSection } from '../patterns/shared-patterns'

type UserTypeOption = { id: string; name: string }
type Unit = { id: string; kind: string; name: string; parent_id: string | null; active: boolean }

export function ProvisionUserPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [types, setTypes] = useState<UserTypeOption[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [userTypeId, setUserTypeId] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [scope, setScope] = useState('organization')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let live = true
    void fetch('/api/v1/auth/user-types', { credentials: 'include' }).then(async response => {
      if (!response.ok) throw new Error(response.status === 403 ? 'Users: create permission is required.' : 'Could not load user types.')
      return response.json() as Promise<UserTypeOption[]>
    }).then(value => { if (live) setTypes(value) }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'Could not load user types.') }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    let live = true
    void fetch('/api/v1/organization', { credentials: 'include' }).then(async response => response.ok ? await response.json() as Unit[] : []).then(value => { if (live) setUnits(value.filter(unit => unit.active)) }).catch(() => { if (live) setUnits([]) })
    return () => { live = false }
  }, [])

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || !userTypeId) return
    setPending(true); setError(''); setLink('')
    try {
      const response = await fetch('/api/v1/auth/users', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: name, email, user_type_id: userTypeId, organization_id: organizationId || null, office_id: officeId || null, department_id: departmentId || null, team_id: teamId || null, organization_scope: scope }) })
      if (!response.ok) throw new Error(response.status === 409 ? 'Email is already assigned.' : response.status === 403 ? 'Users: create permission is required.' : 'Could not create the user account.')
      const result: { setup_url: string } = await response.json()
      if (!result.setup_url.startsWith('/set-password?token=')) throw new Error('Could not read the setup link.')
      setLink(`${window.location.origin}${result.setup_url}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the user account.') }
    finally { setPending(false) }
  }

  return <Workspace title="Create user account" breadcrumb={<Breadcrumb items={[{ label: 'Administration', href: '/administration/users' }, { label: 'Create user account' }]} />}>
    <FormSection title="New account" description="The account stays inactive until the user sets their own password through the one-time link.">
      {loading ? <p role="status">Loading user types…</p> : types.length === 0 && !error ? <p>No active user types are available.</p> : null}
      {!loading && types.length > 0 && <form onSubmit={event => { void create(event) }}>
        <TextField label="Full name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} />
        <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} />
        <SelectField label="User Type" value={userTypeId} onValueChange={setUserTypeId} options={types.map(type => ({ value: type.id, label: type.name }))} placeholder="Select user type" required />
        {units.length > 0 && <>
          <SelectField label="Organization" value={organizationId} onValueChange={value => { setOrganizationId(value); setOfficeId(''); setDepartmentId(''); setTeamId(''); setScope('organization') }} options={units.filter(unit => unit.kind === 'organizations').map(unit => ({ value: unit.id, label: unit.name }))} placeholder="Select organization" />
          {organizationId && <SelectField label="Office / Branch" value={officeId} onValueChange={value => { setOfficeId(value); setDepartmentId(''); setTeamId(''); setScope('organization') }} options={units.filter(unit => unit.kind === 'offices' && unit.parent_id === organizationId).map(unit => ({ value: unit.id, label: unit.name }))} placeholder="Select office or branch" />}
          {officeId && <SelectField label="Department" value={departmentId} onValueChange={value => { setDepartmentId(value); setTeamId(''); setScope('organization') }} options={units.filter(unit => unit.kind === 'departments' && unit.parent_id === officeId).map(unit => ({ value: unit.id, label: unit.name }))} placeholder="Select department" />}
          {departmentId && <SelectField label="Team" value={teamId} onValueChange={value => { setTeamId(value); setScope('organization') }} options={units.filter(unit => unit.kind === 'teams' && unit.parent_id === departmentId).map(unit => ({ value: unit.id, label: unit.name }))} placeholder="Select team" />}
          {organizationId && <SelectField label="Organization Scope" value={scope} onValueChange={setScope} options={[{ value: 'organization', label: 'Organization' }, ...(officeId ? [{ value: 'office', label: 'Office / Branch' }] : []), ...(departmentId ? [{ value: 'department', label: 'Department' }] : []), ...(teamId ? [{ value: 'team', label: 'Team' }] : [])]} />}
        </>}
        <Button type="submit" loading={pending} disabled={!userTypeId || Boolean(link)}>Create account and setup link</Button>
      </form>}
      {link && <><p role="status">Account created. Share this link with the user. It expires after 30 minutes.</p><TextField label="One-time setup link" value={link} readOnly onFocus={event => event.currentTarget.select()} /></>}
      {error && <p role="alert">{error}</p>}
      <Button variant="secondary" onClick={() => onNavigate('/administration/users')}>Back to Users</Button>
    </FormSection>
  </Workspace>
}

import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { TextField } from '../components/ui/text-field'
import { SelectField } from '../components/ui/select-field'
import { ConfirmationDialog, FormSection } from '../patterns/shared-patterns'
import { apiFinanceRepository } from './api-finance'
import type { IncentiveRule } from './finance'

type Draft = Omit<IncentiveRule, 'id' | 'createdAt' | 'updatedAt'>
const blank = (): Draft => ({ name: '', metric: '', targetValue: 0, amount: 0, active: true })

export function IncentiveRulesPanel({ rules, canManage, onChange }: {
  rules: IncentiveRule[]; canManage: boolean; onChange: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(blank)
  const [editingId, setEditingId] = useState('')
  const [deleteId, setDeleteId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManage || busy) return
    setBusy(true); setError('')
    try {
      await apiFinanceRepository.saveIncentiveRule(draft, editingId || undefined)
      setDraft(blank()); setEditingId('')
      await onChange()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save Incentive Rule.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!deleteId || !canManage || busy) return
    setBusy(true); setError('')
    try { await apiFinanceRepository.removeIncentiveRule(deleteId); setDeleteId(''); await onChange() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete Incentive Rule.') }
    finally { setBusy(false) }
  }
  return <FormSection title="Incentive Rules" description="Target and amount are configured in a Rule, then captured on each Incentive record.">
    {error && <p role="alert" className="amafh-case-error">{error}</p>}
    {canManage && <form onSubmit={event => { void save(event) }} className="amafh-ops-grid">
      <div className="amafh-ops-fields">
        <TextField label="Rule Name" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required />
        <TextField label="Rule Metric" value={draft.metric} onChange={event => setDraft({ ...draft, metric: event.target.value })} required />
        <TextField label="Rule Target" type="number" value={String(draft.targetValue)} onChange={event => setDraft({ ...draft, targetValue: Number(event.target.value) })} required />
        <TextField label="Rule Amount" type="number" value={String(draft.amount)} onChange={event => setDraft({ ...draft, amount: Number(event.target.value) })} required />
        <SelectField label="Rule State" value={draft.active ? 'active' : 'inactive'} onValueChange={value => setDraft({ ...draft, active: value === 'active' })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </div>
      <div className="amafh-ops-actions"><Button type="submit" loading={busy}>{editingId ? 'Update Incentive Rule' : 'Add Incentive Rule'}</Button>{editingId && <Button variant="secondary" onClick={() => { setEditingId(''); setDraft(blank()) }}>Cancel</Button>}</div>
    </form>}
    {rules.length ? <ul>{rules.map(rule => <li key={rule.id} className="amafh-ops-actions"><strong>{rule.name}</strong><span>{rule.metric} · target {rule.targetValue} · amount {rule.amount} · {rule.active ? 'Active' : 'Inactive'}</span>{canManage && <><Button variant="secondary" size="compact" onClick={() => { setEditingId(rule.id); setDraft({ name: rule.name, metric: rule.metric, targetValue: rule.targetValue, amount: rule.amount, active: rule.active }) }}>Edit Rule</Button><Button variant="danger" size="compact" onClick={() => setDeleteId(rule.id)}>Delete Rule</Button></>}</li>)}</ul> : <p>No Incentive Rules yet.</p>}
    <ConfirmationDialog open={Boolean(deleteId)} title="Delete Incentive Rule" description="Delete this unused Rule?" confirmLabel="Delete" danger pending={busy} onClose={() => setDeleteId('')} onConfirm={() => { void remove() }} />
  </FormSection>
}

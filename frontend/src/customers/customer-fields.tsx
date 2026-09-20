import { TextField } from '../components/ui/text-field'
import type { CustomerDraft, CustomerErrors } from './customer-model'

export function CustomerFields({ draft, errors, onChange }: { draft: CustomerDraft; errors: CustomerErrors; onChange: (draft: CustomerDraft) => void }) {
  const field = (key: string, label: string, value: string, type = 'text') => <TextField key={key} label={label} type={type} value={value} onChange={event => onChange({ ...draft, [key]: event.target.value } as CustomerDraft)} error={errors[key]} required={key === 'fullName' || key === 'companyName'} />
  return <div className="amafh-customer-fields">{draft.type === 'individual' ? <>
    {field('emiratesId', 'Emirates ID', draft.emiratesId)}
    {field('passportNumber', 'Passport Number', draft.passportNumber)}
    {field('fullName', 'Full Name', draft.fullName)}
    {field('employer', 'Employer', draft.employer)}
    {field('mobile', 'Mobile', draft.mobile, 'tel')}
    {field('email', 'Email', draft.email, 'email')}
  </> : <>
    {field('companyName', 'Company Name', draft.companyName)}
    {field('contactPerson', 'Contact Person', draft.contactPerson)}
    {field('tradeLicense', 'Trade License', draft.tradeLicense)}
    {field('mobile', 'Mobile', draft.mobile, 'tel')}
    {field('email', 'Email', draft.email, 'email')}
  </>}</div>
}

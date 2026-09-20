import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { TextField, TextareaField } from '../components/ui/text-field'
import { FormWorkspace } from '../templates/workspace'
import { Slot, TemplateBreadcrumb } from './shared'

export function FormPage() {
  return <FormWorkspace title="Form" description="Form workspace template" breadcrumb={<TemplateBreadcrumb current="Form" />}
    aside={<Slot title="Form guidance"><p>Supporting guidance slot</p></Slot>}
    footer={<><Button variant="secondary" disabled>Cancel</Button><Button disabled>Save</Button></>}>
    <Card className="amafh-route-form"><h2>Form section</h2><div className="amafh-route-form__fields"><TextField label="Field one" placeholder="Enter value" /><TextField label="Field two" placeholder="Enter value" /><TextField label="Field three" placeholder="Enter value" /><TextField label="Field four" placeholder="Enter value" /><TextareaField label="Description" placeholder="Enter description" className="amafh-route-form__wide" /></div></Card>
  </FormWorkspace>
}

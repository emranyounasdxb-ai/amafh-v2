import { useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Tabs } from '../components/ui/tabs'
import { DetailWorkspace } from '../templates/page-templates'
import { Slot, TemplateBreadcrumb } from './shared'

export function DetailPage() {
  const [tab, setTab] = useState('overview')
  return <DetailWorkspace title="Record detail" description="Detail workspace template" breadcrumb={<TemplateBreadcrumb current="Detail" />}
    summary={<Slot title="Record summary"><Badge tone="success">Active</Badge><p>Record identity and status slot</p></Slot>}
    sections={<div className="amafh-route-tabs"><Tabs label="Detail sections" value={tab} onValueChange={setTab} items={['Overview', 'Related', 'Activity', 'History', 'Documents', 'Audit'].map(label => ({ id: label.toLowerCase(), label, content: <Slot title={`${label} section`}><div className="amafh-route-slot__placeholder" /></Slot> }))} /></div>}
    activity={<Slot title="Supporting information"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>} />
}

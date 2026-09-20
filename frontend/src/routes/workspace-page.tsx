import { useState } from 'react'
import { Tabs } from '../components/ui/tabs'
import { Workspace } from '../templates/workspace'
import { Slot, TemplateBreadcrumb } from './shared'

export function WorkspacePage() {
  const [tab, setTab] = useState('overview')
  return <Workspace title="Workspace" description="Application workspace template" breadcrumb={<TemplateBreadcrumb current="Workspace" />} supporting={<Slot title="Supporting content"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>}>
    <div className="amafh-route-tabs"><Tabs label="Workspace sections" value={tab} onValueChange={setTab} items={['Overview', 'Related', 'History'].map(label => ({ id: label.toLowerCase(), label, content: <div className="amafh-template-stack"><Slot title="Primary content"><div className="amafh-route-slot__placeholder" /></Slot><Slot title={`${label} content`}><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot></div> }))} /></div>
  </Workspace>
}

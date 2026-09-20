import { Workspace, DashboardGrid } from '../templates/workspace'
import { Slot, TemplateBreadcrumb } from './shared'

export function DashboardPage() {
  return <Workspace title="Dashboard" description="Dashboard grid template" breadcrumb={<TemplateBreadcrumb current="Dashboard" />}>
    <div className="amafh-route-dashboard"><DashboardGrid>
      {[1, 2, 3, 4].map(index => <Slot key={index} title={`KPI slot ${index}`} className="amafh-route-slot--kpi"><span>Metric placeholder</span></Slot>)}
      <Slot title="Primary widget slot 1" className="amafh-route-slot--widget"><div className="amafh-route-slot__placeholder" /></Slot>
      <Slot title="Primary widget slot 2" className="amafh-route-slot--widget"><div className="amafh-route-slot__placeholder" /></Slot>
      <Slot title="Activity slot"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>
      <Slot title="Tasks slot"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>
      <Slot title="Alerts slot"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>
      <Slot title="Recent data slot" className="amafh-route-slot--recent"><div className="amafh-route-slot__placeholder amafh-route-slot__placeholder--short" /></Slot>
    </DashboardGrid></div>
  </Workspace>
}

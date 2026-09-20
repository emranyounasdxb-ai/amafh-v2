import { useState } from 'react'
import { Plus } from 'lucide-react'
import { LayoutDashboard, Settings2 } from 'lucide-react'
import { Kpi } from '../components/analytics/kpi'
import { BarChart, DonutChart, LineChart, Progress } from '../components/analytics/chart'
import { ChartPanel, Ranking } from '../components/analytics/chart-patterns'
import { DatePicker, DateRangePicker } from '../components/calendar/date-picker'
import { DateTimePicker, MonthYearPicker, TwoMonthRangePicker } from '../components/calendar/calendar-variants'
import type { DateRangeValue } from '../components/calendar/date-picker'
import { ApplicationShell } from '../components/navigation/application-shell'
import { Breadcrumb } from '../components/navigation/breadcrumb'
import { DocumentList } from '../components/documents/document'
import { DataTable } from '../components/data-table/data-table'
import type { DataTableColumn } from '../components/data-table/data-table'
import { Alert } from '../components/feedback/alert'
import { WorkspaceState } from '../components/feedback/workspace-state'
import { FileItem } from '../components/files/file-item'
import { FileUpload } from '../components/files/file-upload'
import { FileOperation, FileOutputPreview } from '../components/files/file-operation'
import { Dialog } from '../components/overlays/dialog'
import { CommandPalette, ContextMenu, Dropdown, Popover, Tooltip } from '../components/overlays/floating'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { TextField, TextareaField } from '../components/ui/text-field'
import { SelectField } from '../components/ui/select-field'
import { ChoiceField } from '../components/ui/choice-field'
import { NumericField, SegmentedControl, Slider, Stepper } from '../components/ui/extended-controls'
import { Checkbox, Radio, Switch } from '../components/ui/selection'
import { Avatar } from '../components/ui/avatar'
import { Tabs } from '../components/ui/tabs'
import { DashboardGrid, Workspace } from '../templates/workspace'
import { ActivityTimeline, ApprovalPanel, DetailSection, FormSection, ProfileHeader, SearchToolbar } from '../patterns/shared-patterns'
import './showcase.css'

type SampleRow = { id: string; item: string; owner: string; status: string }
const rows: SampleRow[] = [
  { id: 'r1', item: 'Sample record A', owner: 'Team A', status: 'Active' },
  { id: 'r2', item: 'Sample record B', owner: 'Team B', status: 'Pending' },
  { id: 'r3', item: 'Sample record C', owner: 'Team C', status: 'Inactive' },
]
const columns: DataTableColumn<SampleRow>[] = [
  { id: 'item', header: 'Item', value: row => row.item },
  { id: 'owner', header: 'Owner', value: row => row.owner },
  { id: 'status', header: 'Status', value: row => row.status, cell: row => <Badge tone={row.status === 'Active' ? 'success' : row.status === 'Pending' ? 'warning' : 'neutral'}>{row.status}</Badge> },
]
const swatches = [
  ['Canvas', 'var(--amafh-color-bg-canvas)'], ['Surface', 'var(--amafh-color-bg-surface)'], ['Subtle', 'var(--amafh-color-bg-subtle)'],
  ['Brand', 'var(--amafh-color-bg-brand)'], ['Brand subtle', 'var(--amafh-color-bg-brand-subtle)'], ['Success', 'var(--amafh-color-bg-success)'], ['Warning', 'var(--amafh-color-bg-warning)'], ['Danger', 'var(--amafh-color-bg-danger)'],
]

export function DesignSystemShowcase() {
  const [name, setName] = useState('')
  const [overlay, setOverlay] = useState<'modal' | 'drawer' | 'palette' | null>(null)
  const [tab, setTab] = useState('overview')
  const [date, setDate] = useState('2026-09-19')
  const [range, setRange] = useState<DateRangeValue>({ start: '', end: '' })
  const [choice, setChoice] = useState('')
  const [multiple, setMultiple] = useState<string[]>(['one', 'two'])
  const [month, setMonth] = useState('2026-09')
  const [year, setYear] = useState('2026')
  const [dateTime, setDateTime] = useState({ date: '', time: '' })
  const [onlyActive, setOnlyActive] = useState(false)
  const [patternQuery, setPatternQuery] = useState('')
  const [numberValue, setNumberValue] = useState('1,250')
  const [currencyValue, setCurrencyValue] = useState('1,250.00')
  const [percentValue, setPercentValue] = useState('18')
  const [segment, setSegment] = useState('week')
  const [stepValue, setStepValue] = useState(10)
  const [sliderValue, setSliderValue] = useState(50)
  const choiceOptions = [{ value: 'one', label: 'Option one' }, { value: 'two', label: 'Option two' }, { value: 'three', label: 'Option three' }]
  return <Workspace title="AMAFH v2 design system" description="Development showcase of implemented shared UI." actions={<Button variant="primary" icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />}>Action</Button>}>
    <div className="amafh-showcase">
      <section><h2 className="amafh-h3">Typography</h2><p className="amafh-display">Display / Small</p><p className="amafh-h1">Heading / H1</p><p className="amafh-h2">Heading / H2</p><p className="amafh-body-lg">Body / Large · Clear interfaces help teams complete work.</p><p className="amafh-body">Body / Medium · Compact and readable.</p><p className="amafh-caption">Caption · Contextual details</p></section>
      <section><h2 className="amafh-h3">Colors</h2><div className="amafh-showcase__swatches">{swatches.map(([name, color]) => <div key={name}><div style={{ background: color }} /><span>{name}</span></div>)}</div></section>
      <section><h2 className="amafh-h3">Actions and states</h2><div className="amafh-showcase__row"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="danger">Danger</Button><Button disabled>Disabled</Button><Button loading>Loading</Button></div></section>
      <section><h2 className="amafh-h3">Overlays</h2><div className="amafh-showcase__row"><Button variant="secondary" onClick={() => setOverlay('modal')}>Open modal</Button><Button variant="outline" onClick={() => setOverlay('drawer')}>Open drawer</Button><Dropdown label="Actions" items={[{ id: 'one', label: 'Option one', onSelect: () => {} }, { id: 'two', label: 'Option two', onSelect: () => {} }]} /><ContextMenu label="Context actions" items={[{ id: 'inspect', label: 'Inspect', onSelect: () => {} }]}><Button variant="outline">Context actions</Button></ContextMenu><Button variant="outline" onClick={() => setOverlay('palette')}>Open command palette</Button><Popover title="Popover title" trigger={<Button variant="outline">Open popover</Button>}><p>Supporting information and controls.</p></Popover><Tooltip content="Helpful hint" trigger={<Button variant="secondary">Tooltip trigger</Button>} /></div><Dialog open={overlay === 'modal'} onClose={() => setOverlay(null)} title="Modal title" description="Explain the task, impact, and next step in concise language." actions={<><Button variant="secondary" onClick={() => setOverlay(null)}>Cancel</Button><Button onClick={() => setOverlay(null)}>Confirm</Button></>} /><Dialog open={overlay === 'drawer'} mode="drawer" onClose={() => setOverlay(null)} title="Drawer title" description="Supporting detail or a short task belongs here." /><CommandPalette open={overlay === 'palette'} onClose={() => setOverlay(null)} onApply={() => setOverlay(null)} /></section>
      <section><h2 className="amafh-h3">Forms</h2><div className="amafh-showcase__grid"><TextField label="Field label" placeholder="Enter value" value={name} onChange={event => setName(event.target.value)} /><TextField label="Validation error" defaultValue="Needs correction" error="Enter a valid value." /><TextField label="Disabled field" defaultValue="Unavailable" disabled /><TextareaField label="Notes" placeholder="Enter details" /><SelectField label="Select option" options={choiceOptions} /><ChoiceField label="Combobox" options={choiceOptions} value={choice} onValueChange={value => setChoice(String(value))} /><ChoiceField mode="autocomplete" label="Autocomplete" options={choiceOptions} value="" onValueChange={() => {}} /><ChoiceField mode="multi-select" label="Multi-select" options={choiceOptions} value={multiple} onValueChange={value => setMultiple(Array.isArray(value) ? value : [])} /><ChoiceField label="Loading choices" options={choiceOptions} value="" onValueChange={() => {}} loading /><DatePicker label="Date" value={date} onValueChange={setDate} /><DateRangePicker label="Date range" value={range} onValueChange={setRange} /><MonthYearPicker label="Month" mode="month" value={month} onValueChange={setMonth} /><MonthYearPicker label="Year" mode="year" value={year} onValueChange={setYear} /><DateTimePicker label="Date and time" value={dateTime} onValueChange={setDateTime} /><div><Checkbox label="Checkbox" defaultChecked /><Radio label="Radio option" name="showcase-radio" defaultChecked /><Switch label="Enable setting" /></div></div><TwoMonthRangePicker label="Two month date range" value={range} onValueChange={setRange} presets /></section>
      <section><h2 className="amafh-h3">Extended controls</h2><div className="amafh-showcase__grid"><NumericField label="Number" value={numberValue} onValueChange={setNumberValue} /><NumericField label="Currency" kind="currency" value={currencyValue} onValueChange={setCurrencyValue} /><NumericField label="Percent" kind="percent" value={percentValue} onValueChange={setPercentValue} /><NumericField label="Numeric error" value="-1" onValueChange={() => {}} error="Value must be zero or greater." /><SegmentedControl label="Period view" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} value={segment} onValueChange={setSegment} /><Stepper label="Value" value={stepValue} onValueChange={setStepValue} min={0} max={20} /><Slider label="Slider value" value={sliderValue} onValueChange={setSliderValue} /></div></section>
      <section><h2 className="amafh-h3">Identity and tabs</h2><div className="amafh-showcase__row"><Avatar name="Sample Person" size="lg" /><Avatar name="Another Person" /></div><ProfileHeader name="Sample Person" subtitle="Team member" status="Active" statusTone="success" /><Tabs label="Sample sections" value={tab} onValueChange={setTab} items={[{ id: 'overview', label: 'Overview', content: <p>Overview content</p> }, { id: 'history', label: 'History', content: <p>History content</p> }]} /></section>
      <section><h2 className="amafh-h3">Status and feedback</h2><div className="amafh-showcase__row">{(['neutral', 'brand', 'info', 'success', 'warning', 'danger'] as const).map(tone => <Badge key={tone} tone={tone}>{tone}</Badge>)}</div><div className="amafh-showcase__grid"><Alert title="Information">Concise contextual message.</Alert><Alert tone="success" title="Completed">The operation succeeded.</Alert><Alert tone="warning" title="Review needed">Check this information.</Alert><Alert tone="danger" title="Error">A safe recovery path is needed.</Alert></div></section>
      <section><h2 className="amafh-h3">Data table</h2><DataTable tableId="showcase-records" columns={columns} rows={rows} rowId={row => row.id} caption="Sample records" pageSize={2} savedViews={[{ id: 'all', label: 'All Records', scope: 'default' }, { id: 'active', label: 'Active Records', scope: 'personal', filter: row => row.status === 'Active' }, { id: 'pending', label: 'Pending Records', scope: 'shared', filter: row => row.status === 'Pending' }]} onCreateSavedView={() => {}} onExport={() => {}} onRefresh={() => {}} freshness={{ state: 'fresh', label: 'Updated just now' }} filters={row => !onlyActive || row.status === 'Active'} filterControls={<Switch label="Active only" checked={onlyActive} onChange={event => setOnlyActive(event.target.checked)} />} activeFilters={onlyActive ? <Badge tone="brand">Active only</Badge> : undefined} rowActions={() => <Dropdown label="Row actions" items={[{ id: 'view', label: 'View', onSelect: () => {} }]} />} bulkActions={ids => <span>{ids.length} selected for actions</span>} /></section>
      <section><h2 className="amafh-h3">File, analytics and workspace states</h2><div className="amafh-showcase__grid"><FileItem name="example.pdf" detail="PDF document" status="Ready" tone="success" /><FileUpload label="Upload sample file" onFilesSelected={() => {}} /><FileOperation kind="import" title="Import preview" stage="preview" fileName="example.csv" recordCount={18} preview={<p>Review the validated rows before confirming.</p>} actionLabel="Import" onAction={() => {}} /><DocumentList documents={[{ id: 'sample', name: 'Document example.pdf', status: 'Ready', tone: 'success' }]} /><Kpi label="Sample metric" value="1,284" change="+4.2%" tone="positive" /><BarChart title="Sample categories" data={[{ label: 'Category A', value: 42 }, { label: 'Category B', value: 27 }, { label: 'Category C', value: 18 }]} /><LineChart title="Sample trend" data={[{ label: 'Jan', value: 24 }, { label: 'Feb', value: 39 }, { label: 'Mar', value: 31 }]} /><DonutChart title="Sample share" data={[{ label: 'Group A', value: 60 }, { label: 'Group B', value: 40 }]} /><Progress label="Sample progress" value={67} /><ActivityTimeline title="Activity" events={[{ id: 'a', title: 'Created', time: 'Today' }, { id: 'b', title: 'Reviewed', time: 'Yesterday' }]} /><Card><strong>Plain content card</strong><p>Shared surface and spacing.</p></Card><WorkspaceState kind="empty" title="Nothing here yet" description="Add an item when ready." /><WorkspaceState kind="loading" title="Loading records" /><WorkspaceState kind="error" title="Something went wrong" description="Try again when the service is available." /></div></section>
      <section><h2 className="amafh-h3">Analytics variants</h2><div className="amafh-showcase__grid"><Ranking title="Sample ranking" data={[{ label: 'Item A', value: 96 }, { label: 'Item B', value: 81 }]} /><Ranking title="Comparison rows" variant="comparison" data={[{ label: 'Item A', value: 96, comparison: 88 }]} /><ChartPanel title="Filtered chart" description="Example description" period="This month" controls={<SelectField label="Period" options={[{ value: 'month', label: 'Month' }]} />}><Progress label="Completion" value={72} /></ChartPanel><ChartPanel title="Loading chart" state="loading" /><ChartPanel title="Chart error" state="error" /><ChartPanel title="No data for filters" state="no-results" /></div></section>
      <section><h2 className="amafh-h3">File operation variants</h2><div className="amafh-showcase__grid"><FileUpload label="Upload progress" progress={58} status="uploading" onFilesSelected={() => {}} /><FileOperation kind="import" title="CSV validation" stage="preview" fileName="example.csv" validation={{ total: 18, valid: 16, invalid: 1, duplicate: 1 }} validationIssues={[{ row: 3, issue: 'Invalid format', detail: 'The value does not match the required format.', resolution: 'Use the template format.' }, { row: 8, issue: 'Duplicate record', detail: 'The row matches another in the file.', resolution: 'Resolve the duplicate.' }]} preview={<p>Review source rows before confirming.</p>} /><FileOperation kind="export" title="Export ready" stage="success" recordCount={18} /><FileOperation kind="pdf" title="PDF generation failed" stage="error" message="Try generating the file again." /><FileOutputPreview title="Sample document" description="Generic printable content" onDownloadPdf={() => {}}><p>Document content is supplied by the caller.</p></FileOutputPreview></div></section>
      <section><h2 className="amafh-h3">Patterns and templates</h2><SearchToolbar query={patternQuery} onQueryChange={setPatternQuery} resultCount={3} /><DashboardGrid><FormSection title="Form section"><TextField label="Example input" placeholder="Enter value" /></FormSection><DetailSection title="Detail section" items={[{ label: 'Field', value: 'Value' }]} /><ApprovalPanel title="Approval panel" status="Pending" summary={<p>Reusable summary slot.</p>} /></DashboardGrid><Card><h3 className="amafh-h4">Workspace template slots</h3><p>Page header → toolbar → primary content → supporting content → footer. The separate shell showcase demonstrates the responsive application template.</p></Card></section>
    </div>
  </Workspace>
}

export function ShellShowcase() {
  const [active, setActive] = useState('overview')
  return <ApplicationShell items={[{ id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} aria-hidden="true" /> }, { id: 'settings', label: 'Settings', icon: <Settings2 size={18} aria-hidden="true" /> }]} activeId={active} onNavigate={setActive}><Workspace title="Application shell" description="Responsive structure demonstration from the application shell canvas." breadcrumb={<Breadcrumb items={[{ label: 'Home', href: '#' }, { label: 'Application shell' }]} />}><Card><p>Selected navigation: {active}</p><p>Feature content is supplied through the shell slot.</p></Card></Workspace></ApplicationShell>
}

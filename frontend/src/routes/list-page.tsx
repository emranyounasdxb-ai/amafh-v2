import { DataTable, type DataTableColumn } from '../components/data-table/data-table'
import { Badge } from '../components/ui/badge'
import { ListWorkspace } from '../templates/page-templates'
import { TemplateBreadcrumb } from './shared'

type ExampleRow = { id: string; name: string; category: string; status: string; updated: string }
const rows: ExampleRow[] = Array.from({ length: 12 }, (_, index) => ({ id: `REC-${String(index + 1).padStart(3, '0')}`, name: `Record ${String(index + 1).padStart(3, '0')}`, category: `Category ${(index % 3) + 1}`, status: index % 3 === 0 ? 'In review' : 'Active', updated: '19 Sep 2026' }))
const columns: DataTableColumn<ExampleRow>[] = [
  { id: 'id', header: 'ID', value: row => row.id, width: 130 },
  { id: 'name', header: 'Name', value: row => row.name, width: 220 },
  { id: 'category', header: 'Category', value: row => row.category, width: 180 },
  { id: 'status', header: 'Status', value: row => row.status, width: 150, cell: row => <Badge tone={row.status === 'Active' ? 'success' : 'warning'}>{row.status}</Badge> },
  { id: 'updated', header: 'Updated', value: row => row.updated, width: 160 },
]

export function ListPage() {
  return <ListWorkspace title="List" description="Data list template" breadcrumb={<TemplateBreadcrumb current="List" />} list={<DataTable tableId="template-list" caption="Template records" columns={columns} rows={rows} rowId={row => row.id} pageSize={6} />} />
}

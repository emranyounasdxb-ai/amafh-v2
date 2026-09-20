# Workspace templates

Templates provide layout slots; feature modules supply titles, actions, data, and domain rules. Source: Figma page `204:2`.

| Template | Slots | Figma node |
| --- | --- | --- |
| ApplicationWorkspace | Shell, breadcrumb, page header, content | `208:166` |
| ListWorkspace | Header, search/filters, list, pagination/states | `211:837` |
| ListDetail | List plus contextual detail drawer | `213:1330` |
| ListCreateEdit | List plus create/edit overlay and operation state | `214:1441` |
| DetailWorkspace | Summary, sections, activity, actions | `216:1634` |
| ProfileWorkspace | Identity header, sections, status/actions | `217:1520` |
| ConfigurationWorkspace | Navigation, settings sections, detail | `218:1613` |
| WorkflowWorkspace | Queue, selected workflow, timeline/actions | `220:2251` |
| ApprovalWorkspace | Queue, request detail, decision panel | `221:2262` |
| AnalyticsWorkspace | Filters, KPI/chart grid, data access | `222:2226` |
| DashboardGrid | Widget slots, responsive grid, widget states | `225:2225` |
| FormWorkspace | Form sections, validation, sticky actions | `226:2397` |
| SearchWorkspace | Query, filters, results, states | `228:2455` |
| WorkspaceState | Loading, empty, error, permission | `229:2400` |

At desktop, wider supporting content may share a row. Tablet reduces columns. Mobile stacks content and keeps the same hierarchy. See `RESPONSIVE.md`.

Implemented slot components are exported from `frontend/src/templates/workspace.tsx` and `page-templates.tsx`: `Workspace`, `DashboardGrid`, `FormWorkspace`, `ListWorkspace`, `ListDetailWorkspace`, `ListCreateEditWorkspace`, `DetailWorkspace`, `ProfileWorkspace`, `ConfigurationWorkspace`, `WorkflowWorkspace`, `ApprovalWorkspace`, `AnalyticsWorkspace`, and `SearchWorkspace`. These are structural contracts; the complete Figma demonstration content and all responsive variants still need parity review. `ApplicationShell` lives in `components/navigation/application-shell.tsx`.

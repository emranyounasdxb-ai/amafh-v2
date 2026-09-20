# Pattern contracts

Patterns compose existing components and preserve the same behavior in every module. They do not fetch business data.

| Pattern | Composition | Source |
| --- | --- | --- |
| Page header | Breadcrumb, title, description, actions | Application Shell `24:111` |
| Search/filter toolbar | Search, Filter button, active chips, saved view, clear filters | Data List `175:22`, Completeness Audit `87:90` |
| Table toolbar | Search/filter, Columns, density, export, refresh | Data List `256:535` |
| Bulk action toolbar | Selection count, scope, permitted actions, clear selection | Data List `187:153`, Audit `88:358` |
| Form section | Title, grouped fields, helper/errors, actions | Components `23:152`, Templates `226:2397` |
| Detail/create drawer | Header, body, safe actions, close/focus return | Components `21:81`, Templates `212:943` |
| Confirmation | Consequence, cancel, confirm, pending/error states | Employee/Access `165:275` |
| Profile header | Identity, status, permitted actions, media | Employee/Access `148:24` |
| File operations | File identity, validation, progress, preview, export/print | File & Data Operations `45:2` |
| Analytics widget | Header, metric/chart, filters, context, states | Analytics `69:2`, Templates `223:2274` |
| Workflow/approval | Queue/detail, timeline/status, decision actions | Templates `220:2251`, `221:2262` |

Use a pattern only where its relationship repeats. Keep domain-specific content in features and pass it through typed slots/props.

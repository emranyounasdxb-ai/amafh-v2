# Responsive rules

Figma page `36:2` and template page `204:2` define one responsive application: mobile below 768px, tablet 768–1199px, desktop 1200px and above. Reference widths are 390, 1024, and 1440px. Use CSS grid/flex, wrapping, local overflow, and the same semantic components.

| Area | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Shell/navigation | Full sidebar and top bar | Compact navigation | Compact navigation; essential actions discoverable |
| Header/actions | Inline when space permits | Wrap action group | Stack or move secondary actions into an explicit menu |
| Forms | Two columns where designed | Reduce columns | One column, same order and validation |
| Table | Full columns and controls | Prioritize columns, retain details | Contained horizontal scroll or compact row view; no page overflow or silent data loss |
| Tabs/filters | Inline | Controlled wrap/scroll | Scrollable strip or existing dropdown/drawer; active filters remain visible |
| Overlays | Designed width | Clamp to viewport | Near-full width; internal scroll, visible dismiss and actions |
| Dashboard | Multi-column widgets | Fewer columns | Single-column widget stack |

Mobile hit areas are at least 44×44px. Important status text, sorting/filter access, selection, row actions, and recovery remain available. Page-wide horizontal overflow is forbidden.

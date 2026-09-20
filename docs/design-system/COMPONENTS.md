# Shared component catalogue

Each component owns one visual and interaction contract. Props should describe semantic variation, not arbitrary color or pixel overrides. Figma node IDs are mapped in `FIGMA_MAPPING.md`.

| Family | Reusable API and variants | Required states and accessibility |
| --- | --- | --- |
| Actions | Button primary, secondary, outline, danger; IconButton | Default, hover, pressed, focus, disabled, loading; semantic `<button>`, name and focus |
| Fields | Input, Search, Select, Textarea, numeric/choice controls | Label, optional/required, helper, validation/error, disabled, read-only; associated message IDs |
| Selection | Checkbox, Radio, Toggle/Switch | Checked, unchecked, indeterminate where valid, focus, disabled; native or Radix semantics |
| Navigation | Tabs, Breadcrumb, sidebar, top bar | Current/selected states, roving focus where needed, keyboard and compact layout |
| Identity/status | Avatar, Badge/Status, Filter chip | Sizes and semantic tones; status text always accompanies color |
| Feedback | Alert, Toast, Loading, Empty, No Results, Error, Permission Restricted | Scoped live announcements, meaningful recovery actions, retained context |
| Overlays | Modal, Drawer, Dropdown, Tooltip, Popover, confirmation | Escape, focus containment/return, labeled trigger and content, viewport fit |
| Content | Card, File Item, upload, preview, document controls | Plain/interactive, selection, error/progress, keyboard action and file identity |
| Data | DataTable, header, row, cell, pagination, column menu, saved view selector, export/refresh slots, freshness indicator | Sort, selection, resize, reorder, visibility, pinning, persistence, density, scoped saved view filters, responsive overflow |
| Analytics | KPI, progress, bar/line/donut, legend, ranking, timeline, chart controls | Text alternatives, data table fallback, loading/empty/error, responsive stacking |
| Date/time | Date picker, range, calendar, month/year, date-time, presets | Calendar keyboard rules, distinct today/focus/selection, locale-safe data values |
| Profile/workflow | Profile header, approval panel, workflow timeline | Explicit status, action permission, chronological semantics |

The Figma catalogue is broader than a single code change. `FIGMA_MAPPING.md` tracks actual implementation status; a listed component is a design contract until the code path exists.

Saved views are caller-supplied definitions with a label, scope (`default`, `personal`, or `shared`), optional row filter, and optional column preferences. The selector applies the view to the generic table. The `onCreateSavedView` callback receives current table preferences; the caller owns naming and persistence.

Export and refresh controls call the supplied callbacks. Freshness is a supplied state (`fresh`, `updating`, `stale`, or `auto`) and label; auto-refresh is used only when the caller has a justified operational need. The table does not fetch or export data itself.

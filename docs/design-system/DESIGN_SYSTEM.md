# AMAFH v2 design system

The [AMAFH v2 Figma file](https://www.figma.com/design/H74KEFM3Mrl6K8EvINLO3p/AMAFH-v2?node-id=0-1) is the visual authority. Its 14 pages cover foundations, components, shell, states, documentation, responsive behavior, file operations, analytics, calendar, enterprise controls, accessibility, profile/access, the data list system, and workspace templates. The repository owns accessible behavior and production implementation. A Figma illustration is not proof of implemented behavior.

## Composition order

Figma → tokens → UI primitives → shared components → patterns → templates → business features. Shared UI lives in `frontend/src/components`, `patterns`, and `templates`; feature folders may supply data and domain behavior but must not fork Button, Input, DataTable, status, or overlay styling.

## Visual language

Neutral surfaces carry dense information. Purple and magenta mark actions, focus, selection, and concise emphasis. Headings use Manrope; interface text uses IBM Plex Sans. Spacing follows a 4px base grid, corners are restrained, shadows indicate hierarchy, and motion communicates state changes. No decorative gradients, glass treatments, oversized cards, or browser-native controls.

## New UI procedure

1. Identify the matching Figma node and existing code component.
2. Reuse a token, primitive, pattern, or template before adding an API.
3. If a capability is genuinely reusable, add it to the shared layer, its documentation, and the showcase.
4. Compare default, hover, focus, disabled, loading, error, and responsive states with Figma. Record deviations in `FIGMA_MAPPING.md`.

## Source page IDs

`0:1` Foundations; `5:2` Components; `5:3` Application Shell; `5:4` States; `5:5` Documentation; `36:2` Responsive Design; `45:2` File & Data Operations; `69:2` Analytics; `82:2` Calendar; `87:77` Completeness Audit; `87:94` Accessibility; `143:2` Employee/Access; `175:2` Data List/Table; `204:2` Templates.

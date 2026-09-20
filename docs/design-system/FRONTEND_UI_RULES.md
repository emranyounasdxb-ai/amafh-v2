# UI implementation rules

1. Read `DESIGN_SYSTEM.md`, `TOKENS.md`, and `FIGMA_MAPPING.md` before new UI work.
2. Use React 19.3 function components, strict TypeScript, Vite SPA, Tailwind CSS 4, and the installed dependency versions. Keep API/server state in feature hooks and TanStack Query; UI state stays local unless sharing is demonstrated.
3. Search `components`, `patterns`, and `templates` before creating a component. Prefer composition and typed slots over page-specific forks.
4. Use `tokens.css` for colors, type, spacing, radius, elevation, size, and motion. No arbitrary hex or default shadcn visual theme in components.
5. Use Lucide at Figma's 24px outline / 1.75px stroke where glyphs match. Do not mix icon libraries. Use accessible labels for icon-only buttons.
6. Implement default, hover, focus, active, disabled, loading, error, and responsive states that exist in Figma. Use Radix/shadcn only when their interaction semantics help, and restyle with AMAFH tokens.
7. Business features configure the generic DataTable. They never add their own table engine or preference format.
8. Keep server, UI, form, and URL state separate. Table preferences use a versioned adapter boundary. Production callers must scope `tableId` to the authenticated user and table, or inject an adapter that does so; the default local adapter only scopes to the supplied key.
9. Add a showcase example and relevant interaction/accessibility tests for each implemented shared capability. Compare 1440, 1024, and 390px layouts with Figma and record any deviation.
10. Do not add business pages as design-system demonstrations.

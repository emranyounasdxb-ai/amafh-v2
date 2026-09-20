# Accessibility contract

Based on Figma page `87:94`. Use semantic HTML and WCAG AA contrast. Every control has a programmatic name; visible field labels remain visible. Status includes text, not color alone. Connect error text with `aria-describedby` and `aria-invalid`; preserve entered values and explain correction.

Keyboard: Enter/Space activate buttons and menu items. Escape dismisses transient overlays. Modal/drawer focus stays in the open layer and returns to its trigger. Calendar arrows move days, Page Up/Down changes month, Home/End moves within the week, Enter selects. Table Space toggles a row checkbox; sorting reports `aria-sort`. Drag operations need keyboard alternatives where practical.

Focus uses a persistent visible ring. At 200% zoom, reflow preserves function. At 400%, essential controls remain reachable without two-dimensional page scroll. Touch targets on mobile are at least 44×44px. Loading, errors, selection count, and successful column movement need scoped announcements. Reduced-motion preference disables nonessential transitions.

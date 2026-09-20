# Token contract

`frontend/src/styles/tokens.css` is the sole code source of visual values. Tailwind 4 `@theme` exposes token-backed utilities. Component CSS consumes these variables and contains no independent palette.

| Family | Figma source | Values |
| --- | --- | --- |
| Neutral | Foundations `9:4` | 0 `#fff`, 50 `#f8f7fa`, 100 `#f1eff3`, 200 `#e5e1e8`, 400 `#aaa1b0`, 600 `#5a5360`, 800 `#2a252e`, 950 `#0e0c10` |
| Brand | Foundations `9:4` | Purple 100 `#f3e8ff`, 300 `#d8b4fe`, 500 `#a855f7`, 700 `#7e22ce`, 900 `#581c87`; magenta 500 `#d946ef` |
| Semantic | Foundations `9:49`, Components `15:51`, `19:48` | Canvas, surface, subtle, brand, brand hover, focus, border, text, success, warning, danger, info, disabled; see CSS for exact mapping |
| Type | Foundations `8:8` | Manrope 32/40, 28/36, 24/32, 20/28, 16/24; IBM Plex Sans 16/24, 14/20, 12/18, labels 14/20 and 12/16, caption 11/16 |
| Space | Foundations `8:9` | 0, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64px |
| Radius | Foundations `8:10` | 0, 4, 6, 8, 10, 12, 16px, pill |
| Control height | Foundations `11:42` | Compact 32px, default 36px, large 40px |
| Elevation | Foundations `12:30` | `0 1px 2px #0e0a1114`, `0 4px 10px -2px #0e0a111a`, `0 12px 28px -6px #0e0a1124`; focus spread 3px `#a855f747` |
| Motion | Foundations `8:11` | 120, 180, 240ms; `cubic-bezier(0.2, 0, 0, 1)`; reduced motion honored |
| Breakpoints | Responsive `36:7` | Mobile 0–767px, tablet 768–1199px, desktop 1200px+; design references 390, 1024, 1440px |
| Table sizing | Data List `249:520` | Default column 180px; minimum 96px; maximum 480px. Rows: compact 40px, default 48px, comfortable 56px. |
| Chart colors | Analytics `70:2` | Primary `#9333ea`, secondary `#3b82f6`, tertiary `#d946ef`, positive `#22c55e`, warning `#f59e0b`, negative `#ef4444`, neutral `#766e7b`; grid, axis, tooltip, selected, disabled use named aliases. |
| File validation borders | File & Data `51:293`, `53:383` | Semantic success `#22c55e`, warning `#f59e0b`, and info `#3b82f6` borders mirror the Figma validation and output states. |
| Chart inset | Analytics `72:260`, `73:123` | 18px inset for ranking and chart header cards. |
| Calendar day | Calendar `85:28`, `86:563` | 40px single day state, 38px double-calendar day, 7px day radius. |
| Overlay | Components `21:68` | `--amafh-color-overlay` centralizes the dark backdrop treatment for modal, drawer, and mobile navigation. |

Figma mentions light/dark tokens. Dark mode values need to be taken from the file's variable mode before enabling a dark theme; a guessed inversion is prohibited.

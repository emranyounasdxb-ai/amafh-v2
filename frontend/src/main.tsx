import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import './styles.css'

const DesignSystemShowcase = import.meta.env.DEV ? lazy(() => import('./design-system/showcase').then(module => ({ default: module.DesignSystemShowcase }))) : null
const ShellShowcase = import.meta.env.DEV ? lazy(() => import('./design-system/showcase').then(module => ({ default: module.ShellShowcase }))) : null
const devPreview = import.meta.env.DEV && window.location.pathname.startsWith('/_design-system')
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{devPreview && DesignSystemShowcase && ShellShowcase ? <Suspense fallback={<div role="status">Loading design system…</div>}>{window.location.pathname === '/_design-system-shell' ? <ShellShowcase /> : <DesignSystemShowcase />}</Suspense> : <App />}</React.StrictMode>,
)

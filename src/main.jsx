import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastConfirmProvider } from './components/ui/ToastConfirmContext.jsx'

// Open the native calendar when clicking anywhere on a date input, not just its icon.
document.addEventListener('click', (e) => {
  const el = e.target
  if (el instanceof HTMLInputElement && el.type === 'date' && !el.disabled && !el.readOnly) {
    try { el.showPicker() } catch { /* unsupported or already open */ }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastConfirmProvider>
      <App />
    </ToastConfirmProvider>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastConfirmProvider } from './components/ui/ToastConfirmContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastConfirmProvider>
      <App />
    </ToastConfirmProvider>
  </StrictMode>,
)

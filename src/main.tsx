import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './styles/index.css'

// Auto-actualización de la PWA: revisa una versión nueva cada 60s y la aplica
// sola (registerType 'autoUpdate' recarga al activar el SW nuevo). Sin esto, en
// móvil el shell viejo se quedaba hasta reinstalar la app.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) setInterval(() => void registration.update(), 60_000)
  },
})

// Botón "Actualizar" del menú: fuerza el SW nuevo y recarga (refresca código + datos).
window.updateApp = () => {
  void updateSW(true)
  setTimeout(() => window.location.reload(), 300)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

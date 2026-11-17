import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// O Vite em desenvolvimento deve servir o código atual, não uma versão
// antiga do PWA que permaneceu registrada no Safari/iPhone.
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const hadController = Boolean(navigator.serviceWorker.controller)
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          if (registration.scope.startsWith(window.location.origin)) {
            await registration.unregister()
          }
        }
        // Recarrega uma única vez após remover o controle do SW antigo.
        if (hadController && !sessionStorage.getItem('embrio-dev-sw-reset')) {
          sessionStorage.setItem('embrio-dev-sw-reset', '1')
          window.location.reload()
        }
      } catch (error) {
        console.warn('Não foi possível remover o service worker antigo:', error)
      }
    })
  }
} else {
  // Quando houver uma nova versão publicada, atualiza os arquivos do PWA.
  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('embrio-update-available'))
    }
  })
}

window.addEventListener('online', () => window.dispatchEvent(new CustomEvent('embrio-local-change')))

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root não encontrado.')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

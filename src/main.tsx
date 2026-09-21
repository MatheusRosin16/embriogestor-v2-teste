import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({immediate:true})
window.addEventListener('online',()=>window.dispatchEvent(new CustomEvent('embrio-local-change')))

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root não encontrado.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)

import { useEffect, useState } from 'react'
import { cloudStatus } from '../services/supabaseCloud'
import type { NivelAcesso, BancoEmbrioGestor } from '../types/domain'
import { offlineQueueCount } from '../services/offlineQueue'

function txtData(v?:string|null){
  if(!v)return ''
  const d=new Date(v)
  if(Number.isNaN(d.getTime()))return ''
  return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
}

export function CloudSyncBadge({role,onSync}:{role?:NivelAcesso;db?:BancoEmbrioGestor;onSync?:()=>Promise<void>|void}){
  const[online,setOnline]=useState(navigator.onLine)
  const[st,setSt]=useState(()=>cloudStatus())
  const[pending,setPending]=useState(()=>offlineQueueCount())

  useEffect(()=>{
    const refresh=()=>{setOnline(navigator.onLine);setSt(cloudStatus());setPending(offlineQueueCount())}
    window.addEventListener('online',refresh)
    window.addEventListener('offline',refresh)
    window.addEventListener('embrio-cloud-status',refresh)
    window.addEventListener('embrio-local-change',refresh)
    window.addEventListener('embrio-offline-queue',refresh)
    const i=window.setInterval(refresh,3000)
    return()=>{
      window.removeEventListener('online',refresh)
      window.removeEventListener('offline',refresh)
      window.removeEventListener('embrio-cloud-status',refresh)
      window.removeEventListener('embrio-local-change',refresh)
      window.removeEventListener('embrio-offline-queue',refresh)
      window.clearInterval(i)
    }
  },[])

  if(!online)return <span className="sync-badge offline">● Offline — {pending||1} alteração(ões) aguardando sincronização</span>
  if(st.conflict)return <span className="sync-badge conflict">● Conflito de sincronização{role==='VETERINARIO'&&<button className="sync-inline-button" onClick={()=>onSync?.()}>Baixar dados</button>}</span>
  if(st.dirty)return <span className="sync-badge pending">● Salvando na nuvem…{role==='VETERINARIO'&&<button className="sync-inline-button" onClick={()=>onSync?.()}>Sincronizar agora</button>}</span>
  if(st.signedIn)return <span className="sync-badge ok">● Sincronizado{st.lastSync?` às ${txtData(st.lastSync)}`:''}{role==='VETERINARIO'&&<button className="sync-inline-button" onClick={()=>onSync?.()}>Sincronizar</button>}</span>
  return <span className="sync-badge neutral">● Nuvem desconectada</span>
}

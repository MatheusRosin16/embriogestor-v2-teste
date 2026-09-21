import { useEffect,useState } from 'react'

type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}
export function PwaInstallHint(){
  const[event,setEvent]=useState<InstallEvent|null>(null)
  const[visible,setVisible]=useState(false)
  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone===true
    if(standalone)return
    const handler=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent);setVisible(true)}
    window.addEventListener('beforeinstallprompt',handler)
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent)
    if(isiOS)setVisible(true)
    return()=>window.removeEventListener('beforeinstallprompt',handler)
  },[])
  if(!visible)return null
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent)
  return <div className="pwa-install-hint">
    <span>{isiOS?'Para instalar: Compartilhar → Adicionar à Tela de Início.':'Instale o EmbrioGestor como aplicativo neste aparelho.'}</span>
    {event&&<button onClick={async()=>{await event.prompt();const r=await event.userChoice;if(r.outcome==='accepted')setVisible(false)}}>Instalar</button>}
    <button className="pwa-close" onClick={()=>setVisible(false)}>×</button>
  </div>
}

import { getSession, getSupabaseConfig } from './supabaseCloud'

export type LinhaFichaIA={
  numero?:string;doadora?:string;racaDoadora?:string;touro?:string;racaTouro?:string;racaEmbriao?:string;
  qualidade?:string;receptora?:string;sequencia?:string;cl?:string;observacao?:string;confianca?:'ok'|'revisar';alerta?:string
}
export type ResultadoFichaIA={
  cabecalho?:{propriedadeOPU?:string;propriedadeTE?:string;tecnica?:string;dataTE?:string;dataOPU?:string;horaInicioTE?:string;horaTerminoTE?:string;tecnicoTE?:string;anotacao?:string;auxiliar?:string}
  linhas:LinhaFichaIA[];avisos?:string[]
}
function base64(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error);r.readAsDataURL(file)})}
export async function lerFichaTransferenciaIA(file:File):Promise<ResultadoFichaIA>{
  const cfg=getSupabaseConfig(), sess=getSession()
  if(!cfg)throw new Error('Supabase não configurado.')
  if(!sess?.access_token)throw new Error('Faça login novamente para usar a leitura por IA.')
  if(file.size>12*1024*1024)throw new Error('A imagem é muito grande. Use uma foto de até 12 MB.')
  if(!file.type.startsWith('image/'))throw new Error('Nesta primeira versão da IA, use uma foto (JPG, PNG ou HEIC convertido pelo navegador).')
  const image=await base64(file)
  const r=await fetch(`${cfg.url}/functions/v1/ler-ficha-te`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.anonKey,'Authorization':`Bearer ${sess.access_token}`},body:JSON.stringify({image,mimeType:file.type,name:file.name})})
  const txt=await r.text();let data:any={};try{data=txt?JSON.parse(txt):{}}catch{data={message:txt}}
  if(!r.ok)throw new Error(data?.error||data?.message||'Não foi possível ler a ficha com IA.')
  return data as ResultadoFichaIA
}

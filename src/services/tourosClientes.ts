import type { BancoEmbrioGestor, Touro } from '../types/domain'

export function clientesDoTouro(t:Touro):string[]{
  return [...new Set([...(t.clienteIds||[]),...(t.clienteId?[t.clienteId]:[])].filter(Boolean))]
}

export function touroDoCliente(t:Touro,clienteId:string){
  return clientesDoTouro(t).includes(clienteId)
}

export function tourosDoCliente(db:BancoEmbrioGestor,clienteId:string){
  return db.touros.filter(t=>touroDoCliente(t,clienteId))
}

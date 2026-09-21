import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Doadora } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'

const id=()=> 'DOA_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const vazio:Doadora={id:'',clienteId:'',nome:'',registro:'',racaId:'',categoria:'',nascimento:'',status:'Ativo',obs:''}

const normalizar=(valor:unknown)=>String(valor??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()

export function Doadoras({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Doadora|null>(null)
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)

  const grupos=useMemo(()=>{
    const termo=normalizar(busca)
    return db.clientes.map(c=>{
      const clienteCombina=!termo||[c.nome,c.propriedade,c.municipio,c.uf,c.cpf,c.telefone,c.email].some(v=>normalizar(v).includes(termo))
      const todas=db.doadoras.filter(d=>d.clienteId===c.id)
      const itens=!termo||clienteCombina?todas:todas.filter(d=>{
        const r=db.racas.find(x=>x.id===d.racaId)
        return [d.nome,d.registro,r?.nome,r?.abreviatura,d.categoria,d.status,d.obs].some(v=>normalizar(v).includes(termo))
      })
      return {cliente:c,itens,total:todas.length}
    }).filter(g=>g.itens.length||!termo).sort((a,b)=>a.cliente.nome.localeCompare(b.cliente.nome,'pt-BR'))
  },[db,busca])

  function salvar(d:Doadora){
    if(!d.clienteId||!d.nome.trim()||!d.racaId)return alert('Informe cliente, identificação e raça.')
    const r=db.racas.find(x=>x.id===d.racaId)
    const item={...d,raca:r?.nome||''}
    const doadoras=d.id?db.doadoras.map(x=>x.id===d.id?item:x):[...db.doadoras,{...item,id:id()}]
    onChange({...db,doadoras})
    setEdit(null)
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Doadoras</h2><p>Doadoras organizadas por cliente.</p></div><button className="btn primary" onClick={()=>setEdit({...vazio})}>Nova doadora</button></div>
    <div className="toolbar donor-search-toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar cliente, doadora, registro ou raça"/>{busca.trim()&&<span className="donor-search-count">{grupos.reduce((n,g)=>n+g.itens.length,0)} resultado(s)</span>}</div>

    <div className={`donor-folders ${clienteAberto&&!busca.trim()?'has-open':''}`}>{grupos.map(g=>{const aberto=clienteAberto===g.cliente.id;if(clienteAberto&&!aberto)return null;return <div className={`donor-client-card ${aberto?'is-open':''}`} key={g.cliente.id}>
      <button type="button" className="donor-client-button" onClick={()=>{setClienteAberto(aberto?null:g.cliente.id);if(!aberto)setBusca('')}}><span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{g.cliente.nome}</strong><small>{g.cliente.propriedade||g.cliente.municipio||'Cliente'}</small></span><span className="donor-folder-count">{busca.trim()?`${g.itens.length}/${g.total}`:g.total}</span></button>
      {aberto&&<div className="donor-open-content"><div className="donor-open-head"><div><strong>{g.cliente.nome}</strong><span>{g.total} doadora(s) cadastrada(s)</span></div><button className="btn small" onClick={()=>{setClienteAberto(null);setBusca('')}}>Voltar aos clientes</button></div>
      <div className="table-wrap"><table><thead><tr><th>Identificação</th><th>Registro</th><th>Raça</th><th>Abrev.</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead><tbody>{g.itens.map(d=>{const r=db.racas.find(x=>x.id===d.racaId);return <tr key={d.id}><td><strong>{d.nome}</strong></td><td>{d.registro}</td><td>{r?.nome||d.raca}</td><td>{r?.abreviatura}</td><td>{d.categoria}</td><td>{d.status}</td><td><div className="actions"><button className="btn small" onClick={()=>setEdit({...d})}>Editar</button><button className="btn small danger" onClick={()=>{if(confirm('Excluir esta doadora?'))onChange({...db,doadoras:db.doadoras.filter(x=>x.id!==d.id)})}}>Excluir</button></div></td></tr>})}</tbody></table></div></div>}</div>})}</div>

    {edit&&<Modal title={edit.id?'Editar doadora':'Nova doadora'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Cliente"><SearchableSelect value={edit.clienteId} onChange={v=>setEdit({...edit,clienteId:v})} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></Field>
        <Field label="Identificação / Brinco"><input value={edit.nome} onChange={e=>setEdit({...edit,nome:e.target.value})}/></Field>
        <Field label="Registro"><input value={edit.registro||''} onChange={e=>setEdit({...edit,registro:e.target.value})}/></Field>
        <Field label="Raça"><select value={edit.racaId||''} onChange={e=>setEdit({...edit,racaId:e.target.value})}><option value="">Selecione...</option>{db.racas.map(r=><option key={r.id} value={r.id}>{r.abreviatura} — {r.nome}</option>)}</select></Field>
        <Field label="Categoria"><input value={edit.categoria||''} onChange={e=>setEdit({...edit,categoria:e.target.value})}/></Field>
        <Field label="Nascimento"><input type="date" value={edit.nascimento||''} onChange={e=>setEdit({...edit,nascimento:e.target.value})}/></Field>
        <Field label="Status"><select value={edit.status||'Ativo'} onChange={e=>setEdit({...edit,status:e.target.value as any})}><option>Ativo</option><option>Inativo</option></select></Field>
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar</button></div>
    </Modal>}
  </section>
}

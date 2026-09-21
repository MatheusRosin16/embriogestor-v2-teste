import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Profissional } from '../types/domain'
import { Field, Modal, SearchBar } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'

const novo:Profissional={id:'',nome:'',funcao:'',crmv:'',telefone:'',email:'',obs:'',clienteIds:[]}
const id=()=> 'PROF_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const norm=(v:any)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

export function Profissionais({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Profissional|null>(null)
  const[aberto,setAberto]=useState<string|null>(null)

  const lista=useMemo(()=>[...db.profissionais].filter(p=>{
    const clientes=(p.clienteIds||[]).map(id=>db.clientes.find(c=>c.id===id)?.nome||'').join(' ')
    return !busca||norm([p.nome,p.funcao,p.crmv,p.telefone,p.email,clientes].join(' ')).includes(norm(busca))
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),[db,busca])

  function salvar(p:Profissional){
    if(!p.nome.trim())return alert('Informe o nome do profissional.')
    const item={...p,id:p.id||id(),clienteIds:Array.from(new Set(p.clienteIds||[]))}
    onChange({...db,profissionais:p.id?db.profissionais.map(x=>x.id===p.id?item:x):[...db.profissionais,item]})
    setEdit(null)
  }
  function alternarCliente(clienteId:string,marcado:boolean){
    if(!edit)return
    const ids=edit.clienteIds||[]
    setEdit({...edit,clienteIds:marcado?Array.from(new Set([...ids,clienteId])):ids.filter(x=>x!==clienteId)})
  }

  return <section className="panel professional-portfolio">
    <div className="panel-head"><div><h2>Profissionais</h2><p>Cadastro dos profissionais e carteira de clientes de cada responsável.</p></div><button className="btn primary" onClick={()=>setEdit({...novo})}>+ Novo profissional</button></div>
    <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar profissional, CRMV ou cliente da carteira"/></div>

    <div className={`donor-folders ${aberto&&!busca?'has-open':''}`}>{lista.map(p=>{
      const isOpen=aberto===p.id
      if(aberto&&!isOpen)return null
      const clientes=(p.clienteIds||[]).map(id=>db.clientes.find(c=>c.id===id)).filter(Boolean)
      const trans=db.transferencias.filter(t=>t.profissionalId===p.id)
      return <div className={`donor-client-card ${isOpen?'is-open':''}`} key={p.id}>
        <button className="donor-client-button" onClick={()=>{setAberto(isOpen?null:p.id);if(!isOpen)setBusca('')}}><span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{p.nome}</strong><small>{p.funcao||p.crmv||'Profissional'}</small></span><span className="donor-folder-count">{clientes.length} cliente(s)</span></button>
        {isOpen&&<div className="donor-open-content"><div className="donor-open-head"><div><strong>{p.nome}</strong><span>{clientes.length} cliente(s) na carteira • {trans.length} transferência(s)</span></div><div className="actions"><button className="btn small" onClick={()=>{setAberto(null);setBusca('')}}>Voltar aos profissionais</button><button className="btn small" onClick={()=>setEdit({...p,clienteIds:[...(p.clienteIds||[])]})}>Editar profissional e carteira</button></div></div>
          <div className="professional-info"><span><b>Função:</b> {p.funcao||'—'}</span><span><b>CRMV:</b> {p.crmv||'—'}</span><span><b>Telefone:</b> {p.telefone||'—'}</span><span><b>E-mail:</b> {p.email||'—'}</span></div>
          {clientes.length?<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Propriedade</th><th>Município</th><th>OPUs</th><th>Produções</th><th>Transferências</th></tr></thead><tbody>{clientes.map(c=>{const opu=new Set([...db.aspiracoes,...db.producoes].filter(x=>x.clienteId===c!.id).map(x=>`${x.clienteId}|${String(x.data).slice(0,10)}`)).size;return <tr key={c!.id}><td><strong>{c!.nome}</strong></td><td>{c!.propriedade||'—'}</td><td>{c!.municipio||'—'}</td><td>{opu}</td><td>{db.producoes.filter(x=>x.clienteId===c!.id).length}</td><td>{db.transferencias.filter(x=>x.clienteId===c!.id).length}</td></tr>})}</tbody></table></div>:<div className="note-box">Nenhum cliente adicionado à carteira deste profissional.</div>}
        </div>}
      </div>
    })}</div>
    {!lista.length&&<div className="note-box">Nenhum profissional cadastrado.</div>}

    {edit&&<Modal title={edit.id?'Editar profissional e carteira':'Novo profissional'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Nome"><input value={edit.nome} onChange={e=>setEdit({...edit,nome:e.target.value})}/></Field>
        <Field label="Função"><input value={edit.funcao||''} onChange={e=>setEdit({...edit,funcao:e.target.value})}/></Field>
        <Field label="CRMV"><input value={edit.crmv||''} onChange={e=>setEdit({...edit,crmv:e.target.value})}/></Field>
        <Field label="Telefone"><input value={edit.telefone||''} onChange={e=>setEdit({...edit,telefone:e.target.value})}/></Field>
        <Field label="E-mail"><input value={edit.email||''} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field>
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>
      <div className="portfolio-editor"><div className="portfolio-editor-title"><strong>Carteira de clientes</strong><span>Marque os clientes pertencentes a este profissional.</span></div><div className="portfolio-client-grid">{[...db.clientes].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=><label className="portfolio-client-check" key={c.id}><input type="checkbox" checked={(edit.clienteIds||[]).includes(c.id)} onChange={e=>alternarCliente(c.id,e.target.checked)}/><span><strong>{c.nome}</strong><small>{c.propriedade||c.municipio||''}</small></span></label>)}</div></div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button>{edit.id&&<button className="btn danger" onClick={()=>{if(confirm('Excluir este profissional?')){onChange({...db,profissionais:db.profissionais.filter(x=>x.id!==edit.id)});setEdit(null)}}}>Excluir</button>}<button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar profissional</button></div>
    </Modal>}
  </section>
}

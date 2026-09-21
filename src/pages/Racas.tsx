import { useState } from 'react'
import type { BancoEmbrioGestor, Raca } from '../types/domain'
import { Field, Modal, SearchBar } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'

const id=()=> 'RAC_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)

export function Racas({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Raca|null>(null)
  const lista=db.racas.filter(r=>(r.nome+' '+r.abreviatura).toLowerCase().includes(busca.toLowerCase()))

  function salvar(r:Raca){
    if(!r.nome.trim()||!r.abreviatura.trim())return alert('Informe raça e abreviatura.')
    const item={...r,abreviatura:r.abreviatura.toUpperCase()}
    const racas=r.id?db.racas.map(x=>x.id===r.id?item:x):[...db.racas,{...item,id:id()}]
    onChange({...db,racas:racas.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))})
    setEdit(null)
  }

  function excluir(r:Raca){
    if(db.doadoras.some(d=>d.racaId===r.id)||db.touros.some(t=>t.racaId===r.id))return alert('Essa raça está sendo utilizada. Altere os animais antes de excluí-la.')
    if(confirm('Excluir '+r.nome+'?'))onChange({...db,racas:db.racas.filter(x=>x.id!==r.id)})
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Raças</h2><p>Nome e abreviatura editável.</p></div><button className="btn primary" onClick={()=>setEdit({id:'',nome:'',abreviatura:''})}>Nova raça</button></div>
    <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar raça ou abreviatura"/></div>
    <div className="table-wrap"><table><thead><tr><th>Raça</th><th>Abreviatura</th><th>Ações</th></tr></thead><tbody>
      {lista.map(r=><tr key={r.id}><td>{r.nome}</td><td><strong>{r.abreviatura}</strong></td><td><div className="actions"><button className="btn small" onClick={()=>setEdit({...r})}>Editar</button><button className="btn small danger" onClick={()=>excluir(r)}>Excluir</button></div></td></tr>)}
    </tbody></table></div>
    {edit&&<Modal title={edit.id?'Editar raça':'Nova raça'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Nome da raça"><input value={edit.nome} onChange={e=>setEdit({...edit,nome:e.target.value})}/></Field>
        <Field label="Abreviatura"><input maxLength={5} value={edit.abreviatura} onChange={e=>setEdit({...edit,abreviatura:e.target.value.toUpperCase()})}/></Field>
      </div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar</button></div>
    </Modal>}
  </section>
}

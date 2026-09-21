import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Touro, TipoSemen } from '../types/domain'
import { Field, Modal, SearchBar } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'
import { CENTRAIS_BRASIL } from '../services/centrais'
import { clientesDoTouro, touroDoCliente } from '../services/tourosClientes'

const id=()=> 'TOU_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const vazio:Touro={id:'',clienteId:'',nome:'',registro:'',racaId:'',central:'',codigo:'',tipoSemen:'Convencional',obs:''}

export function Touros({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Touro|null>(null)

  const grupos=useMemo(()=>db.clientes.map(c=>{
    const itens=db.touros.filter(t=>touroDoCliente(t,c.id)).filter(t=>{
      const r=db.racas.find(x=>x.id===t.racaId)
      const q=busca.toLowerCase()
      return !q||[t.nome,t.registro,t.central,t.codigo,t.tipoSemen,r?.nome,r?.abreviatura].some(v=>String(v||'').toLowerCase().includes(q))
    })
    return {cliente:c,itens}
  }).filter(g=>g.itens.length||!busca).sort((a,b)=>a.cliente.nome.localeCompare(b.cliente.nome,'pt-BR')),[db,busca])

  const semCliente=db.touros.filter(t=>clientesDoTouro(t).length===0)

  function salvar(t:Touro){
    if(!clientesDoTouro(t).length||!t.nome.trim()||!t.racaId)return alert('Informe pelo menos um cliente, touro e raça.')
    const r=db.racas.find(x=>x.id===t.racaId)
    const clienteIds=clientesDoTouro(t); const item={...t,clienteIds,clienteId:clienteIds[0]||'',raca:r?.nome||'',central:(t.central||'').trim()}
    const touros=t.id?db.touros.map(x=>x.id===t.id?item:x):[...db.touros,{...item,id:id()}]
    onChange({...db,touros})
    setEdit(null)
  }

  return <section className="panel">
    <div className="panel-head"><div><h2>Touros</h2><p>Separados e minimizados por cliente.</p></div><button className="btn primary" onClick={()=>setEdit({...vazio})}>Novo touro</button></div>
    <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar touro, central, registro, raça ou tipo de sêmen"/></div>

    <div className="folders">
      {grupos.map(g=><details className="folder" key={g.cliente.id}>
        <summary>📁 <strong>{g.cliente.nome}</strong><span>{g.itens.length} touro(s)</span></summary>
        <div className="table-wrap"><table><thead><tr><th>Touro</th><th>Registro</th><th>Raça</th><th>Abrev.</th><th>Central</th><th>Tipo de sêmen</th><th>Ações</th></tr></thead><tbody>
          {g.itens.map(t=>{const r=db.racas.find(x=>x.id===t.racaId);return <tr key={t.id}><td><strong>{t.nome}</strong></td><td>{t.registro}</td><td>{r?.nome||t.raca}</td><td>{r?.abreviatura}</td><td>{t.central}</td><td>{t.tipoSemen||'Convencional'}</td><td><div className="actions"><button className="btn small" onClick={()=>setEdit({...t})}>Editar</button><button className="btn small danger" onClick={()=>{if(confirm('Excluir este touro?'))onChange({...db,touros:db.touros.filter(x=>x.id!==t.id)})}}>Excluir</button></div></td></tr>})}
        </tbody></table></div>
      </details>)}
      {semCliente.length>0&&<details className="folder"><summary>📁 <strong>Sem cliente definido</strong><span>{semCliente.length} touro(s)</span></summary><div className="note-box">Esses touros não possuem vínculo recuperável. Somente estes precisam ser vinculados manualmente.</div></details>}
    </div>

    {edit&&<Modal title={edit.id?'Editar touro':'Novo touro'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Clientes vinculados"><div className="client-checks">{db.clientes.map(c=>{const ids=clientesDoTouro(edit);const marcado=ids.includes(c.id);return <label key={c.id} className="client-check"><input type="checkbox" checked={marcado} onChange={e=>{const novos=e.target.checked?[...ids,c.id]:ids.filter(x=>x!==c.id);setEdit({...edit,clienteIds:novos,clienteId:novos[0]||''})}}/><span>{c.nome}</span></label>})}</div></Field>
        <Field label="Nome do touro"><input value={edit.nome} onChange={e=>setEdit({...edit,nome:e.target.value})}/></Field>
        <Field label="Registro"><input value={edit.registro||''} onChange={e=>setEdit({...edit,registro:e.target.value})}/></Field>
        <Field label="Raça"><select value={edit.racaId||''} onChange={e=>setEdit({...edit,racaId:e.target.value})}><option value="">Selecione...</option>{db.racas.map(r=><option key={r.id} value={r.id}>{r.abreviatura} — {r.nome}</option>)}</select></Field>
        <Field label="Central">
          <input list="centrais-brasil" placeholder="Digite ou selecione a central" value={edit.central||''} onChange={e=>setEdit({...edit,central:e.target.value})}/>
          <datalist id="centrais-brasil">{CENTRAIS_BRASIL.map(c=><option key={c} value={c}/>)}</datalist>
        </Field>
        <Field label="Código"><input value={edit.codigo||''} onChange={e=>setEdit({...edit,codigo:e.target.value})}/></Field>
        <Field label="Tipo de sêmen"><select value={edit.tipoSemen||'Convencional'} onChange={e=>setEdit({...edit,tipoSemen:e.target.value as TipoSemen})}><option>Convencional</option><option>Sexado macho</option><option>Sexado fêmea</option></select></Field>
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar</button></div>
    </Modal>}
  </section>
}

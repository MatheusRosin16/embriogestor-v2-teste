import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, EstoqueSemenItem, MovimentacaoItem, Touro, TipoSemen } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'
import { CENTRAIS_BRASIL } from '../services/centrais'
import { touroDoCliente } from '../services/tourosClientes'

const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const n=(v:any)=>Math.max(0,Number(v)||0)
const normalizar=(v:any)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const vazioEstoque:EstoqueSemenItem={id:'',clienteId:'',touroId:'',partida:'',quantidade:0,usadas:0,saldo:0,recipienteTipo:'CANECA',recipiente:'',obs:''}
const vazioTouro:Touro={id:'',clienteId:'',clienteIds:[],nome:'',registro:'',racaId:'',central:'',codigo:'',tipoSemen:'Convencional',obs:''}

export function EstoqueSemen({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)
  const[editEstoque,setEditEstoque]=useState<EstoqueSemenItem|null>(null)
  const[editTouro,setEditTouro]=useState<Touro|null>(null)
  const[clienteCadastroTouro,setClienteCadastroTouro]=useState<string>('')

  const grupos=useMemo(()=>db.clientes.map(c=>{
    const touros=db.touros.filter(t=>touroDoCliente(t,c.id))
    const estoque=db.estoque.filter(e=>e.clienteId===c.id)
    const q=normalizar(busca)
    const tourosVisiveis=touros.filter(t=>{
      const r=db.racas.find(x=>x.id===t.racaId)
      const itens=estoque.filter(e=>e.touroId===t.id)
      return !q||normalizar([c.nome,c.propriedade,c.municipio,t.nome,t.registro,t.central,t.codigo,t.tipoSemen,r?.nome,r?.abreviatura,...itens.flatMap(e=>[e.partida,e.recipiente,e.obs])].join(' ')).includes(q)
    })
    return {cliente:c,touros:tourosVisiveis,estoque,totalTouros:touros.length,saldo:estoque.reduce((a,e)=>a+n(e.saldo),0)}
  }).filter(g=>busca.trim()?g.touros.length>0:true).sort((a,b)=>a.cliente.nome.localeCompare(b.cliente.nome,'pt-BR')),[db,busca])

  function salvarEstoque(e:EstoqueSemenItem){
    if(!e.clienteId||!e.touroId)return alert('Informe cliente e touro.')
    const existente=e.id?db.estoque.find(x=>x.id===e.id):undefined
    const qtd=n(e.quantidade),usadas=n(e.usadas),saldo=Math.max(0,qtd-usadas)
    const item={...e,id:e.id||id('SEMEST'),quantidade:qtd,usadas,saldo}
    const estoque=e.id?db.estoque.map(x=>x.id===e.id?item:x):[...db.estoque,item]
    const delta=existente?qtd-n(existente.quantidade):qtd
    let movimentacoes=db.movimentacoes
    if(delta!==0){
      const mov:MovimentacaoItem={id:id('MOV'),data:new Date().toISOString(),tipo:delta>0?'ENTRADA_SEMEN':'AJUSTE',clienteId:item.clienteId,touroId:item.touroId,estoqueId:item.id,quantidade:Math.abs(delta),descricao:delta>0?'Entrada/ajuste de estoque de sêmen':'Redução/ajuste manual de estoque de sêmen'}
      movimentacoes=[...movimentacoes,mov]
    }
    onChange({...db,estoque,movimentacoes});setEditEstoque(null)
  }

  function salvarTouro(t:Touro){
    const clienteId=clienteCadastroTouro||t.clienteId||''
    if(!clienteId||!t.nome.trim()||!t.racaId)return alert('Informe cliente, nome do touro e raça.')
    const r=db.racas.find(x=>x.id===t.racaId)
    const atual=db.touros.find(x=>x.id===t.id)
    const ids=Array.from(new Set([...(atual?.clienteIds||[]),...(t.clienteIds||[]),clienteId].filter(Boolean)))
    const item={...t,id:t.id||id('TOU'),clienteId:ids[0]||clienteId,clienteIds:ids,raca:r?.nome||'',central:(t.central||'').trim()}
    const touros=t.id?db.touros.map(x=>x.id===t.id?item:x):[...db.touros,item]
    onChange({...db,touros});setEditTouro(null);setClienteCadastroTouro('')
  }

  function novoTouro(clienteId:string){setClienteCadastroTouro(clienteId);setEditTouro({...vazioTouro,clienteId,clienteIds:[clienteId]})}
  function novaEntrada(clienteId:string,touroId?:string){setEditEstoque({...vazioEstoque,clienteId,touroId:touroId||''})}

  return <section className="panel semen-unified">
    <div className="panel-head"><div><h2>Estoque de Sêmen</h2><p>Cadastre os touros diretamente na pasta de cada cliente e controle partidas, doses e localização.</p></div></div>
    <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Localizar cliente, touro, raça, central, partida ou recipiente"/></div>

    <div className={`semen-client-grid ${clienteAberto&&!busca.trim()?'has-open':''}`}>
      {grupos.map(g=>{
        const aberto=clienteAberto===g.cliente.id
        if(clienteAberto&&!aberto)return null
        return <div className={`semen-client-card ${aberto?'is-open':''}`} key={g.cliente.id}>
          <button type="button" className="semen-client-button" onClick={()=>{setClienteAberto(aberto?null:g.cliente.id);if(!aberto)setBusca('')}}>
            <span className="semen-folder-icon">▰</span>
            <span className="semen-client-main"><strong>{g.cliente.nome}</strong><small>{g.cliente.propriedade||g.cliente.municipio||'Cliente'}</small></span>
            <span className="semen-client-count">{g.totalTouros} touro(s)</span>
            <span className="semen-dose-count">{g.saldo.toLocaleString('pt-BR')} dose(s)</span>
          </button>
          {aberto&&<div className="semen-open-content">
            <div className="semen-open-head">
              <div><strong>{g.cliente.nome}</strong><span>{g.totalTouros} touro(s) • {g.saldo.toLocaleString('pt-BR')} dose(s) em saldo</span></div>
              <div className="actions"><button className="btn small" onClick={()=>{setClienteAberto(null);setBusca('')}}>Voltar aos clientes</button><button className="btn primary small" onClick={()=>novoTouro(g.cliente.id)}>+ Cadastrar touro</button></div>
            </div>
            {g.touros.length?<div className="semen-bulls">{g.touros.map(t=>{
              const r=db.racas.find(x=>x.id===t.racaId)
              const itens=g.estoque.filter(e=>e.touroId===t.id)
              const saldo=itens.reduce((a,e)=>a+n(e.saldo),0)
              return <div className="semen-bull" key={t.id}>
                <div className="semen-bull-head"><div><strong>{t.nome}</strong><span>{r?.abreviatura||t.raca||'—'} • {t.tipoSemen||'Convencional'}{t.central?` • ${t.central}`:''}</span></div><div className="actions"><span className="semen-balance">{saldo.toLocaleString('pt-BR')} dose(s)</span><button className="btn small" onClick={()=>{setClienteCadastroTouro(g.cliente.id);setEditTouro({...t})}}>Editar touro</button><button className="btn small primary" onClick={()=>novaEntrada(g.cliente.id,t.id)}>+ Entrada</button></div></div>
                {itens.length?<div className="table-wrap"><table><thead><tr><th>Partida</th><th>Entrada</th><th>Usadas</th><th>Saldo</th><th>Localização</th><th>Ações</th></tr></thead><tbody>{itens.map(e=><tr key={e.id}><td><strong>{e.partida||'—'}</strong></td><td>{e.quantidade}</td><td>{e.usadas}</td><td><strong>{e.saldo}</strong></td><td>{e.recipienteTipo||''} {e.recipiente||'—'}</td><td><div className="actions"><button className="btn small" onClick={()=>setEditEstoque({...e})}>Editar</button><button className="btn small danger" onClick={()=>{if(confirm('Excluir este item do estoque de sêmen?'))onChange({...db,estoque:db.estoque.filter(x=>x.id!==e.id)})}}>Excluir</button></div></td></tr>)}</tbody></table></div>:<div className="semen-empty">Touro cadastrado, ainda sem doses em estoque. <button className="btn small" onClick={()=>novaEntrada(g.cliente.id,t.id)}>Registrar entrada</button></div>}
              </div>
            })}</div>:<div className="note-box">Nenhum touro cadastrado para este cliente. <button className="btn primary small" onClick={()=>novoTouro(g.cliente.id)}>Cadastrar primeiro touro</button></div>}
          </div>}
        </div>
      })}
    </div>

    {editTouro&&<Modal title={editTouro.id?'Editar touro':'Cadastrar touro no estoque do cliente'} onClose={()=>{setEditTouro(null);setClienteCadastroTouro('')}}><div className="form-grid" onKeyDown={handleEnterFlow}>
      <Field label="Cliente"><select value={clienteCadastroTouro||editTouro.clienteId||''} disabled={!!clienteCadastroTouro} onChange={e=>{setClienteCadastroTouro(e.target.value);setEditTouro({...editTouro,clienteId:e.target.value,clienteIds:[e.target.value]})}}><option value="">Selecione...</option>{db.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
      <Field label="Nome do touro"><input value={editTouro.nome} onChange={e=>setEditTouro({...editTouro,nome:e.target.value})}/></Field>
      <Field label="Registro"><input value={editTouro.registro||''} onChange={e=>setEditTouro({...editTouro,registro:e.target.value})}/></Field>
      <Field label="Raça"><select value={editTouro.racaId||''} onChange={e=>setEditTouro({...editTouro,racaId:e.target.value})}><option value="">Selecione...</option>{db.racas.map(r=><option key={r.id} value={r.id}>{r.abreviatura} — {r.nome}</option>)}</select></Field>
      <Field label="Central"><input list="centrais-brasil-unificado" value={editTouro.central||''} onChange={e=>setEditTouro({...editTouro,central:e.target.value})}/><datalist id="centrais-brasil-unificado">{CENTRAIS_BRASIL.map(c=><option key={c} value={c}/>)}</datalist></Field>
      <Field label="Código"><input value={editTouro.codigo||''} onChange={e=>setEditTouro({...editTouro,codigo:e.target.value})}/></Field>
      <Field label="Tipo de sêmen"><select value={editTouro.tipoSemen||'Convencional'} onChange={e=>setEditTouro({...editTouro,tipoSemen:e.target.value as TipoSemen})}><option>Convencional</option><option>Sexado macho</option><option>Sexado fêmea</option></select></Field>
      <Field label="Observações"><input value={editTouro.obs||''} onChange={e=>setEditTouro({...editTouro,obs:e.target.value})}/></Field>
    </div><div className="modal-actions"><button className="btn" onClick={()=>{setEditTouro(null);setClienteCadastroTouro('')}}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvarTouro(editTouro)}>Salvar touro</button></div></Modal>}

    {editEstoque&&<Modal title={editEstoque.id?'Editar estoque de sêmen':'Nova entrada de sêmen'} onClose={()=>setEditEstoque(null)}><div className="form-grid" onKeyDown={handleEnterFlow}>
      <Field label="Cliente"><SearchableSelect value={editEstoque.clienteId} onChange={v=>setEditEstoque({...editEstoque,clienteId:v,touroId:''})} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></Field>
      <Field label="Touro"><SearchableSelect value={editEstoque.touroId} onChange={v=>setEditEstoque({...editEstoque,touroId:v})} options={db.touros.filter(t=>touroDoCliente(t,editEstoque.clienteId)).map(t=>({value:t.id,label:t.nome,search:[t.registro,t.codigo,t.tipoSemen].join(' ')}))} placeholder="Digite o nome do touro"/></Field>
      <Field label="Partida / lote"><input value={editEstoque.partida||''} onChange={e=>setEditEstoque({...editEstoque,partida:e.target.value})}/></Field>
      <Field label="Quantidade de entrada"><input type="number" min="0" step="0.1" value={editEstoque.quantidade} onChange={e=>setEditEstoque({...editEstoque,quantidade:n(e.target.value),saldo:Math.max(0,n(e.target.value)-n(editEstoque.usadas))})}/></Field>
      <Field label="Doses já utilizadas"><input type="number" min="0" step="0.1" value={editEstoque.usadas} onChange={e=>setEditEstoque({...editEstoque,usadas:n(e.target.value),saldo:Math.max(0,n(editEstoque.quantidade)-n(e.target.value))})}/></Field>
      <Field label="Tipo de recipiente"><select value={editEstoque.recipienteTipo||'CANECA'} onChange={e=>setEditEstoque({...editEstoque,recipienteTipo:e.target.value as any})}><option value="CANECA">CANECA</option><option value="BOTIJAO">BOTIJÃO</option></select></Field>
      <Field label="Identificação do recipiente"><input value={editEstoque.recipiente||''} onChange={e=>setEditEstoque({...editEstoque,recipiente:e.target.value})}/></Field>
      <Field label="Observações"><input value={editEstoque.obs||''} onChange={e=>setEditEstoque({...editEstoque,obs:e.target.value})}/></Field>
    </div><div className="calc-box">Saldo calculado: <strong>{Math.max(0,n(editEstoque.quantidade)-n(editEstoque.usadas)).toLocaleString('pt-BR')}</strong> dose(s)</div><div className="modal-actions"><button className="btn" onClick={()=>setEditEstoque(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvarEstoque(editEstoque)}>Salvar estoque</button></div></Modal>}
  </section>
}

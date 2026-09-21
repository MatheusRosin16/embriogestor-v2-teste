import { useMemo, useState } from 'react'
import type { Aspiracao, BancoEmbrioGestor, Producao } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'

const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const hoje=()=>new Date().toISOString().slice(0,10)
const vazio:Aspiracao={id:'',data:hoje(),clienteId:'',doadoraId:'',grau1:0,grau2:0,grau3:0,grau4:0,grau5:0,touroId:'',obs:''}
const n=(v:any)=>Math.max(0,Number(v)||0)
const totalAspiracao=(a:Aspiracao)=>a.geradaPelaProducao?n(a.oocitosTotaisInformados):n(a.grau1)+n(a.grau2)+n(a.grau3)+n(a.grau4)
const viaveisAspiracao=(a:Aspiracao)=>a.geradaPelaProducao?n(a.oocitosViaveisInformados):n(a.grau1)+n(a.grau2)+n(a.grau3)

export function Aspiracoes({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Aspiracao|null>(null)
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)
  const[dataAberta,setDataAberta]=useState<string|null>(null)

  const grupos=useMemo(()=>{
    const porCliente=new Map<string,Aspiracao[]>()
    for(const a of db.aspiracoes){
      const c=db.clientes.find(x=>x.id===a.clienteId)
      const d=db.doadoras.find(x=>x.id===a.doadoraId)
      const q=busca.toLowerCase()
      if(q&&!String(c?.nome+' '+d?.nome+' '+a.data).toLowerCase().includes(q))continue
      if(!porCliente.has(a.clienteId))porCliente.set(a.clienteId,[])
      porCliente.get(a.clienteId)!.push(a)
    }
    return [...porCliente.entries()].map(([clienteId,itens])=>({
      cliente:db.clientes.find(c=>c.id===clienteId),
      itens:itens.sort((a,b)=>b.data.localeCompare(a.data))
    })).filter(g=>g.cliente).sort((a,b)=>a.cliente!.nome.localeCompare(b.cliente!.nome,'pt-BR'))
  },[db,busca])

  function criarOuAtualizarProducao(base:BancoEmbrioGestor,a:Aspiracao){
    const total=totalAspiracao(a)
    const viaveis=viaveisAspiracao(a)
    const existente=base.producoes.find(p=>p.origemAspiracaoId===a.id) ||
      base.producoes.find(p=>p.clienteId===a.clienteId&&p.data===a.data&&p.doadoraId===a.doadoraId)

    if(existente){
      return base.producoes.map(p=>p.id===existente.id?{
        ...p,data:a.data,clienteId:a.clienteId,doadoraId:a.doadoraId,
        oocitos:total,oocitosViaveis:viaveis,origemAspiracaoId:a.id
      }:p)
    }

    const prod:Producao={
      id:id('PROD'),data:a.data,clienteId:a.clienteId,doadoraId:a.doadoraId,
      touroId:'',oocitos:total,oocitosViaveis:viaveis,clivados:0,embriõesD7:0,
      transferidosFresco:0,congeladosDT:0,congeladosVT:0,
      origemAspiracaoId:a.id,obs:''
    }
    return [...base.producoes,prod]
  }

  function salvar(a:Aspiracao){
    if(!a.clienteId||!a.doadoraId||!a.data)return alert('Informe data, cliente e doadora.')
    const temClassificacao=n(a.grau1)+n(a.grau2)+n(a.grau3)+n(a.grau4)+n(a.grau5)>0
    const item={...a,
      grau1:n(a.grau1),grau2:n(a.grau2),grau3:n(a.grau3),grau4:n(a.grau4),grau5:n(a.grau5),
      geradaPelaProducao:a.geradaPelaProducao&&!temClassificacao
    }
    if(!item.id)item.id=id('ASP')
    const aspiracoes=a.id?db.aspiracoes.map(x=>x.id===a.id?item:x):[...db.aspiracoes,item]
    const base={...db,aspiracoes}
    const producoes=criarOuAtualizarProducao(base,item)
    onChange({...base,producoes})
    setEdit(null)
  }

  function excluir(a:Aspiracao){
    if(!confirm('Excluir esta aspiração? A produção automática vazia vinculada também será removida.'))return
    const prod=db.producoes.find(p=>p.origemAspiracaoId===a.id)
    const producoes=prod && !prod.touroId && !prod.clivados && !prod.embriõesD7 && !prod.transferidosFresco && !prod.congeladosDT && !prod.congeladosVT
      ? db.producoes.filter(p=>p.id!==prod.id)
      : db.producoes
    onChange({...db,aspiracoes:db.aspiracoes.filter(x=>x.id!==a.id),producoes})
  }

  const doadorasCliente=edit?db.doadoras.filter(d=>d.clienteId===edit.clienteId):[]

  return <section className="panel opu-date-design">
    <div className="panel-head"><div><h2>Aspiração de Oócitos</h2><p>Aspirações organizadas por cliente e, dentro de cada cliente, por data.</p></div><button className="btn primary" onClick={()=>setEdit({...vazio})}>Nova aspiração</button></div>
    <div className="toolbar donor-search-toolbar"><SearchBar value={busca} onChange={v=>{setBusca(v);if(v){setClienteAberto(null);setDataAberta(null)}}} placeholder="Pesquisar cliente, doadora ou data"/></div>

    <div className={`donor-folders ${clienteAberto&&!busca.trim()?'has-open':''}`}>
      {grupos.map(g=>{
        const aberto=clienteAberto===g.cliente!.id
        if(clienteAberto&&!aberto)return null
        const datas=[...new Set(g.itens.map(a=>String(a.data||'').slice(0,10)))].sort((a,b)=>b.localeCompare(a))
        return <div className={`donor-client-card ${aberto?'is-open':''}`} key={g.cliente!.id}>
          <button type="button" className="donor-client-button" onClick={()=>{setClienteAberto(aberto?null:g.cliente!.id);setDataAberta(null);if(!aberto)setBusca('')}}>
            <span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{g.cliente!.nome}</strong><small>{g.cliente!.propriedade||g.cliente!.municipio||'Cliente'}</small></span><span className="donor-folder-count">{datas.length} data(s)</span>
          </button>
          {aberto&&<div className="donor-open-content">
            <div className="donor-open-head"><div><strong>{g.cliente!.nome}</strong><span>{g.itens.length} aspiração(ões) em {datas.length} data(s)</span></div><div className="actions"><button className="btn small" onClick={()=>{setClienteAberto(null);setDataAberta(null);setBusca('')}}>Voltar aos clientes</button><button className="btn primary small" onClick={()=>setEdit({...vazio,clienteId:g.cliente!.id})}>+ Nova aspiração</button></div></div>
            <div className="date-folder-grid">{datas.map(data=>{
              const itensData=g.itens.filter(a=>String(a.data||'').slice(0,10)===data)
              const chave=g.cliente!.id+'|'+data
              const dataOpen=dataAberta===chave
              return <div className={`date-folder-card ${dataOpen?'is-open':''}`} key={chave}>
                <button className="date-folder-button" onClick={()=>setDataAberta(dataOpen?null:chave)}><span className="date-folder-icon">▰</span><span><strong>{data.split('-').reverse().join('/')}</strong><small>{itensData.length} aspiração(ões)</small></span></button>
                {dataOpen&&<div className="date-folder-content"><div className="date-folder-head"><strong>Aspirações de {data.split('-').reverse().join('/')}</strong><button className="btn small" onClick={()=>setDataAberta(null)}>Fechar data</button></div>
                <div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Raça</th><th>G1</th><th>G2</th><th>G3</th><th>G4</th><th>G5</th><th>Total</th><th>Viáveis</th><th>Ações</th></tr></thead><tbody>
                {itensData.map(a=>{const d=db.doadoras.find(x=>x.id===a.doadoraId);const r=db.racas.find(x=>x.id===d?.racaId);return <tr key={a.id}><td><strong>{d?.nome}</strong>{a.geradaPelaProducao&&<small className="auto-opu-badge">Automática</small>}</td><td>{r?.abreviatura||d?.raca}</td><td>{a.grau1}</td><td>{a.grau2}</td><td>{a.grau3}</td><td>{a.grau4}</td><td>{a.grau5}</td><td><strong>{totalAspiracao(a)}</strong></td><td><strong>{viaveisAspiracao(a)}</strong></td><td><div className="actions"><button className="btn small" onClick={()=>setEdit({...a})}>Editar</button><button className="btn small danger" onClick={()=>excluir(a)}>Excluir</button></div></td></tr>})}
                </tbody></table></div></div>}
              </div>
            })}</div>
          </div>}
        </div>
      })}
      {!grupos.length&&<div className="note-box">Nenhuma aspiração cadastrada.</div>}
    </div>

    {edit&&<Modal title={edit.id?'Editar aspiração':'Nova aspiração'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Data"><input type="date" value={edit.data} onChange={e=>setEdit({...edit,data:e.target.value})}/></Field>
        <Field label="Cliente"><SearchableSelect value={edit.clienteId} onChange={v=>setEdit({...edit,clienteId:v,doadoraId:''})} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></Field>
        <Field label="Doadora"><SearchableSelect value={edit.doadoraId} onChange={v=>setEdit({...edit,doadoraId:v})} options={doadorasCliente.map(d=>({value:d.id,label:d.nome,search:[d.registro,d.raca,d.categoria].join(' ')}))} placeholder="Digite o número/nome da doadora"/></Field>
        <Field label="G1"><input type="number" min="0" value={edit.grau1} onChange={e=>setEdit({...edit,grau1:n(e.target.value)})}/></Field>
        <Field label="G2"><input type="number" min="0" value={edit.grau2} onChange={e=>setEdit({...edit,grau2:n(e.target.value)})}/></Field>
        <Field label="G3"><input type="number" min="0" value={edit.grau3} onChange={e=>setEdit({...edit,grau3:n(e.target.value)})}/></Field>
        <Field label="G4"><input type="number" min="0" value={edit.grau4} onChange={e=>setEdit({...edit,grau4:n(e.target.value)})}/></Field>
        <Field label="G5"><input type="number" min="0" value={edit.grau5} onChange={e=>setEdit({...edit,grau5:n(e.target.value)})}/></Field>
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>
      <div className="calc-box">{edit.geradaPelaProducao
        ? <>OPU automática — Oócitos totais: <strong>{totalAspiracao(edit)}</strong> &nbsp; • &nbsp; Viáveis: <strong>{viaveisAspiracao(edit)}</strong> &nbsp; • &nbsp; G1–G5 permanecem 0 até classificação manual.</>
        : <>Oócitos totais para Produção: <strong>{totalAspiracao(edit)}</strong> &nbsp; • &nbsp; Viáveis: <strong>{viaveisAspiracao(edit)}</strong></>}</div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar e gerar produção</button></div>
    </Modal>}
  </section>
}

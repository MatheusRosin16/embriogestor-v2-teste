import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Transferencia, MovimentacaoItem } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'
import { touroDoCliente } from '../services/tourosClientes'

const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const hoje=()=>new Date().toISOString().slice(0,10)

const vazio:Transferencia={
  id:'',
  data:hoje(),
  clienteId:'',
  doadoraId:'',
  touroId:'',
  origemProducaoId:'',
  usarDoadoraOutroProdutor:false,
  receptora:'',
  embriãoEstagio:'',
  embriãoGrau:'',
  ovarioCL:'',
  destino:'Fresco',
  diagnostico:'',
  dataDiagnostico:'',
  profissionalId:'',
  obs:''
}

function nomeTipo(v?:string){
  if(v==='Fresco') return 'FRESCO'
  return v||'—'
}

export function Transferencias({
  db,
  onChange
}:{
  db:BancoEmbrioGestor
  onChange:(db:BancoEmbrioGestor)=>void
}){
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Transferencia|null>(null)
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)
  const[dataAberta,setDataAberta]=useState<string|null>(null)

  const grupos=useMemo(()=>db.clientes.map(c=>{
    const itens=db.transferencias
      .filter(t=>t.clienteId===c.id)
      .filter(t=>{
        const d=db.doadoras.find(x=>x.id===t.doadoraId)
        const touro=db.touros.find(x=>x.id===t.touroId)
        const q=busca.toLowerCase()
        return !q||String(
          c.nome+' '+d?.nome+' '+touro?.nome+' '+t.receptora+' '+
          t.data+' '+t.diagnostico+' '+t.embriãoEstagio+' '+t.embriãoGrau
        ).toLowerCase().includes(q)
      })

    return {
      cliente:c,
      itens:itens.sort((a,b)=>b.data.localeCompare(a.data))
    }
  }).filter(g=>g.itens.length||!busca)
    .sort((a,b)=>a.cliente.nome.localeCompare(b.cliente.nome,'pt-BR')),[db,busca])

  function estoqueCompativel(t:Transferencia){
    if(t.destino!=='DT'&&t.destino!=='VT') return -1

    if(t.estoqueEmbriaoId){
      return db.estoqueEmbrioes.findIndex(e=>e.id===t.estoqueEmbriaoId&&Number(e.quantidade)>0)
    }
    return -1
  }

  function salvar(t:Transferencia){
    if(!t.data||!t.clienteId||!t.doadoraId||!t.touroId||!t.receptora?.trim()){
      return alert('Informe data, cliente, doadora, touro e receptora.')
    }

    if(!t.embriãoEstagio){
      return alert('Informe o estágio do embrião.')
    }

    if(!t.embriãoGrau){
      return alert('Informe o grau D7.')
    }

    if(!t.ovarioCL){
      return alert('Informe Ovário + CL.')
    }

    const item:Transferencia={...t,id:t.id||id('TE')}

    let estoqueEmbrioes=[...db.estoqueEmbrioes]
    let movimentacoes=[...db.movimentacoes]

    /*
      Somente uma NOVA transferência DT/VT baixa estoque.
      Edição não baixa novamente.
    */
    if(!t.id&&(item.destino==='DT'||item.destino==='VT')){
      const idx=estoqueCompativel(item)

      if(idx<0){
        const d=db.doadoras.find(x=>x.id===item.doadoraId)
        const touro=db.touros.find(x=>x.id===item.touroId)
        alert(
          `Selecione a data/origem do congelamento com embrião ${item.destino} disponível `+
          `para ${d?.nome||'esta doadora'} × ${touro?.nome||'este touro'}.`
        )
        return
      }

      const e=estoqueEmbrioes[idx]
      estoqueEmbrioes[idx]={
        ...e,
        quantidade:Math.max(0,Number(e.quantidade)-1)
      }

      const mov:MovimentacaoItem={
        id:id('MOV'),
        data:new Date().toISOString(),
        tipo:'SAIDA_EMBRIAO',
        clienteId:item.clienteId,
        doadoraId:item.doadoraId,
        touroId:item.touroId,
        estoqueId:e.id,
        quantidade:1,
        descricao:
          `Transferência de embrião ${item.destino} — receptora ${item.receptora}`
      }

      movimentacoes=[...movimentacoes,mov]
    }

    const transferencias=t.id
      ? db.transferencias.map(x=>x.id===t.id?item:x)
      : [...db.transferencias,item]

    onChange({...db,transferencias,estoqueEmbrioes,movimentacoes})
    setEdit(null)
  }

  const doadorasCliente=edit
    ? db.doadoras.filter(d=>d.clienteId===edit.clienteId)
    : []

  const doadorasOutros=edit
    ? db.doadoras.filter(d=>d.clienteId!==edit.clienteId)
    : []

  const tourosCliente=edit
    ? db.touros.filter(t=>touroDoCliente(t,edit.clienteId))
    : []

  /*
    Produções exibidas:
    somente do cliente selecionado.
  */
  const producoesCliente=edit
    ? db.producoes.filter(p=>p.clienteId===edit.clienteId)
    : []

  function selecionarProducao(pid:string){
    if(!edit)return

    const p=db.producoes.find(x=>x.id===pid)

    if(!p){
      setEdit({
        ...edit,
        origemProducaoId:''
      })
      return
    }

    setEdit({
      ...edit,
      origemProducaoId:p.id,
      doadoraId:p.doadoraId,
      touroId:p.touroId||'',
      usarDoadoraOutroProdutor:false,
      estoqueEmbriaoId:''
    })
  }

  function trocarCliente(clienteId:string){
    if(!edit)return

    setEdit({
      ...edit,
      clienteId,
      doadoraId:'',
      touroId:'',
      origemProducaoId:'',
      usarDoadoraOutroProdutor:false
    })
  }

  function alternarOutroProdutor(checked:boolean){
    if(!edit)return

    setEdit({
      ...edit,
      usarDoadoraOutroProdutor:checked,
      doadoraId:'',
      origemProducaoId:''
    })
  }

  const estoqueDisponivel=useMemo(()=>{
    if(!edit||edit.destino==='Fresco')return null

    const itens=db.estoqueEmbrioes.filter(e=>
      e.clienteId===edit.clienteId &&
      e.tipo===edit.destino &&
      Number(e.quantidade)>0
    )

    return itens.reduce((s,e)=>s+Number(e.quantidade||0),0)
  },[db.estoqueEmbrioes,edit])

  return <section className="panel transfer-date-design">
    <div className="panel-head"><div><h2>Transferência de Embriões</h2><p>Transferências organizadas por cliente e data. Embriões a fresco da Produção geram linhas automaticamente.</p></div><button className="btn primary" onClick={()=>setEdit({...vazio})}>Nova transferência</button></div>
    <div className="toolbar donor-search-toolbar"><SearchBar value={busca} onChange={v=>{setBusca(v);if(v){setClienteAberto(null);setDataAberta(null)}}} placeholder="Pesquisar cliente, doadora, touro, receptora, estágio ou diagnóstico"/></div>

    <div className={`donor-folders ${clienteAberto&&!busca.trim()?'has-open':''}`}>
      {grupos.map(g=>{const aberto=clienteAberto===g.cliente.id;if(clienteAberto&&!aberto)return null;const datas=[...new Set(g.itens.map(t=>String(t.data||'').slice(0,10)))].sort((a,b)=>b.localeCompare(a));return <div className={`donor-client-card ${aberto?'is-open':''}`} key={g.cliente.id}>
        <button type="button" className="donor-client-button" onClick={()=>{setClienteAberto(aberto?null:g.cliente.id);setDataAberta(null);if(!aberto)setBusca('')}}><span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{g.cliente.nome}</strong><small>{g.cliente.propriedade||g.cliente.municipio||'Cliente'}</small></span><span className="donor-folder-count">{datas.length} data(s)</span></button>
        {aberto&&<div className="donor-open-content"><div className="donor-open-head"><div><strong>{g.cliente.nome}</strong><span>{g.itens.length} transferência(s) em {datas.length} data(s)</span></div><div className="actions"><button className="btn small" onClick={()=>{setClienteAberto(null);setDataAberta(null);setBusca('')}}>Voltar aos clientes</button><button className="btn primary small" onClick={()=>setEdit({...vazio,clienteId:g.cliente.id})}>+ Nova transferência</button></div></div>
        <div className="date-folder-grid">{datas.map(data=>{const itensData=g.itens.filter(t=>String(t.data||'').slice(0,10)===data);const chave=g.cliente.id+'|'+data;const dataOpen=dataAberta===chave;return <div className={`date-folder-card ${dataOpen?'is-open':''}`} key={chave}>
          <button className="date-folder-button" onClick={()=>setDataAberta(dataOpen?null:chave)}><span className="date-folder-icon">▰</span><span><strong>{data.split('-').reverse().join('/')}</strong><small>{itensData.length} transferência(s)</small></span></button>
          {dataOpen&&<div className="date-folder-content"><div className="date-folder-head"><strong>Transferências de {data.split('-').reverse().join('/')}</strong><button className="btn small" onClick={()=>setDataAberta(null)}>Fechar data</button></div>
          <div className="table-wrap"><table><thead><tr><th>Receptora</th><th>Doadora</th><th>Touro</th><th>Estágio</th><th>Grau D7</th><th>Ovário + CL</th><th>Embrião</th><th>DG</th><th>Profissional</th><th>Ações</th></tr></thead><tbody>
          {itensData.map(t=>{const d=db.doadoras.find(x=>x.id===t.doadoraId);const touro=db.touros.find(x=>x.id===t.touroId);const prof=db.profissionais.find(x=>x.id===t.profissionalId);const donoDoadora=db.clientes.find(x=>x.id===d?.clienteId);return <tr key={t.id}><td><strong>{t.receptora||'—'}</strong>{t.geradaPelaProducao&&!t.receptora&&<small className="auto-opu-badge">A preencher</small>}</td><td>{d?.nome||'—'}{d?.clienteId!==t.clienteId&&<small className="sub-info">Outro produtor: {donoDoadora?.nome||'—'}</small>}</td><td>{touro?.nome||'—'}</td><td><strong>{t.embriãoEstagio||'—'}</strong></td><td>{t.embriãoGrau||'—'}</td><td>{t.ovarioCL||'—'}</td><td><strong>{nomeTipo(t.destino)}</strong></td><td>{t.diagnostico||'—'}</td><td>{prof?.nome||'—'}</td><td><div className="actions"><button className="btn small" onClick={()=>setEdit({...t})}>Editar</button><button className="btn small danger" onClick={()=>{if(confirm('Excluir esta transferência?'))onChange({...db,transferencias:db.transferencias.filter(x=>x.id!==t.id)})}}>Excluir</button></div></td></tr>})}
          </tbody></table></div></div>}
        </div>})}</div></div>}
      </div>})}
      {!grupos.length&&<div className="note-box">Nenhuma transferência cadastrada.</div>}
    </div>

    {edit&&
      <Modal
        title={edit.id?'Editar transferência':'Nova transferência'}
        onClose={()=>setEdit(null)}
      >
        <div className="form-grid" onKeyDown={handleEnterFlow}>
          <Field label="Data da transferência">
            <input
              type="date"
              value={edit.data}
              onChange={e=>setEdit({...edit,data:e.target.value})}
            />
          </Field>

          <Field label="Cliente"><SearchableSelect value={edit.clienteId} onChange={trocarCliente} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></Field>

          <Field label="Origem / Produção do cliente">
            <select
              value={edit.origemProducaoId||''}
              onChange={e=>selecionarProducao(e.target.value)}
            >
              <option value="">Selecionar manualmente...</option>

              {producoesCliente.map(p=>{
                const d=db.doadoras.find(x=>x.id===p.doadoraId)
                const touro=db.touros.find(x=>x.id===p.touroId)

                return <option key={p.id} value={p.id}>
                  {p.data.split('-').reverse().join('/')} — {d?.nome} × {touro?.nome||'sem touro'}
                </option>
              })}
            </select>
          </Field>

          <div className="field check-field">
            <span>Doadora</span>

            <label className="check-line">
              <input
                type="checkbox"
                checked={!!edit.usarDoadoraOutroProdutor}
                onChange={e=>alternarOutroProdutor(e.target.checked)}
              />
              Usar doadora de outro produtor
            </label>
          </div>

          <Field label={edit.usarDoadoraOutroProdutor?'Doadora de outro produtor':'Doadora do cliente'}><SearchableSelect value={edit.doadoraId} onChange={v=>setEdit({...edit,doadoraId:v,estoqueEmbriaoId:''})} options={(edit.usarDoadoraOutroProdutor?doadorasOutros:doadorasCliente).map(d=>{const dono=db.clientes.find(c=>c.id===d.clienteId);return {value:d.id,label:edit.usarDoadoraOutroProdutor?`${dono?.nome||'Outro produtor'} — ${d.nome}`:d.nome,search:[d.registro,d.raca].join(' ')}})} placeholder="Digite o número/nome da doadora"/></Field>

          <Field label="Touro do cliente"><SearchableSelect value={edit.touroId} onChange={v=>setEdit({...edit,touroId:v,estoqueEmbriaoId:''})} options={tourosCliente.map(t=>({value:t.id,label:t.nome,search:[t.registro,t.codigo,t.tipoSemen].join(' ')}))} placeholder="Digite o nome do touro"/></Field>

          <Field label="Receptora">
            <input
              value={edit.receptora||''}
              onChange={e=>setEdit({...edit,receptora:e.target.value})}
            />
          </Field>

          <Field label="Estágio">
            <select
              value={edit.embriãoEstagio||''}
              onChange={e=>setEdit({
                ...edit,
                embriãoEstagio:e.target.value as Transferencia['embriãoEstagio']
              })}
            >
              <option value="">Selecione...</option>
              <option value="MO">MO</option>
              <option value="BI">BI</option>
              <option value="BL">BL</option>
              <option value="BX">BX</option>
              <option value="BN">BN</option>
              <option value="BE">BE</option>
            </select>
          </Field>

          <Field label="Grau D7">
            <select
              value={edit.embriãoGrau||''}
              onChange={e=>setEdit({
                ...edit,
                embriãoGrau:e.target.value as Transferencia['embriãoGrau']
              })}
            >
              <option value="">Selecione...</option>
              <option value="G1">G1</option>
              <option value="G2">G2</option>
              <option value="G3">G3</option>
            </select>
          </Field>

          <Field label="Ovário + CL">
            <select
              value={edit.ovarioCL||''}
              onChange={e=>setEdit({
                ...edit,
                ovarioCL:e.target.value as Transferencia['ovarioCL']
              })}
            >
              <option value="">Selecione...</option>
              <option value="OE1">OE1</option>
              <option value="OE2">OE2</option>
              <option value="OE3">OE3</option>
              <option value="OD1">OD1</option>
              <option value="OD2">OD2</option>
              <option value="OD3">OD3</option>
            </select>
          </Field>

          <Field label="Embrião">
            <select
              value={edit.destino||'Fresco'}
              onChange={e=>setEdit({
                ...edit,
                destino:e.target.value as Transferencia['destino'],
                estoqueEmbriaoId:''
              })}
            >
              <option value="Fresco">FRESCO</option>
              <option value="DT">DT</option>
              <option value="VT">VT</option>
            </select>
          </Field>

          {(edit.destino==='DT'||edit.destino==='VT')&&<Field label="Data/origem do congelamento">
            <select value={edit.estoqueEmbriaoId||''} onChange={e=>setEdit({...edit,estoqueEmbriaoId:e.target.value})}>
              <option value="">Selecione a data do congelamento...</option>
              {db.estoqueEmbrioes.filter(e=>e.clienteId===edit.clienteId&&e.doadoraId===edit.doadoraId&&e.touroId===edit.touroId&&e.tipo===edit.destino&&Number(e.quantidade)>0).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).map(e=><option key={e.id} value={e.id}>{e.data?e.data.split('-').reverse().join('/'):'Sem data'} — {e.tipo} — saldo {e.quantidade} — {e.botijao||'sem botijão'}/{e.caneca||'sem caneca'}</option>)}
            </select>
          </Field>}

          <Field label="Profissional">
            <select
              value={edit.profissionalId||''}
              onChange={e=>setEdit({...edit,profissionalId:e.target.value})}
            >
              <option value="">Selecione...</option>
              {db.profissionais.map(p=>
                <option key={p.id} value={p.id}>{p.nome}</option>
              )}
            </select>
          </Field>

          <Field label="Diagnóstico">
            <select
              value={edit.diagnostico||''}
              onChange={e=>setEdit({...edit,diagnostico:e.target.value})}
            >
              <option value="">Pendente</option>
              <option>Positiva</option>
              <option>Negativa</option>
              <option>Reabsorção</option>
              <option>Aborto</option>
            </select>
          </Field>

          <Field label="Data do diagnóstico">
            <input
              type="date"
              value={edit.dataDiagnostico||''}
              onChange={e=>setEdit({...edit,dataDiagnostico:e.target.value})}
            />
          </Field>

          <Field label="Observações">
            <input
              value={edit.obs||''}
              onChange={e=>setEdit({...edit,obs:e.target.value})}
            />
          </Field>
        </div>

        {(edit.destino==='DT'||edit.destino==='VT')&&
          <div className="stock-warning">
            <strong>Estoque {edit.destino} do cliente:</strong>{' '}
            {estoqueDisponivel??0} embrião(ões) disponível(is).
            <br/>
            Selecione acima a data/origem do congelamento. Ao salvar uma nova transferência, 1 embrião será retirado exatamente desse lote.
          </div>
        }

        <div className="modal-actions">
          <button className="btn" onClick={()=>setEdit(null)}>
            Cancelar
          </button>

          <button
            className="btn primary"
            data-enter-final="true"
            onClick={()=>salvar(edit)}
          >
            Salvar transferência
          </button>
        </div>
      </Modal>
    }
  </section>
}

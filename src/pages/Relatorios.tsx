import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor } from '../types/domain'
import { Modal, SearchBar } from '../components/CrudUI'

type TipoPeriodo='dia'|'mes'|'ano'
type TipoRelatorio='producao'|'congelamento'|'transferencia'|'estoques'

const n=(v:any)=>Math.max(0,Number(v)||0)
const br=(d?:string)=>d?d.split('-').reverse().join('/'):'—'
const pct=(a:number,b:number)=>b?Math.round(a/b*100)+'%':'0%'

function periodoPadrao(tipo:TipoPeriodo){
  const h=new Date()
  const y=h.getFullYear(), m=String(h.getMonth()+1).padStart(2,'0'), d=String(h.getDate()).padStart(2,'0')
  return tipo==='dia'?`${y}-${m}-${d}`:tipo==='mes'?`${y}-${m}`:String(y)
}

function noPeriodo(data:string,tipo:TipoPeriodo,valor:string){
  if(!data||!valor)return false
  if(tipo==='dia')return data===valor
  if(tipo==='mes')return data.startsWith(valor)
  return data.startsWith(valor+'-')
}

function tituloPeriodo(tipo:TipoPeriodo,valor:string){
  if(tipo==='dia')return br(valor)
  if(tipo==='mes'){
    const [a,m]=valor.split('-')
    return `${m}/${a}`
  }
  return valor
}

export function Relatorios({db}:{db:BancoEmbrioGestor}){
  const[tipoPeriodo,setTipoPeriodo]=useState<TipoPeriodo>('dia')
  const[periodo,setPeriodo]=useState(periodoPadrao('dia'))
  const[obsRelatorio,setObsRelatorio]=useState('')
  const[nomeClienteRelatorio,setNomeClienteRelatorio]=useState('')
  const[relatorio,setRelatorio]=useState<{clienteId:string;tipo:TipoRelatorio}|null>(null)
  const[busca,setBusca]=useState('')
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)
  const empresa=db.identidadeEmpresa
  const nomeEmpresa=(empresa?.nome||'SÊMINNA - LABORATÓRIO DE REPRODUÇÃO ANIMAL').toUpperCase().replace(/[–—]/g,'-')
  const fantasia=empresa?.nomeFantasia||nomeEmpresa
  const enderecoEmpresa=empresa?.endereco||'AV. General Osório, 797, sala 01, Francisco Beltrão - PR'

  const clientes=[...db.clientes].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))

  function mudarTipo(v:TipoPeriodo){
    setTipoPeriodo(v)
    setPeriodo(periodoPadrao(v))
  }

  function clienteNome(id:string){return db.clientes.find(c=>c.id===id)?.nome||'—'}
  function doadora(id:string){return db.doadoras.find(d=>d.id===id)}
  function touro(id?:string){return db.touros.find(t=>t.id===id)}
  function racaD(id:string){
    const d=doadora(id), r=db.racas.find(x=>x.id===d?.racaId)
    return r?.abreviatura||d?.raca||''
  }
  function racaT(id?:string){
    const t=touro(id), r=db.racas.find(x=>x.id===t?.racaId)
    return r?.abreviatura||t?.raca||''
  }

  function datasUnicas(itens:{data:string}[]){return new Set(itens.map(x=>String(x.data||'').slice(0,10)).filter(Boolean)).size}
  function contagensCliente(clienteId:string){
    const prods=db.producoes.filter(x=>x.clienteId===clienteId)
    const congelamentos=prods.filter(x=>n(x.congeladosDT)+n(x.congeladosVT)>0)
    const transferencias=db.transferencias.filter(x=>x.clienteId===clienteId)
    const temEstoque=db.estoque.some(x=>x.clienteId===clienteId)||db.estoqueEmbrioes.some(x=>x.clienteId===clienteId&&n(x.quantidade)>0)
    const producao=datasUnicas(prods), congelamento=datasUnicas(congelamentos), transferencia=datasUnicas(transferencias), estoques=temEstoque?1:0
    return {producao,congelamento,transferencia,estoques,total:producao+congelamento+transferencia+estoques}
  }
  function secaoProducao(clienteId:string,data:string){
    const ano=String(data||'').slice(0,4)
    if(!ano)return ''
    const mapa=new Map<string,{clienteId:string;data:string}>()
    db.producoes.filter(p=>String(p.data||'').startsWith(ano+'-')).forEach(p=>{
      const d=String(p.data||'').slice(0,10), chave=`${p.clienteId}|${d}`
      if(d&&!mapa.has(chave))mapa.set(chave,{clienteId:p.clienteId,data:d})
    })
    const servicos=[...mapa.values()].sort((a,b)=>a.data.localeCompare(b.data)||(clienteNome(a.clienteId)).localeCompare(clienteNome(b.clienteId),'pt-BR'))
    const idx=servicos.findIndex(x=>x.clienteId===clienteId&&x.data===String(data).slice(0,10))
    return idx>=0?`SESSÃO ${idx+1}/${ano}`:`SESSÃO —/${ano}`
  }

  const dados=useMemo(()=>{
    if(!relatorio)return null
    const cid=relatorio.clienteId
    const prods=db.producoes.filter(x=>x.clienteId===cid&&noPeriodo(x.data,tipoPeriodo,periodo))
    const tes=db.transferencias.filter(x=>x.clienteId===cid&&noPeriodo(x.data,tipoPeriodo,periodo)).sort((a,b)=>{
      const pa=db.producoes.find(p=>p.id===a.origemProducaoId),pb=db.producoes.find(p=>p.id===b.origemProducaoId)
      return a.data.localeCompare(b.data)||(n(pa?.ordem)-n(pb?.ordem))||db.transferencias.indexOf(a)-db.transferencias.indexOf(b)
    })
    return {prods,tes}
  },[db,relatorio,tipoPeriodo,periodo])

  function agruparData<T extends {data:string;ordem?:number}>(itens:T[]){
    const mp=new Map<string,T[]>()
    ;[...itens].sort((a,b)=>a.data.localeCompare(b.data)||(n(a.ordem)-n(b.ordem))||itens.indexOf(a)-itens.indexOf(b)).forEach(x=>{
      const arr=mp.get(x.data)||[];arr.push(x);mp.set(x.data,arr)
    })
    return [...mp.entries()]
  }

  function imprimir(){
    window.print()
  }

  function RelatorioConteudo(){
    if(!relatorio||!dados)return null
    const cliente=db.clientes.find(c=>c.id===relatorio.clienteId)
    if(!cliente)return null

    const dataProducao=relatorio.tipo==='producao'&&tipoPeriodo==='dia'&&dados.prods.length?dados.prods[0].data:''
    const head=<>
      <div className="legacy-report-header modern-report-header">
        <div className="legacy-report-brand">{empresa?.logoDataUrl&&<img src={empresa.logoDataUrl} alt="Logo da empresa"/>}</div>
        <div className="modern-report-heading">
          <h1>{nomeEmpresa}</h1>
          <div className="legacy-report-meta modern-report-meta">
            <div className="report-meta-row report-meta-client"><b>CLIENTE:</b><span>{nomeClienteRelatorio||cliente.nome}</span></div>
            {cliente.propriedade&&<div className="report-meta-row"><b>PROPRIEDADE:</b><span>{cliente.propriedade}</span></div>}
            {cliente.municipio&&<div className="report-meta-row"><b>MUNICÍPIO:</b><span>{cliente.municipio}</span></div>}
            {relatorio.tipo==='producao'&&dataProducao&&<div className="report-meta-row report-meta-production"><b>DATA:</b><span>{br(dataProducao)}</span><b>SESSÃO:</b><span>{secaoProducao(cliente.id,dataProducao).replace('SESSÃO ','')}</span></div>}
            {relatorio.tipo!=='producao'&&<div className="report-meta-row"><b>PERÍODO:</b><span>{tituloPeriodo(tipoPeriodo,periodo)}</span></div>}
          </div>
        </div>
      </div>
    </>

    if(relatorio.tipo==='producao'){
      const grupos=agruparData(dados.prods)
      const geral=dados.prods.reduce((a,p)=>({
        o:a.o+n(p.oocitos),v:a.v+n(p.oocitosViaveis),c:a.c+n(p.clivados),e:a.e+n(p.embriõesD7),
        f:a.f+n(p.transferidosFresco),dt:a.dt+n(p.congeladosDT),vt:a.vt+n(p.congeladosVT)
      }),{o:0,v:0,c:0,e:0,f:0,dt:0,vt:0})

      return <div className="legacy-report-sheet">
        {head}<h2 className="legacy-report-title">RELATÓRIO PRODUÇÃO IN VITRO DE EMBRIÕES</h2>
        {!grupos.length&&<p>Nenhuma produção cadastrada neste período.</p>}
        {grupos.map(([data,itens])=>{
          const t=itens.reduce((a,p)=>({o:a.o+n(p.oocitos),v:a.v+n(p.oocitosViaveis),c:a.c+n(p.clivados),e:a.e+n(p.embriõesD7),f:a.f+n(p.transferidosFresco),dt:a.dt+n(p.congeladosDT),vt:a.vt+n(p.congeladosVT)}),{o:0,v:0,c:0,e:0,f:0,dt:0,vt:0})
          const semen=db.servicosSemen.filter(s=>s.clienteId===cliente.id&&s.data===data)
          return <div key={data}>
            <div className="legacy-date-title">{tipoPeriodo==='dia'?<span>PRODUÇÃO</span>:<><span>DATA: {br(data)}</span><span>{secaoProducao(cliente.id,data)}</span></>}</div>
            <table className="legacy-table"><thead><tr>
              <th>Nº</th><th>DOADORA</th><th>RAÇA</th><th>TOURO</th><th>RAÇA</th>
              <th>OÓCITOS TOTAIS</th><th>OÓCITOS VIÁVEIS</th><th>CLIVAGEM</th><th>%CLIV</th>
              <th>EMB. VIÁVEIS D7</th><th>%PROD</th><th>FRESCO</th><th>DT</th><th>VT</th>
            </tr></thead><tbody>
              {itens.map((p,i)=><tr key={p.id}>
                <td>{i+1}</td><td>{doadora(p.doadoraId)?.nome}</td><td>{racaD(p.doadoraId)}</td>
                <td>{touro(p.touroId)?.nome||''}</td><td>{racaT(p.touroId)}</td>
                <td>{p.oocitos}</td><td>{p.oocitosViaveis}</td><td>{p.clivados}</td><td>{pct(n(p.clivados),n(p.oocitosViaveis))}</td>
                <td>{p.embriõesD7}</td><td>{pct(n(p.embriõesD7),n(p.oocitosViaveis))}</td>
                <td>{p.transferidosFresco}</td><td>{p.congeladosDT}</td><td>{p.congeladosVT}</td>
              </tr>)}
              <tr className="legacy-total"><td colSpan={5}>TOTAL DO DIA</td><td>{t.o}</td><td>{t.v}</td><td>{t.c}</td><td>{pct(t.c,t.v)}</td><td>{t.e}</td><td>{pct(t.e,t.v)}</td><td>{t.f}</td><td>{t.dt}</td><td>{t.vt}</td></tr>
            </tbody></table>
            {itens.some(x=>x.obs)&&<div className="legacy-note"><b>OBS:</b> {[...new Set(itens.map(x=>x.obs).filter(Boolean))].join(' | ')}</div>}
            {!!semen.length&&<div className="legacy-semen">
              <b>SÊMEN UTILIZADO NO SERVIÇO</b>
              <table className="legacy-table small"><thead><tr><th>TOURO</th><th>RAÇA</th><th>PARTIDA</th><th>DOSES</th><th>TIPO DE SÊMEN</th><th>PRODUÇÃO % (EMBRIÕES/OÓCITOS VIÁVEIS)</th></tr></thead>
              <tbody>{semen.map(s=>{const lp=itens.filter(p=>p.touroId===s.touroId);const vv=lp.reduce((a,p)=>a+n(p.oocitosViaveis),0),ee=lp.reduce((a,p)=>a+n(p.embriõesD7),0);return <tr key={s.id}><td>{touro(s.touroId)?.nome}</td><td>{racaT(s.touroId)}</td><td>{s.partida||''}</td><td>{s.doses}</td><td>{touro(s.touroId)?.tipoSemen||''}</td><td>{pct(ee,vv)}</td></tr>})}
              <tr className="legacy-total"><td colSpan={5}>TOTAL</td><td>{pct(t.e,t.v)}</td></tr></tbody></table>
            </div>}
          </div>
        })}
        {!!dados.prods.length&&<div className="legacy-grand"><b>TOTAL DO PERÍODO:</b> Oócitos totais {geral.o} | Viáveis {geral.v} | Clivados {geral.c} | Embriões D7 {geral.e} | Fresco {geral.f} | DT {geral.dt} | VT {geral.vt} | Total congelado {geral.dt+geral.vt}</div>}
        {obsRelatorio&&<div className="legacy-note"><b>OBSERVAÇÃO DO RELATÓRIO:</b> {obsRelatorio}</div>}
        <Rodape/>
      </div>
    }

    if(relatorio.tipo==='congelamento'){
      const prods=dados.prods.filter(p=>n(p.congeladosDT)+n(p.congeladosVT)>0)
      const grupos=agruparData(prods)
      const g=prods.reduce((a,p)=>({dt:a.dt+n(p.congeladosDT),vt:a.vt+n(p.congeladosVT)}),{dt:0,vt:0})
      return <div className="legacy-report-sheet">{head}<h2 className="legacy-report-title">RELATÓRIO DE CONGELAMENTO DE EMBRIÕES</h2>
        {!grupos.length&&<p>Nenhum congelamento cadastrado neste período.</p>}
        {grupos.map(([data,itens])=>{
          let dt=0,vt=0
          return <div key={data}><div className="legacy-date-title">DATA: {br(data)}</div>
            <table className="legacy-table"><thead><tr><th>Nº</th><th>DOADORA</th><th>RAÇA DOADORA</th><th>TOURO</th><th>RAÇA TOURO</th><th>DT</th><th>VT</th><th>TOTAL</th><th>OBS</th></tr></thead>
            <tbody>{itens.map((p,i)=>{dt+=n(p.congeladosDT);vt+=n(p.congeladosVT);return <tr key={p.id}><td>{i+1}</td><td>{doadora(p.doadoraId)?.nome}</td><td>{racaD(p.doadoraId)}</td><td>{touro(p.touroId)?.nome}</td><td>{racaT(p.touroId)}</td><td>{p.congeladosDT}</td><td>{p.congeladosVT}</td><td>{n(p.congeladosDT)+n(p.congeladosVT)}</td><td>{p.obs||''}</td></tr>})}
            <tr className="legacy-total"><td colSpan={5}>TOTAL DO DIA</td><td>{dt}</td><td>{vt}</td><td>{dt+vt}</td><td></td></tr></tbody></table>
          </div>
        })}
        {!!prods.length&&<div className="legacy-grand"><b>TOTAL NO PERÍODO:</b> DT {g.dt} | VT {g.vt} | Total {g.dt+g.vt}</div>}
        {obsRelatorio&&<div className="legacy-note"><b>OBSERVAÇÃO DO RELATÓRIO:</b> {obsRelatorio}</div>}<div className="client-signature"><span></span><b>ASSINATURA DO CLIENTE</b></div><Rodape/>
      </div>
    }

    if(relatorio.tipo==='transferencia'){
      const grupos=agruparData(dados.tes)
      const diagOk=(x:any)=>['positiva','prenhe'].includes(String(x.diagnostico||'').toLowerCase())
      const diagNeg=(x:any)=>['negativa','vazia'].includes(String(x.diagnostico||'').toLowerCase())
      const prenhes=dados.tes.filter(diagOk).length,vazias=dados.tes.filter(diagNeg).length
      const avaliadas=prenhes+vazias
      return <div className="legacy-report-sheet">{head}<h2 className="legacy-report-title">PLANILHA DE TRANSFERÊNCIA DE EMBRIÕES</h2>
        {!grupos.length&&<p>Nenhuma transferência cadastrada neste período.</p>}
        {grupos.map(([data,itens])=>{
          const p=itens.filter(diagOk).length,v=itens.filter(diagNeg).length,av=p+v
          return <div key={data}><div className="legacy-date-title">DATA: {br(data)}</div>
          <table className="legacy-table"><thead><tr><th>Nº</th><th>DOADORA</th><th>RAÇA DOADORA</th><th>TOURO</th><th>RAÇA TOURO</th><th>ESTÁGIO D7</th><th>GRAU D7</th><th>RECEPTORA</th><th>OVÁRIO + CL</th><th>EMBRIÃO</th><th>DIAGNÓSTICO</th></tr></thead>
          <tbody>{itens.map((t,i)=><tr key={t.id}><td>{i+1}</td><td>{doadora(t.doadoraId)?.nome}</td><td>{racaD(t.doadoraId)}</td><td>{touro(t.touroId)?.nome}</td><td>{racaT(t.touroId)}</td><td>{t.embriãoEstagio}</td><td>{t.embriãoGrau}</td><td>{t.receptora}</td><td>{t.ovarioCL}</td><td>{t.destino==='Fresco'?'FRESCO':t.destino}</td><td>{t.diagnostico||'Pendente'}</td></tr>)}</tbody></table>
          <table className="legacy-table legacy-summary"><tbody><tr><th>TOTAL</th><th>PRENHAS</th><th>VAZIAS</th><th>% PRENHEZ</th></tr><tr><td>{itens.length}</td><td>{p}</td><td>{v}</td><td>{pct(p,av)}</td></tr></tbody></table>
          {itens.some(x=>x.obs)&&<div className="legacy-note"><b>OBSERVAÇÕES:</b> {[...new Set(itens.map(x=>x.obs).filter(Boolean))].join(' | ')}</div>}
          </div>
        })}
        {!!dados.tes.length&&<div className="legacy-grand"><b>TOTAL DO PERÍODO:</b> {dados.tes.length} transferências | {prenhes} prenhas | {vazias} vazias | {pct(prenhes,avaliadas)} prenhez</div>}
        {obsRelatorio&&<div className="legacy-note"><b>OBSERVAÇÃO DO RELATÓRIO:</b> {obsRelatorio}</div>}<Rodape/>
      </div>
    }

    const sem=db.estoque.filter(x=>x.clienteId===cliente.id)
    const emb=db.estoqueEmbrioes.filter(x=>x.clienteId===cliente.id&&n(x.quantidade)>0)
    return <div className="legacy-report-sheet">{head}<h2 className="legacy-report-title">POSIÇÃO DE ESTOQUES</h2>
      <h3>ESTOQUE DE SÊMEN</h3>
      <table className="legacy-table"><thead><tr><th>TOURO</th><th>RAÇA</th><th>PARTIDA</th><th>ENTRADA</th><th>USADAS</th><th>SALDO</th><th>RECIPIENTE</th></tr></thead>
      <tbody>{sem.map(x=><tr key={x.id}><td>{touro(x.touroId)?.nome}</td><td>{racaT(x.touroId)}</td><td>{x.partida}</td><td>{x.quantidade}</td><td>{x.usadas}</td><td>{x.saldo}</td><td>{x.recipienteTipo} {x.recipiente}</td></tr>)}</tbody></table>
      <h3>ESTOQUE DE EMBRIÕES</h3>
      <table className="legacy-table"><thead><tr><th>TIPO</th><th>DOADORA</th><th>RAÇA</th><th>TOURO</th><th>RAÇA</th><th>QUANTIDADE</th><th>BOTIJÃO</th><th>CANECA</th><th>RAQUE</th><th>POSIÇÃO</th></tr></thead>
      <tbody>{emb.map(x=><tr key={x.id}><td>{x.tipo}</td><td>{doadora(x.doadoraId)?.nome}</td><td>{racaD(x.doadoraId)}</td><td>{touro(x.touroId)?.nome}</td><td>{racaT(x.touroId)}</td><td>{x.quantidade}</td><td>{x.botijao}</td><td>{x.caneca}</td><td>{x.raque}</td><td>{x.posicao}</td></tr>)}</tbody></table>
      {obsRelatorio&&<div className="legacy-note"><b>OBSERVAÇÃO DO RELATÓRIO:</b> {obsRelatorio}</div>}<Rodape/>
    </div>
  }

  function Rodape(){
    return <div className="legacy-footer"><b>{nomeEmpresa}</b>{empresa?.cnpj&&<> • CNPJ {empresa.cnpj}</>}<br/>{enderecoEmpresa}{empresa?.telefone&&<> • {empresa.telefone}</>}{empresa?.email&&<> • {empresa.email}</>}</div>
  }

  const q=busca.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  const clientesVisiveis=clientes.filter(c=>{
    const cont=contagensCliente(c.id)
    const txt=`${c.nome} ${c.propriedade||''} ${c.municipio||''} produção congelamento transferência estoques ${cont.total}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    return !q||txt.includes(q)
  })

  const categorias:{tipo:TipoRelatorio;nome:string;descricao:string}[]=[
    {tipo:'producao',nome:'Produção',descricao:'Produção in vitro de embriões'},
    {tipo:'congelamento',nome:'Congelamento',descricao:'Embriões DT e VT'},
    {tipo:'transferencia',nome:'Transferência',descricao:'Transferências e diagnóstico'},
    {tipo:'estoques',nome:'Estoques',descricao:'Sêmen e embriões disponíveis'},
  ]

  return <section className="reports-donor-design">
    <div className="panel">
      <div className="panel-head"><div><h2>Relatórios</h2><p>Relatórios organizados por cliente e categoria.</p></div></div>
      <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar cliente ou categoria de relatório"/></div>

      <div className="legacy-filter-row report-period-controls">
        <label><span>Tipo de período</span><select value={tipoPeriodo} onChange={e=>mudarTipo(e.target.value as TipoPeriodo)}><option value="dia">Dia</option><option value="mes">Mês</option><option value="ano">Ano</option></select></label>
        <label><span>Período</span>{tipoPeriodo==='dia'&&<input type="date" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>} {tipoPeriodo==='mes'&&<input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>} {tipoPeriodo==='ano'&&<input type="number" min="2000" max="2100" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>}</label>
        <label className="legacy-obs"><span>Observação do relatório (opcional)</span><input value={obsRelatorio} onChange={e=>setObsRelatorio(e.target.value)} placeholder="Texto que aparecerá no relatório gerado."/></label>
      </div>

      <div className={`donor-folders ${clienteAberto&&!busca?'has-open':''}`}>
        {clientesVisiveis.map(c=>{
          const aberto=busca?true:clienteAberto===c.id
          if(clienteAberto&&!busca&&!aberto)return null
          const cont=contagensCliente(c.id)
          return <div className={`donor-client-card ${aberto?'is-open':''}`} key={c.id}>
            <button className="donor-client-button" onClick={()=>{if(!busca)setClienteAberto(aberto?null:c.id)}}>
              <span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{c.nome}</strong><small>{c.propriedade||c.municipio||'Cliente'}</small></span><span className="donor-folder-count">{cont.total}</span>
            </button>
            {aberto&&<div className="donor-open-content"><div className="donor-open-head"><div><strong>{c.nome}</strong><span>{cont.total} relatório(s) disponível(is)</span></div>{!busca&&<button className="btn small" onClick={()=>setClienteAberto(null)}>Voltar aos clientes</button>}</div>
              <div className="report-category-grid">{categorias.map(cat=>{const qtd=cont[cat.tipo];return <button key={cat.tipo} className="report-category-card" onClick={()=>{setNomeClienteRelatorio(c.nome);setRelatorio({clienteId:c.id,tipo:cat.tipo})}}><span className="report-category-icon">▰</span><span className="report-category-main"><strong>{cat.nome}</strong><small>{cat.descricao}</small></span><span className="donor-folder-count">{qtd}</span></button>})}</div>
            </div>}
          </div>
        })}
      </div>
      {!clientesVisiveis.length&&<div className="note-box">Nenhum cliente encontrado.</div>}
    </div>

    {relatorio&&<Modal title={`Relatório — ${clienteNome(relatorio.clienteId)}`} onClose={()=>setRelatorio(null)}>
      <div className="legacy-filter-row no-print">
        <label><span>Cliente cadastrado (fonte dos dados)</span><input value={clienteNome(relatorio.clienteId)} disabled/></label>
        <label><span>Nome do cliente que aparecerá no relatório</span><input value={nomeClienteRelatorio} onChange={e=>setNomeClienteRelatorio(e.target.value)}/></label>
      </div>
      <div className="legacy-report-actions no-print"><button className="btn primary" onClick={imprimir}>Exportar em PDF / Imprimir</button></div>
      <RelatorioConteudo/>
    </Modal>}
  </section>
}

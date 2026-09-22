import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor } from '../types/domain'
import { SearchBar } from '../components/CrudUI'

function tipoNome(t:string){const m:Record<string,string>={ENTRADA_SEMEN:'Entrada de sêmen',SAIDA_SEMEN:'Saída de sêmen',ENTRADA_EMBRIAO:'Entrada de embriões',SAIDA_EMBRIAO:'Saída de embriões',AJUSTE:'Ajuste'};return m[t]||t}
function esc(v:any){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c))}

export function Movimentacoes({db}:{db:BancoEmbrioGestor}){
 const[busca,setBusca]=useState('')
 const[clienteId,setClienteId]=useState('')
 const[touroId,setTouroId]=useState('')
 const[partida,setPartida]=useState('')
 const[tipo,setTipo]=useState('')
 const[dataIni,setDataIni]=useState('')
 const[dataFim,setDataFim]=useState('')

 const partidaMov=(m:any)=>{
   const e=db.estoque.find(x=>x.id===m.estoqueId)
   if(e?.partida)return e.partida
   const achou=String(m.descricao||'').match(/partida\s+([^—–-]+)/i)
   return achou?.[1]?.trim()||''
 }
 const lista=useMemo(()=>[...db.movimentacoes].filter(m=>{
   const c=db.clientes.find(x=>x.id===m.clienteId),t=db.touros.find(x=>x.id===m.touroId),d=db.doadoras.find(x=>x.id===m.doadoraId)
   const p=partidaMov(m),q=busca.toLowerCase().trim(),dia=String(m.data||'').slice(0,10)
   if(clienteId&&m.clienteId!==clienteId)return false
   if(touroId&&m.touroId!==touroId)return false
   if(partida&&p!==partida)return false
   if(tipo&&m.tipo!==tipo)return false
   if(dataIni&&dia<dataIni)return false
   if(dataFim&&dia>dataFim)return false
   return !q||String(c?.nome+' '+t?.nome+' '+d?.nome+' '+p+' '+m.descricao+' '+tipoNome(m.tipo)).toLowerCase().includes(q)
 }).sort((a,b)=>b.data.localeCompare(a.data)),[db,busca,clienteId,touroId,partida,tipo,dataIni,dataFim])

 const tourosFiltro=db.touros.filter(t=>!clienteId||db.estoque.some(e=>e.clienteId===clienteId&&e.touroId===t.id)||db.movimentacoes.some(m=>m.clienteId===clienteId&&m.touroId===t.id))
 const partidas=[...new Set(db.estoque.filter(e=>(!clienteId||e.clienteId===clienteId)&&(!touroId||e.touroId===touroId)).map(e=>String(e.partida||'').trim()).filter(Boolean))].sort()
 const totalEntradas=lista.filter(m=>m.tipo==='ENTRADA_SEMEN').reduce((a,m)=>a+Number(m.quantidade||0),0)
 const totalSaidas=lista.filter(m=>m.tipo==='SAIDA_SEMEN').reduce((a,m)=>a+Number(m.quantidade||0),0)

 function exportarPdf(){
   const w=window.open('','_blank','width=1100,height=800')
   if(!w)return alert('O navegador bloqueou a janela do relatório. Permita pop-ups para exportar o PDF.')
   const linhas=lista.map(m=>{const c=db.clientes.find(x=>x.id===m.clienteId),t=db.touros.find(x=>x.id===m.touroId),d=db.doadoras.find(x=>x.id===m.doadoraId),dt=new Date(m.data);return `<tr><td>${esc(isNaN(dt.getTime())?m.data:dt.toLocaleString('pt-BR'))}</td><td>${esc(tipoNome(m.tipo))}</td><td>${esc(c?.nome||'—')}</td><td>${esc(t?.nome||'—')}</td><td>${esc(partidaMov(m)||'—')}</td><td>${esc(d?.nome||'—')}</td><td>${esc(m.quantidade)}</td><td>${esc(m.descricao)}</td></tr>`}).join('')
   w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Extrato de movimentações</title><style>body{font-family:Arial,sans-serif;color:#172b3a;padding:24px}h1{margin:0 0 4px;font-size:22px}p{margin:4px 0 16px;color:#526575}.resumo{display:flex;gap:24px;margin:14px 0}.resumo b{font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd6df;padding:6px;text-align:left;vertical-align:top}th{background:#eaf2f7}@page{size:landscape;margin:10mm}</style></head><body><h1>EmbrioGestor — Extrato de Movimentações</h1><p>${esc(clienteId?db.clientes.find(c=>c.id===clienteId)?.nome||'Cliente':'Todos os clientes')} ${dataIni||dataFim?`• Período: ${esc(dataIni||'início')} a ${esc(dataFim||'hoje')}`:''}</p><div class="resumo"><span>Registros: <b>${lista.length}</b></span><span>Entradas de sêmen: <b>${totalEntradas.toLocaleString('pt-BR')}</b></span><span>Saídas de sêmen: <b>${totalSaidas.toLocaleString('pt-BR')}</b></span></div><table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Cliente</th><th>Touro</th><th>Partida</th><th>Doadora</th><th>Qtd.</th><th>Descrição</th></tr></thead><tbody>${linhas||'<tr><td colspan="8">Nenhuma movimentação encontrada.</td></tr>'}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`)
   w.document.close()
 }

 return <section className="panel"><div className="panel-head"><div><h2>Movimentações</h2><p>Histórico pesquisável de entradas, saídas e ajustes de estoque.</p></div><button className="btn primary" onClick={exportarPdf}>Exportar PDF</button></div>
   <div className="toolbar"><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar cliente, touro, partida, doadora ou descrição"/></div>
   <div className="form-grid movement-filters">
    <label>Cliente<select value={clienteId} onChange={e=>{setClienteId(e.target.value);setTouroId('');setPartida('')}}><option value="">Todos</option>{db.clientes.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
    <label>Touro<select value={touroId} onChange={e=>{setTouroId(e.target.value);setPartida('')}}><option value="">Todos</option>{tourosFiltro.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
    <label>Partida<select value={partida} onChange={e=>setPartida(e.target.value)}><option value="">Todas</option>{partidas.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
    <label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos</option><option value="ENTRADA_SEMEN">Entrada de sêmen</option><option value="SAIDA_SEMEN">Saída de sêmen</option><option value="ENTRADA_EMBRIAO">Entrada de embriões</option><option value="SAIDA_EMBRIAO">Saída de embriões</option><option value="AJUSTE">Ajuste</option></select></label>
    <label>Data inicial<input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)}/></label>
    <label>Data final<input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}/></label>
   </div>
   <div className="calc-box">{lista.length} movimentação(ões) encontrada(s) • Entradas de sêmen: <strong>{totalEntradas.toLocaleString('pt-BR')}</strong> • Saídas de sêmen: <strong>{totalSaidas.toLocaleString('pt-BR')}</strong></div>
   <div className="table-wrap"><table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Cliente</th><th>Touro</th><th>Partida</th><th>Doadora</th><th>Quantidade</th><th>Descrição</th></tr></thead><tbody>{lista.length?lista.map(m=>{const c=db.clientes.find(x=>x.id===m.clienteId),t=db.touros.find(x=>x.id===m.touroId),d=db.doadoras.find(x=>x.id===m.doadoraId),dt=new Date(m.data);return <tr key={m.id}><td>{isNaN(dt.getTime())?m.data:dt.toLocaleString('pt-BR')}</td><td><strong>{tipoNome(m.tipo)}</strong></td><td>{c?.nome||'—'}</td><td>{t?.nome||'—'}</td><td>{partidaMov(m)||'—'}</td><td>{d?.nome||'—'}</td><td>{m.quantidade}</td><td>{m.descricao}</td></tr>}):<tr><td colSpan={8}>Nenhuma movimentação encontrada com estes filtros.</td></tr>}</tbody></table></div>
 </section>
}

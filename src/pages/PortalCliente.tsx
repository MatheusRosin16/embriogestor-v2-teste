import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, PerfilAcesso } from '../types/domain'

const pct=(a:number,b:number)=>b?`${(a/b*100).toFixed(1).replace('.',',')}%`:'0,0%'
const fmtData=(v?:string)=>{if(!v)return '—';const [a,m,d]=v.split('-');return a&&m&&d?`${d}/${m}/${a}`:v}
const soma=(xs:any[],k:string)=>xs.reduce((s,x)=>s+(Number(x?.[k])||0),0)

function Pasta({titulo,subtitulo,children}:{titulo:string;subtitulo?:string;children:React.ReactNode}){
  const[aberta,setAberta]=useState(false)
  return <div className={`client-folder ${aberta?'open':''}`}>
    <button className="client-folder-head" onClick={()=>setAberta(v=>!v)}><span className="client-folder-icon">{aberta?'▾':'▸'}</span><span><strong>{titulo}</strong>{subtitulo&&<small>{subtitulo}</small>}</span></button>
    {aberta&&<div className="client-folder-body">{children}</div>}
  </div>
}

export function PortalCliente({db,perfil}:{db:BancoEmbrioGestor;perfil:PerfilAcesso}){
  const cid=perfil.cliente_id||''
  const cli=db.clientes.find(c=>c.id===cid)
  const doadoras=db.doadoras.filter(x=>x.clienteId===cid).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  const prods=db.producoes.filter(x=>x.clienteId===cid).sort((a,b)=>b.data.localeCompare(a.data)||(Number(a.ordem)||999)-(Number(b.ordem)||999))
  const transf=db.transferencias.filter(x=>x.clienteId===cid).sort((a,b)=>b.data.localeCompare(a.data))
  const estEmb=db.estoqueEmbrioes.filter(x=>x.clienteId===cid&&!x.entregue&&(Number(x.quantidade)||0)>0)
  const estSemen=db.estoque.filter(x=>x.clienteId===cid)
  const viaveis=soma(prods,'oocitosViaveis'), d7=soma(prods,'embriõesD7')
  const prenhes=transf.filter(x=>String(x.diagnostico).toLowerCase()==='positiva').length
  const dg=transf.filter(x=>x.diagnostico&&x.diagnostico!=='Pendente').length
  const saldoSemen=soma(estSemen,'saldo'), saldoEmb=soma(estEmb,'quantidade')
  const nomeD=(id:string)=>db.doadoras.find(x=>x.id===id)?.nome||'—'
  const touro=(id?:string)=>db.touros.find(x=>x.id===id)
  const nomeT=(id?:string)=>touro(id)?.nome||'—'
  const racaT=(id?:string)=>touro(id)?.raca||db.racas.find(r=>r.id===touro(id)?.racaId)?.abreviatura||'—'
  const tipoT=(id?:string)=>touro(id)?.tipoSemen||'—'
  const porData=<T extends {data?:string}>(xs:T[])=>Object.entries(xs.reduce((m,x)=>{const d=x.data||'Sem data';(m[d]??=[]).push(x);return m},{} as Record<string,T[]>)).sort(([a],[b])=>b.localeCompare(a))
  const prodsData=useMemo(()=>porData(prods),[prods])
  const transfData=useMemo(()=>porData(transf),[transf])
  const embData=useMemo(()=>porData(estEmb),[estEmb])
  const semenTouro=useMemo(()=>Object.entries(estSemen.reduce((m,x)=>{const k=x.touroId||'SEM';(m[k]??=[]).push(x);return m},{} as Record<string,typeof estSemen>)).sort((a,b)=>nomeT(a[0]).localeCompare(nomeT(b[0]),'pt-BR')),[estSemen])

  if(!cid)return <section><div className="page-title-block"><h2>Portal do Cliente</h2><p>Conta sem cliente vinculado.</p></div><div className="panel"><div className="note-box">O Administrador precisa vincular esta conta a um cliente em “Usuários & Acessos”.</div></div></section>

  return <section>
    <div className="page-title-block"><h2>Portal do Cliente</h2><p>{cli?.nome||perfil.nome||perfil.email} — consulta somente leitura.</p></div>
    <div className="client-kpis"><div><span>Doadoras</span><strong>{doadoras.length}</strong></div><div><span>Oócitos viáveis</span><strong>{viaveis}</strong></div><div><span>Embriões D7</span><strong>{d7}</strong><small>{pct(d7,viaveis)} de produção</small></div><div><span>Transferências</span><strong>{transf.length}</strong></div><div><span>Taxa de prenhez</span><strong>{pct(prenhes,dg)}</strong><small>{prenhes}/{dg} DG</small></div><div><span>Embriões em estoque</span><strong>{saldoEmb}</strong></div><div><span>Doses de sêmen</span><strong>{saldoSemen}</strong></div></div>

    <div className="panel client-readonly"><div className="panel-head"><div><h3>Minhas doadoras</h3><p>{doadoras.length} animal(is) • clique para abrir</p></div></div><Pasta titulo="Doadoras" subtitulo={`${doadoras.length} cadastrada(s)`}><div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Registro</th><th>Raça</th><th>Categoria</th><th>Status</th></tr></thead><tbody>{doadoras.map(d=><tr key={d.id}><td><strong>{d.nome}</strong></td><td>{d.registro||'—'}</td><td>{d.raca||db.racas.find(r=>r.id===d.racaId)?.abreviatura||'—'}</td><td>{d.categoria||'—'}</td><td>{d.status||'—'}</td></tr>)}</tbody></table></div></Pasta></div>

    <div className="panel client-readonly"><div className="panel-head"><div><h3>Estoque de sêmen</h3><p>Minimizado por touro e separado por partida.</p></div></div>{semenTouro.length?semenTouro.map(([tid,itens])=><Pasta key={tid} titulo={nomeT(tid)} subtitulo={`${soma(itens,'saldo')} dose(s) em estoque`}><div className="table-wrap"><table><thead><tr><th>Raça</th><th>Tipo</th><th>Partida</th><th>Entradas</th><th>Usadas</th><th>Saldo</th><th>Localização</th></tr></thead><tbody>{itens.map(x=><tr key={x.id}><td>{racaT(x.touroId)}</td><td>{tipoT(x.touroId)}</td><td>{x.partida||'—'}</td><td>{Number(x.quantidade)||0}</td><td>{Number(x.usadas)||0}</td><td><strong>{Number(x.saldo)||0}</strong></td><td>{[x.recipienteTipo,x.recipiente].filter(Boolean).join(' • ')||'—'}</td></tr>)}</tbody></table></div></Pasta>):<div className="empty-state">Nenhuma dose em estoque.</div>}</div>

    <div className="panel client-readonly"><div className="panel-head"><div><h3>Estoque de embriões</h3><p>Separado por data de produção.</p></div></div>{embData.length?embData.map(([data,itens])=><Pasta key={data} titulo={fmtData(data)} subtitulo={`${soma(itens,'quantidade')} embrião(ões) em estoque`}><div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Touro</th><th>Tipo</th><th>Quantidade</th><th>Botijão</th><th>Caneca</th><th>Raque</th><th>Posição</th></tr></thead><tbody>{itens.map(x=><tr key={x.id}><td>{nomeD(x.doadoraId)}</td><td>{nomeT(x.touroId)}</td><td>{x.tipo}</td><td><strong>{x.quantidade}</strong></td><td>{x.botijao||'—'}</td><td>{x.caneca||'—'}</td><td>{x.raque||'—'}</td><td>{x.posicao||'—'}</td></tr>)}</tbody></table></div></Pasta>):<div className="empty-state">Nenhum embrião em estoque.</div>}</div>

    <div className="panel client-readonly"><div className="panel-head"><div><h3>Produções</h3><p>Separadas por data, com produção por touro e total do serviço.</p></div></div>{prodsData.length?prodsData.map(([data,itens])=>{const grupos=Object.values(itens.reduce((m,p)=>{const k=p.touroId||'SEM';(m[k]??=[]).push(p);return m},{} as Record<string,typeof prods>));return <Pasta key={data} titulo={`Produção de ${fmtData(data)}`} subtitulo={`${itens.length} linha(s) • ${pct(soma(itens,'embriõesD7'),soma(itens,'oocitosViaveis'))} total`}><div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Touro</th><th>Viáveis</th><th>D7</th><th>% Prod.</th><th>Fresco</th><th>DT</th><th>VT</th></tr></thead><tbody>{itens.map(p=><tr key={p.id}><td>{nomeD(p.doadoraId)}</td><td>{nomeT(p.touroId)}</td><td>{p.oocitosViaveis}</td><td>{p.embriõesD7}</td><td>{pct(p.embriõesD7,p.oocitosViaveis)}</td><td>{p.transferidosFresco}</td><td>{p.congeladosDT}</td><td>{p.congeladosVT}</td></tr>)}</tbody></table></div><div className="client-production-summary"><strong>PRODUÇÃO % (EMBRIÕES/OÓCITOS VIÁVEIS)</strong>{grupos.map((g,i)=><span key={i}>{nomeT(g[0]?.touroId)}: <b>{pct(soma(g,'embriõesD7'),soma(g,'oocitosViaveis'))}</b> ({soma(g,'embriõesD7')}/{soma(g,'oocitosViaveis')})</span>)}<span className="total">TOTAL: <b>{pct(soma(itens,'embriõesD7'),soma(itens,'oocitosViaveis'))}</b> ({soma(itens,'embriõesD7')}/{soma(itens,'oocitosViaveis')})</span></div></Pasta>}):<div className="empty-state">Nenhuma produção cadastrada.</div>}</div>

    <div className="panel client-readonly"><div className="panel-head"><div><h3>Transferências</h3><p>Separadas por data de transferência.</p></div></div>{transfData.length?transfData.map(([data,itens])=><Pasta key={data} titulo={`Transferências de ${fmtData(data)}`} subtitulo={`${itens.length} transferência(s)`}><div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Touro</th><th>Receptora</th><th>Estágio</th><th>Grau</th><th>Embrião</th><th>Diagnóstico</th></tr></thead><tbody>{itens.map(t=><tr key={t.id}><td>{nomeD(t.doadoraId)}</td><td>{nomeT(t.touroId)}</td><td>{t.receptora||'—'}</td><td>{t.embriãoEstagio||'—'}</td><td>{t.embriãoGrau||'—'}</td><td>{t.destino||'—'}</td><td>{t.diagnostico||'Pendente'}</td></tr>)}</tbody></table></div></Pasta>):<div className="empty-state">Nenhuma transferência cadastrada.</div>}</div>
  </section>
}

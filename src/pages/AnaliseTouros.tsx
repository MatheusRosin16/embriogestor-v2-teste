import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor } from '../types/domain'
import { SearchBar } from '../components/CrudUI'

const n=(v:any)=>Math.max(0,Number(v)||0)
const pct=(a:number,b:number)=>b?((a/b)*100).toFixed(1).replace('.',',')+'%':'0,0%'

export function AnaliseTouros({db}:{db:BancoEmbrioGestor}){
  const[inicio,setInicio]=useState('')
  const[fim,setFim]=useState('')
  const[busca,setBusca]=useState('')

  const noPeriodo=(data:string)=>{
    if(inicio&&data<inicio)return false
    if(fim&&data>fim)return false
    return true
  }

  const linhas=useMemo(()=>{
    // A unidade da análise passa a ser TOURO + PARTIDA.
    // Cliente não separa os resultados: a mesma partida usada em clientes diferentes é consolidada.
    const grupos=new Map<string,{touroId:string;partida:string;producaoIds:Set<string>;transferenciaIds:Set<string>}>()
    const chaveServico=(clienteId:string,data:string,touroId:string)=>`${clienteId}|${String(data||'').slice(0,10)}|${touroId}`

    const servicosValidos=db.servicosSemen.filter(ss=>ss.touroId&&noPeriodo(ss.data))
    const partidasPorServico=new Map<string,string[]>()
    servicosValidos.forEach(ss=>{
      const chave=chaveServico(ss.clienteId,ss.data,ss.touroId)
      const partida=String(ss.partida||'').trim()||'Sem partida'
      const atuais=partidasPorServico.get(chave)||[]
      if(!atuais.includes(partida))partidasPorServico.set(chave,[...atuais,partida])
    })

    db.producoes.filter(p=>p.touroId&&noPeriodo(p.data)).forEach(prod=>{
      const chave=chaveServico(prod.clienteId,prod.data,prod.touroId!)
      const partidas=partidasPorServico.get(chave)||['Sem partida']
      partidas.forEach(partida=>{
        const k=`${prod.touroId}|${partida}`
        if(!grupos.has(k))grupos.set(k,{touroId:prod.touroId!,partida,producaoIds:new Set(),transferenciaIds:new Set()})
        grupos.get(k)!.producaoIds.add(prod.id)
      })
    })

    // Garante que uma partida registrada no serviço apareça mesmo se ainda não houver produção vinculada.
    servicosValidos.forEach(ss=>{
      const partida=String(ss.partida||'').trim()||'Sem partida'
      const k=`${ss.touroId}|${partida}`
      if(!grupos.has(k))grupos.set(k,{touroId:ss.touroId,partida,producaoIds:new Set(),transferenciaIds:new Set()})
    })

    return [...grupos.values()].map(g=>{
      const t=db.touros.find(x=>x.id===g.touroId)
      const prods=db.producoes.filter(p=>g.producaoIds.has(p.id))
      const prodIds=new Set(prods.map(p=>p.id))
      const servicosDoGrupo=servicosValidos.filter(ss=>ss.touroId===g.touroId&&(String(ss.partida||'').trim()||'Sem partida')===g.partida)
      const chavesDoGrupo=new Set(servicosDoGrupo.map(ss=>chaveServico(ss.clienteId,ss.data,ss.touroId)))
      const tes=db.transferencias.filter(x=>x.touroId===g.touroId&&noPeriodo(x.data)&&(
        (x.origemProducaoId&&prodIds.has(x.origemProducaoId)) || chavesDoGrupo.has(chaveServico(x.clienteId,x.data,x.touroId))
      ))

      const oocitos=prods.reduce((s,p)=>s+n(p.oocitos),0)
      const viaveis=prods.reduce((s,p)=>s+n(p.oocitosViaveis),0)
      const clivados=prods.reduce((s,p)=>s+n(p.clivados),0)
      const d7=prods.reduce((s,p)=>s+n(p.embriõesD7),0)
      const fresco=prods.reduce((s,p)=>s+n(p.transferidosFresco),0)
      const dt=prods.reduce((s,p)=>s+n(p.congeladosDT),0)
      const vt=prods.reduce((s,p)=>s+n(p.congeladosVT),0)
      const dgAvaliadas=tes.filter(x=>x.diagnostico&&x.diagnostico!=='Pendente')
      const prenhes=dgAvaliadas.filter(x=>String(x.diagnostico).toLowerCase()==='positiva').length
      const negativas=dgAvaliadas.filter(x=>String(x.diagnostico).toLowerCase()==='negativa').length
      const raca=db.racas.find(r=>r.id===t?.racaId)

      return {id:`${g.touroId}|${g.partida}`,touro:t?.nome||'Touro não encontrado',partida:g.partida,
        raca:raca?.abreviatura||t?.raca||'—',tipo:t?.tipoSemen||'—',producoes:prods.length,
        oocitos,viaveis,clivados,d7,fresco,dt,vt,taxaClivagem:pct(clivados,viaveis),taxaProducao:pct(d7,viaveis),
        transferencias:tes.length,dgAvaliadas:dgAvaliadas.length,prenhes,negativas,taxaPrenhez:pct(prenhes,dgAvaliadas.length)}
    }).filter(x=>x.producoes||x.transferencias)
      .filter(x=>{const q=busca.toLowerCase();return !q||String(x.touro+' '+x.partida+' '+x.raca).toLowerCase().includes(q)})
      .sort((a,b)=>a.touro.localeCompare(b.touro,'pt-BR')||a.partida.localeCompare(b.partida,'pt-BR',{numeric:true}))
  },[db,inicio,fim,busca])

  const total=useMemo(()=>linhas.reduce((a,x)=>({
    producoes:a.producoes+x.producoes,
    viaveis:a.viaveis+x.viaveis,
    clivados:a.clivados+x.clivados,
    d7:a.d7+x.d7,
    fresco:a.fresco+x.fresco,
    dt:a.dt+x.dt,
    vt:a.vt+x.vt,
    transferencias:a.transferencias+x.transferencias,
    avaliadas:a.avaliadas+x.dgAvaliadas,
    prenhes:a.prenhes+x.prenhes
  }),{producoes:0,viaveis:0,clivados:0,d7:0,fresco:0,dt:0,vt:0,transferencias:0,avaliadas:0,prenhes:0}),[linhas])

  return <section>
    <div className="page-title-block">
      <h2>Análise de Touros</h2>
      <p>Desempenho na PIVE e nas transferências usando somente dados registrados no EmbrioGestor.</p>
    </div>

    <div className="panel">
      <div className="analysis-filters">
        <label><span>Data inicial</span><input type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/></label>
        <label><span>Data final</span><input type="date" value={fim} onChange={e=>setFim(e.target.value)}/></label>
        <div><SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar touro, partida ou raça"/></div>
      </div>

      <div className="analysis-kpis">
        <div><span>Touro / partidas analisadas</span><strong>{linhas.length}</strong></div>
        <div><span>Produções</span><strong>{total.producoes}</strong></div>
        <div><span>% Clivagem</span><strong>{pct(total.clivados,total.viaveis)}</strong></div>
        <div><span>% Produção</span><strong>{pct(total.d7,total.viaveis)}</strong></div>
        <div><span>Embriões D7</span><strong>{total.d7}</strong></div>
        <div><span>% Prenhez</span><strong>{pct(total.prenhes,total.avaliadas)}</strong><small>somente DG avaliadas</small></div>
      </div>

      <div className="note-box">
        A análise não cria dados que o sistema não possui. Indicadores como P60, sexo fetal ou aborto só poderão aparecer futuramente se forem cadastrados como campos estruturados.
      </div>

      <div className="table-wrap bull-analysis-table">
        <table>
          <thead><tr>
            <th>Touro</th><th>Partida</th><th>Raça</th><th>Tipo sêmen</th>
            <th>Produções</th><th>Viáveis</th><th>Clivados</th><th>% Cliv.</th>
            <th>D7</th><th>% Prod.</th><th>Fresco</th><th>DT</th><th>VT</th>
            <th>Transferências</th><th>DG avaliadas</th><th>Prenhes</th><th>Negativas</th><th>% Prenhez</th>
          </tr></thead>
          <tbody>
            {linhas.map(x=><tr key={x.id}>
              <td><strong>{x.touro}</strong></td><td><strong>{x.partida}</strong></td><td>{x.raca}</td><td>{x.tipo}</td>
              <td>{x.producoes}</td><td>{x.viaveis}</td><td>{x.clivados}</td><td>{x.taxaClivagem}</td>
              <td><strong>{x.d7}</strong></td><td><strong>{x.taxaProducao}</strong></td><td>{x.fresco}</td><td>{x.dt}</td><td>{x.vt}</td>
              <td>{x.transferencias}</td><td>{x.dgAvaliadas}</td><td>{x.prenhes}</td><td>{x.negativas}</td><td><strong>{x.taxaPrenhez}</strong></td>
            </tr>)}
            {!linhas.length&&<tr><td colSpan={18}>Nenhum dado disponível para os filtros selecionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </section>
}

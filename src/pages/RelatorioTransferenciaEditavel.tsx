import { useState } from 'react'
import type { BancoEmbrioGestor, LinhaRelatorioTransferenciaEditavel, MovimentacaoItem, RelatorioTransferenciaEditavelSalvo } from '../types/domain'
import { SearchableSelect } from '../components/CrudUI'

type Periodo='dia'|'mes'|'ano'
type Linha=LinhaRelatorioTransferenciaEditavel
const hoje=()=>new Date().toISOString().slice(0,10)
const norm=(v:any)=>String(v||'')
const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)

export function RelatorioTransferenciaEditavel({db,onChange}:{db:BancoEmbrioGestor;onChange:(db:BancoEmbrioGestor)=>void}){
  const[clienteId,setClienteId]=useState(db.clientes[0]?.id||'')
  const[nomeRelatorio,setNomeRelatorio]=useState(db.clientes[0]?.nome||'')
  const[tipoPeriodo,setTipoPeriodo]=useState<Periodo>('ano')
  const[periodo,setPeriodo]=useState(String(new Date().getFullYear()))
  const[obs,setObs]=useState('')
  const[linhas,setLinhas]=useState<Linha[]>([])
  const[montado,setMontado]=useState(false)
  const[relatorioId,setRelatorioId]=useState('')
  const empresa=db.identidadeEmpresa
  const nomeEmpresa=empresa?.nome||'SÊMINNA – Laboratório de Reprodução Animal'
  const enderecoEmpresa=empresa?.endereco||'AV. General Osório, 797, sala 01, Francisco Beltrão - PR'

  const doadora=(x:string)=>db.doadoras.find(d=>d.id===x)
  const touro=(x:string)=>db.touros.find(t=>t.id===x)
  const racaD=(x:string)=>{const d=doadora(x);return db.racas.find(r=>r.id===d?.racaId)?.abreviatura||d?.raca||''}
  const racaT=(x:string)=>{const t=touro(x);return db.racas.find(r=>r.id===t?.racaId)?.abreviatura||t?.raca||''}
  const bate=(data:string)=>tipoPeriodo==='dia'?data===periodo:tipoPeriodo==='mes'?data.startsWith(periodo):data.startsWith(periodo+'-')
  function mudaTipo(v:Periodo){setTipoPeriodo(v);const h=hoje();setPeriodo(v==='dia'?h:v==='mes'?h.slice(0,7):h.slice(0,4))}
  function selecionarCliente(x:string){setClienteId(x);setNomeRelatorio(db.clientes.find(c=>c.id===x)?.nome||'')}

  function montar(){
    const cliente=db.clientes.find(c=>c.id===clienteId)
    const itens=db.transferencias.filter(t=>t.clienteId===clienteId&&bate(t.data)).sort((a,b)=>a.data.localeCompare(b.data))
    setLinhas(itens.map((t,i)=>({id:id('LIN'),transferenciaId:t.id||String(i),data:t.data,cliente:nomeRelatorio||cliente?.nome||'',doadora:doadora(t.doadoraId)?.nome||'',racaDoadora:racaD(t.doadoraId),touro:touro(t.touroId)?.nome||'',racaTouro:racaT(t.touroId),receptora:norm(t.receptora),grauD7:norm(t.embriãoGrau),estagioD7:norm(t.embriãoEstagio),ovario:norm(t.ovarioCL).slice(0,2),grauCL:norm(t.ovarioCL).slice(2),clCavitario:'',diagnostico:norm(t.diagnostico),dataDiagnostico:norm(t.dataDiagnostico),destino:t.destino||'Fresco',estoqueEmbriaoId:t.estoqueEmbriaoId||'',estoqueBaixado:!!t.id&&(t.destino==='DT'||t.destino==='VT')})))
    setRelatorioId('');setMontado(true)
  }
  function alterar(i:number,campo:keyof Linha,valor:any){setLinhas(x=>x.map((l,n)=>n===i?{...l,[campo]:valor}:l))}
  function adicionar(){setLinhas(x=>[...x,{id:id('LIN'),data:hoje(),cliente:nomeRelatorio,doadora:'',racaDoadora:'',touro:'',racaTouro:'',receptora:'',grauD7:'',estagioD7:'',ovario:'',grauCL:'',clCavitario:'',diagnostico:'',dataDiagnostico:'',destino:'Fresco',estoqueEmbriaoId:'',estoqueBaixado:false}])}
  function excluir(i:number){setLinhas(x=>x.filter((_,n)=>n!==i))}
  function imprimir(){window.print()}

  function opcoesEstoque(l:Linha){
    if(l.destino!=='DT'&&l.destino!=='VT')return []
    const d=db.doadoras.find(x=>x.nome===l.doadora)
    const t=db.touros.find(x=>x.nome===l.touro)
    return db.estoqueEmbrioes.filter(e=>e.clienteId===clienteId&&e.tipo===l.destino&&Number(e.quantidade)>0&&(!d||e.doadoraId===d.id)&&(!t||e.touroId===t.id)).sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')))
  }

  function salvarRelatorio(){
    let estoque=[...db.estoqueEmbrioes],mov=[...db.movimentacoes],novas=[...linhas]
    for(let i=0;i<novas.length;i++){
      const l=novas[i]
      if((l.destino==='DT'||l.destino==='VT')&&!l.estoqueBaixado){
        if(!l.estoqueEmbriaoId){alert(`Selecione a data/origem do congelamento na linha ${i+1}.`);return}
        const idx=estoque.findIndex(e=>e.id===l.estoqueEmbriaoId&&Number(e.quantidade)>0)
        if(idx<0){alert(`O lote selecionado na linha ${i+1} não possui saldo disponível.`);return}
        const e=estoque[idx];estoque[idx]={...e,quantidade:Number(e.quantidade)-1}
        mov.push({id:id('MOV'),data:new Date().toISOString(),tipo:'SAIDA_EMBRIAO',clienteId:e.clienteId,doadoraId:e.doadoraId,touroId:e.touroId,estoqueId:e.id,quantidade:1,descricao:`Uso de embrião ${l.destino} no Relatório de Transferência Editável — receptora ${l.receptora||'não informada'}`} as MovimentacaoItem)
        novas[i]={...l,estoqueBaixado:true}
      }
    }
    const rid=relatorioId||id('RELTE')
    const salvo:RelatorioTransferenciaEditavelSalvo={id:rid,criadoEm:new Date().toISOString(),clienteId,nomeRelatorio,tipoPeriodo,periodo,obs,linhas:novas}
    const atuais=db.relatoriosTransferenciaEditaveis||[]
    const rels=relatorioId?atuais.map(r=>r.id===rid?salvo:r):[...atuais,salvo]
    onChange({...db,estoqueEmbrioes:estoque,movimentacoes:mov,relatoriosTransferenciaEditaveis:rels})
    setLinhas(novas);setRelatorioId(rid);alert('Relatório salvo.')
  }
  function abrirSalvo(r:RelatorioTransferenciaEditavelSalvo){setRelatorioId(r.id);setClienteId(r.clienteId);setNomeRelatorio(r.nomeRelatorio);setTipoPeriodo(r.tipoPeriodo);setPeriodo(r.periodo);setObs(r.obs||'');setLinhas(r.linhas.map(x=>({...x})));setMontado(true)}
  function excluirSalvo(rid:string){if(!confirm('Excluir este relatório salvo? A baixa de estoque já realizada não será revertida.'))return;onChange({...db,relatoriosTransferenciaEditaveis:(db.relatoriosTransferenciaEditaveis||[]).filter(r=>r.id!==rid)});if(relatorioId===rid){setRelatorioId('');setMontado(false)}}

  const campos:[keyof Linha,string,string][]=[['data','Data','date'],['cliente','Cliente','text'],['doadora','Doadora','text'],['racaDoadora','Raça doadora','text'],['touro','Touro','text'],['racaTouro','Raça touro','text'],['receptora','Receptora','text'],['grauD7','Grau D7','text'],['estagioD7','Estágio D7','text'],['ovario','Ovário','text'],['grauCL','Grau CL','text'],['clCavitario','CL cavitário','text'],['diagnostico','Diagnóstico','text'],['dataDiagnostico','Data diag.','date']]

  return <section className="editable-transfer-report">
    <div className="panel no-print"><div className="panel-head"><div><h2>Relatório Transferência Editável</h2><p>Monte a prévia, revise, salve e gere o PDF.</p></div></div>
      <div className="editable-report-filter">
        <label><span>Cliente usado para localizar as transferências</span><SearchableSelect value={clienteId} onChange={selecionarCliente} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></label>
        <label><span>Nome do cliente no relatório</span><input value={nomeRelatorio} onChange={e=>setNomeRelatorio(e.target.value)}/></label>
        <label><span>Período</span><select value={tipoPeriodo} onChange={e=>mudaTipo(e.target.value as Periodo)}><option value="dia">Dia</option><option value="mes">Mês</option><option value="ano">Ano</option></select></label>
        <label><span>{tipoPeriodo==='dia'?'Data':tipoPeriodo==='mes'?'Mês':'Ano'}</span>{tipoPeriodo==='dia'?<input type="date" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>:tipoPeriodo==='mes'?<input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>:<input type="number" min="2000" max="2100" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>}</label>
        <label className="editable-report-obs"><span>Observação geral do relatório</span><textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Observação opcional"/></label>
      </div><button className="btn primary" onClick={montar}>Montar prévia</button>
      {!!(db.relatoriosTransferenciaEditaveis||[]).length&&<div className="saved-report-list"><strong>Relatórios salvos</strong>{[...(db.relatoriosTransferenciaEditaveis||[])].sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm)).map(r=><div className="saved-report-item" key={r.id}><div><b>{r.nomeRelatorio}</b><br/><small>{r.periodo} • {r.linhas.length} linha(s) • salvo em {new Date(r.criadoEm).toLocaleString('pt-BR')}</small></div><div className="actions"><button className="btn small" onClick={()=>abrirSalvo(r)}>Abrir</button><button className="btn small danger" onClick={()=>excluirSalvo(r.id)}>Excluir</button></div></div>)}</div>}
    </div>

    {montado&&<div className="panel editable-preview"><div className="editable-preview-head no-print"><div><h3>Prévia editável</h3><span>{linhas.length} transferência(s)</span></div><div className="actions"><button className="btn" onClick={adicionar}>+ Adicionar linha</button><button className="btn primary" onClick={salvarRelatorio}>Salvar relatório</button><button className="btn primary" onClick={imprimir}>Gerar PDF / Imprimir</button></div></div>
      <div className="note-box no-print">As alterações da prévia ficam salvas no relatório. Linhas DT/VT novas baixam 1 embrião do lote/data de congelamento escolhido apenas uma vez.</div>
      <div className="editable-transfer-sheet">
        <div className="editable-print-head"><div className="editable-company-brand">{empresa?.logoDataUrl&&<img src={empresa.logoDataUrl} alt="Logo da empresa"/>}<strong>{nomeEmpresa}</strong></div><span>RELATÓRIO DE TRANSFERÊNCIA DE EMBRIÕES</span><small>Cliente: {nomeRelatorio||'—'} • Período: {periodo}</small></div>
        <div className="editable-table-wrap"><table className="editable-report-table"><thead><tr>{campos.map(c=><th key={c[0]}>{c[1]}</th>)}<th>Embrião</th><th className="no-print">Data/origem congelamento</th><th className="no-print">Ações</th></tr></thead><tbody>{linhas.map((l,i)=><tr key={l.id+'_'+i}>{campos.map(([campo,_,tipo])=><td key={campo}><input type={tipo} value={String(l[campo]||'')} onChange={e=>alterar(i,campo,e.target.value)}/></td>)}<td><select value={l.destino||'Fresco'} onChange={e=>{alterar(i,'destino',e.target.value);alterar(i,'estoqueEmbriaoId','')}}><option value="Fresco">FRESCO</option><option value="DT">DT</option><option value="VT">VT</option></select></td><td className="no-print">{(l.destino==='DT'||l.destino==='VT')?(l.estoqueBaixado?<b>Baixado</b>:<select className="stock-source-select" value={l.estoqueEmbriaoId||''} onChange={e=>alterar(i,'estoqueEmbriaoId',e.target.value)}><option value="">Selecione...</option>{opcoesEstoque(l).map(e=><option key={e.id} value={e.id}>{e.data?e.data.split('-').reverse().join('/'):'Sem data'} — {e.tipo} — saldo {e.quantidade}</option>)}</select>):'—'}</td><td className="no-print"><button className="btn small danger" onClick={()=>excluir(i)}>Excluir</button></td></tr>)}</tbody></table></div>
        {obs&&<div className="editable-print-note"><b>Observação:</b> {obs}</div>}
        <div className="editable-print-footer">{nomeEmpresa}{empresa?.cnpj&&<> • CNPJ {empresa.cnpj}</>} • {enderecoEmpresa}{empresa?.telefone&&<> • {empresa.telefone}</>}{empresa?.email&&<> • {empresa.email}</>}</div>
      </div>
    </div>}
  </section>
}

import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, LinhaRelatorioTransferenciaEditavel, RelatorioTransferenciaEditavelSalvo } from '../types/domain'
import { lerFichaTransferenciaIA } from '../services/fichaTransferenciaIA'

type Linha = LinhaRelatorioTransferenciaEditavel & {confianca?:'ok'|'revisar'}
const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const hoje=()=>new Date().toISOString().slice(0,10)

function vazio():Linha{
  return {id:id('SCAN'),data:hoje(),cliente:'',doadora:'',racaDoadora:'',touro:'',racaTouro:'',receptora:'',grauD7:'',estagioD7:'',ovario:'',grauCL:'',clCavitario:'',diagnostico:'',dataDiagnostico:'',destino:'Fresco',estoqueEmbriaoId:'',estoqueBaixado:false,confianca:'revisar'}
}

export function DigitalizarFichaTransferencia({db,onChange,onAbrirRelatorio}:{db:BancoEmbrioGestor;onChange:(db:BancoEmbrioGestor)=>void;onAbrirRelatorio?:()=>void}){
 const[arquivo,setArquivo]=useState<File|null>(null)
 const[preview,setPreview]=useState('')
 const[clienteId,setClienteId]=useState(db.clientes[0]?.id||'')
 const[dataTE,setDataTE]=useState(hoje())
 const[linhas,setLinhas]=useState<Linha[]>([])
 const[status,setStatus]=useState('')
 const[lendo,setLendo]=useState(false)
 const[avisosIA,setAvisosIA]=useState<string[]>([])
 const[modelo,setModelo]=useState<'AUTO'|'PLANILHA'|'CAMPO'>('AUTO')
 const[dg60,setDg60]=useState<Record<string,string>>({})
 const cliente=db.clientes.find(c=>c.id===clienteId)
 const revisar=useMemo(()=>linhas.filter(x=>x.confianca==='revisar').length,[linhas])

 function escolher(file?:File){
   if(!file)return
   setArquivo(file);setStatus('')
   if(file.type.startsWith('image/'))setPreview(URL.createObjectURL(file));else setPreview('')
   setLinhas([])
 }

 async function prepararRascunho(){
   if(!arquivo)return alert('Selecione ou fotografe uma ficha.')
   if(!navigator.onLine){setStatus('Sem internet. A leitura por IA precisa de conexão.');return}
   try{
     setLendo(true);setStatus('A IA está lendo a ficha completa…');setAvisosIA([])
     const res=await lerFichaTransferenciaIA(arquivo)
     const data=res.cabecalho?.dataTE||dataTE
     if(res.cabecalho?.dataTE)setDataTE(res.cabecalho.dataTE)
     const novas:Linha[]=(res.linhas||[]).map((r)=>{
       const q=String(r.qualidade||'').toUpperCase().replace(/\s+/g,' ').trim()
       const est=(q.match(/\b(MO|BI|BL|BX|BN|BE)\b/)?.[1]||'') as Linha['estagioD7']
       const gr=(q.match(/G(?:RAU\s*)?(1|2|3|I{1,3})\b/)?.[1]||'').replace('III','3').replace('II','2').replace('I','1')
       const cl=String(r.cl||'').toUpperCase().trim()
       const ovario=(cl.match(/\b(O[DE][123])\b/)?.[1]||'') as Linha['ovario']
       const cav=/CAV/.test(cl)?'Sim':''
       return {...vazio(),data,cliente:cliente?.nome||'',doadora:r.doadora||'',racaDoadora:r.racaDoadora||'',touro:r.touro||'',racaTouro:r.racaTouro||'',receptora:String(r.receptora||''),estagioD7:est,grauD7:gr?`G${gr}`:'',ovario,clCavitario:cav,diagnostico:'',confianca:r.confianca==='ok'?'ok':'revisar'}
     })
     setLinhas(novas.length?novas:[vazio()])
     setAvisosIA([...(res.avisos||[]),...res.linhas.filter(x=>x.alerta).map(x=>`Linha ${x.numero||'?'}: ${x.alerta}`)])
     setStatus(`Leitura concluída: ${novas.length} linha(s). Confira os campos marcados para revisão antes de salvar.`)
   }catch(e:any){setStatus(`Não foi possível ler a ficha: ${e?.message||e}`);if(!linhas.length)setLinhas([vazio()])}
   finally{setLendo(false)}
 }

 function alterar(i:number,k:keyof Linha,v:any){setLinhas(a=>a.map((x,n)=>n===i?{...x,[k]:v}:x))}
 function adicionar(){setLinhas(a=>[...a,{...vazio(),data:dataTE,cliente:cliente?.nome||''}])}
 function excluir(i:number){setLinhas(a=>a.filter((_,n)=>n!==i))}

 function salvarRascunho(){
   if(!clienteId)return alert('Selecione o cliente.')
   if(!linhas.length)return alert('Não há linhas para salvar.')
   const nome=cliente?.nome||''
   const prontas=linhas.map(l=>({...l,data:l.data||dataTE,cliente:l.cliente||nome}))
   const salvo:RelatorioTransferenciaEditavelSalvo={
     id:id('RELTE_SCAN'),criadoEm:new Date().toISOString(),clienteId,nomeRelatorio:nome,
     tipoPeriodo:'dia',periodo:dataTE,obs:`Rascunho digitalizado (${modelo==='AUTO'?'modelo automático':modelo==='CAMPO'?'ficha de campo manuscrita':'planilha antiga'})${arquivo?' — '+arquivo.name:''}. Revisar antes de qualquer movimentação de estoque. DG60: ${prontas.map(x=>`${x.receptora||'?'}=${dg60[x.id]||''}`).filter(x=>!x.endsWith('=')).join('; ')||'não informado'}.`,
     linhas:prontas
   }
   onChange({...db,relatoriosTransferenciaEditaveis:[...(db.relatoriosTransferenciaEditaveis||[]),salvo]})
   alert('Rascunho salvo em Relatório Transferência Editável. Nenhum estoque foi movimentado.')
   onAbrirRelatorio?.()
 }

 const campos:[keyof Linha,string][]=[
   ['doadora','Doadora'],['touro','Touro'],['racaTouro','Raça'],['estagioD7','Embrião'],
   ['receptora','Receptora'],['ovario','Ovário/CL'],['grauCL','Grau CL'],['diagnostico','DG 30']
 ]

 return <section className="panel scan-transfer">
   <div className="panel-head"><div><h2>Digitalizar Ficha de Transferência</h2><p>Fotografe a ficha no campo e transforme-a em um rascunho editável antes de salvar as transferências.</p></div></div>
   <div className="scan-steps"><span>1. Capturar ficha</span><span>2. Ler dados</span><span>3. Revisar</span><span>4. Salvar rascunho</span></div>
   <div className="scan-grid">
    <div className="scan-card">
      <h3>Ficha original</h3>
      <label><span>Modelo da ficha</span><select value={modelo} onChange={e=>setModelo(e.target.value as any)}><option value="AUTO">Detectar automaticamente</option><option value="PLANILHA">Planilha antiga / digitada</option><option value="CAMPO">Ficha de campo manuscrita SÊMINNA</option></select></label>
      <div className="scan-actions">
       <label className="btn primary scan-file">📷 Tirar foto<input type="file" accept="image/*" capture="environment" onChange={e=>escolher(e.target.files?.[0])}/></label>
       <label className="btn scan-file">Escolher foto<input type="file" accept="image/*" onChange={e=>escolher(e.target.files?.[0])}/></label>
       <label className="btn scan-file">Selecionar PDF<input type="file" accept="application/pdf" onChange={e=>escolher(e.target.files?.[0])}/></label>
      </div>
      {arquivo&&<div className="scan-file-name"><strong>{arquivo.name}</strong><small>{Math.round(arquivo.size/1024)} KB</small></div>}
      {preview?<img className="scan-preview" src={preview} alt="Prévia da ficha"/>:<div className="scan-placeholder">A foto da ficha aparecerá aqui.</div>}
      <button className="btn primary" disabled={!arquivo||lendo} onClick={prepararRascunho}>{lendo?'Lendo ficha com IA…':'Ler ficha com IA e gerar rascunho'}</button>
      {status&&<div className="scan-status">{status}</div>}{!!avisosIA.length&&<div className="note-box"><strong>Atenção na conferência:</strong><ul>{avisosIA.slice(0,12).map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
    </div>
    <div className="scan-card">
      <h3>Dados do rascunho</h3>
      <label><span>Cliente</span><select value={clienteId} onChange={e=>setClienteId(e.target.value)}>{db.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label><span>Data da transferência</span><input type="date" value={dataTE} onChange={e=>setDataTE(e.target.value)}/></label>
      <div className="scan-info">Um único módulo aceita a planilha antiga e a ficha de campo manuscrita SÊMINNA. No modo automático, a IA identifica o modelo e lê a ficha inteira. Repetições manuscritas (como ||) serão tratadas como “repetir linha anterior”, e identificações com zero à esquerda serão preservadas. A ficha original nunca altera o estoque automaticamente.</div>
    </div>
   </div>
   {!!linhas.length&&<div className="scan-review">
    <div className="panel-head"><div><h3>Prévia editável</h3><p>{linhas.length} linha(s) • {revisar} para revisar</p></div><button className="btn" onClick={adicionar}>+ Linha</button></div>
    <div className="table-wrap"><table><thead><tr><th>#</th>{campos.map(c=><th key={String(c[0])}>{c[1]}</th>)}<th>DG 60</th><th>Revisão</th><th></th></tr></thead>
    <tbody>{linhas.map((l,i)=><tr key={l.id} className={l.confianca==='revisar'?'scan-needs-review':''}><td>{i+1}</td>{campos.map(([k])=><td key={String(k)}><input value={String(l[k]||'')} onChange={e=>alterar(i,k,e.target.value)}/></td>)}<td><input value={dg60[l.id]||''} onChange={e=>setDg60(x=>({...x,[l.id]:e.target.value}))}/></td><td><select value={l.confianca||'revisar'} onChange={e=>alterar(i,'confianca',e.target.value)}><option value="revisar">Revisar</option><option value="ok">Conferido</option></select></td><td><button className="btn danger" onClick={()=>excluir(i)}>×</button></td></tr>)}</tbody></table></div>
    <div className="scan-footer"><button className="btn primary" onClick={salvarRascunho}>Salvar como Relatório Transferência Editável</button><small>Nesta etapa não há baixa de DT/VT nem criação automática de transferência oficial.</small></div>
   </div>}
 </section>
}

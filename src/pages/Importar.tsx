import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { importarBackup } from '../services/importLegacy'
import type { BancoEmbrioGestor } from '../types/domain'

type Destino = 'clientes'|'doadoras'|'aspiracoes'|'producoes'
const campos: Record<Destino,string[]> = {
  clientes:['nome','cpf','propriedade','municipio','uf','telefone','email'],
  doadoras:['cliente','nome','registro','raca','categoria','obs'],
  aspiracoes:['cliente','doadora','data','grau1','grau2','grau3','grau4','grau5'],
  producoes:['cliente','doadora','data','touro','oocitos','oocitosViaveis','clivados','embriõesD7','transferidosFresco','congeladosDT','congeladosVT']
}
const sinonimos:Record<string,string[]> = {
  nome:['nome','cliente','proprietario','produtor','fazenda','animal','matriz','doadora'],
  cliente:['cliente','proprietario','produtor','fazenda'],doadora:['doadora','animal','matriz'],
  data:['data','data opu','data coleta','data producao'],
  grau1:['g1','gi','grau 1'],grau2:['g2','gii','grau 2'],grau3:['g3','giii','grau 3'],
  grau4:['g4','desnudos'],grau5:['g5','atresicos'],
  oocitos:['oocitos','oocitos totais','total oocitos'],oocitosViaveis:['viaveis','oocitos viaveis','aptos'],
  embriõesD7:['embrioes d7','d7','blastocistos'],transferidosFresco:['fresco','a fresco'],
  congeladosDT:['dt','congelados dt'],congeladosVT:['vt','congelados vt'],
  touro:['touro','reprodutor','semen']
}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const valor=(v:unknown)=>v==null?'':String(v)
const numero=(s:string)=>Number((s||'0').replace(',','.'))||0
const uid=()=>`import-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
function dataISO(s:string){
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  const n=Number(s)
  if(n>20000&&n<90000){const d=XLSX.SSF.parse_date_code(n);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
  return ''
}
export function Importar({db,onImportar}:{db:BancoEmbrioGestor,onImportar:(db:BancoEmbrioGestor)=>void}){
  const [mensagem,setMensagem]=useState('')
  const [abas,setAbas]=useState<Record<string,string[][]>>({})
  const [aba,setAba]=useState('')
  const [destino,setDestino]=useState<Destino>('aspiracoes')
  const [cabecalho,setCabecalho]=useState(true)
  const [mapa,setMapa]=useState<Record<string,number>>({})
  const [confirmar,setConfirmar]=useState(false)
  const tabela=abas[aba]||[]
  const largura=Math.max(1,...tabela.map(r=>r.length))
  const titulos=Array.from({length:largura},(_,i)=>cabecalho?valor(tabela[0]?.[i])||`Coluna ${i+1}`:`Coluna ${i+1}`)
  const dados=cabecalho?tabela.slice(1):tabela
  const mapping=useMemo(()=>{
    const used=new Set<number>();const result:Record<string,number>={}
    for(const field of campos[destino]){
      if(mapa[field]!==undefined){if(mapa[field]>=0){result[field]=mapa[field];used.add(mapa[field])}continue}
      const options=[field,...(sinonimos[field]||[])]
      const idx=titulos.findIndex((h,i)=>!used.has(i)&&options.some(o=>norm(o)===norm(h)))
      if(idx>=0){result[field]=idx;used.add(idx)}
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[aba,abas,cabecalho,destino,mapa])
  function mudarTabela(next:string[][]){setAbas(p=>({...p,[aba]:next}));setConfirmar(false)}
  function editar(i:number,j:number,v:string){mudarTabela(tabela.map((r,k)=>k===i?Array.from({length:largura},(_,c)=>c===j?v:r[c]||''):r))}
  async function carregarPlanilha(file?:File){
    if(!file)return
    try{
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false})
      const sheets:Record<string,string[][]>={}
      workbook.SheetNames.forEach(name=>{sheets[name]=(XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false}) as unknown[][]).map(r=>r.map(valor))})
      setAbas(sheets);setAba(workbook.SheetNames[0]||'');setMapa({});setConfirmar(false)
      setMensagem(`${workbook.SheetNames.length} aba(s) carregada(s). Edite os dados antes de importar.`)
    }catch{setMensagem('Não foi possível abrir a planilha.')}
  }
  async function carregarBackup(file?:File){if(!file)return;try{const b=await importarBackup(file);if(window.confirm('O backup JSON substituirá os dados atuais. Deseja continuar?')){onImportar(b);setMensagem('Backup JSON restaurado.')}}catch{setMensagem('Não foi possível ler o backup JSON.')}}
  function exportar(){const wb=XLSX.utils.book_new();Object.entries(abas).forEach(([name,rows])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name.slice(0,31)));XLSX.writeFile(wb,'EmbrioGestor_Planilha_Editada.xlsx')}
  function preparar(){
    const novo:BancoEmbrioGestor={...db,clientes:[...db.clientes],doadoras:[...db.doadoras],aspiracoes:[...db.aspiracoes],producoes:[...db.producoes]}
    let criados=0,duplicados=0,erros=0
    for(const row of dados){
      const get=(key:string)=>valor(row[mapping[key]??-1]).trim()
      if(!row.some(x=>valor(x).trim()))continue
      const clienteNome=get(destino==='clientes'?'nome':'cliente')
      if(!clienteNome){erros++;continue}
      let cliente=novo.clientes.find(x=>norm(x.nome)===norm(clienteNome))
      if(destino==='clientes'){
        if(cliente){duplicados++;continue}
        novo.clientes.push({id:uid(),nome:clienteNome,cpf:get('cpf'),propriedade:get('propriedade'),municipio:get('municipio'),uf:get('uf'),telefone:get('telefone'),email:get('email')});criados++;continue
      }
      if(!cliente){cliente={id:uid(),nome:clienteNome};novo.clientes.push(cliente)}
      const doadoraNome=get(destino==='doadoras'?'nome':'doadora')
      if(!doadoraNome){erros++;continue}
      let doadora=novo.doadoras.find(x=>x.clienteId===cliente!.id&&norm(x.nome)===norm(doadoraNome))
      if(destino==='doadoras'){
        if(doadora){duplicados++;continue}
        novo.doadoras.push({id:uid(),clienteId:cliente.id,nome:doadoraNome,registro:get('registro'),raca:get('raca'),categoria:get('categoria'),obs:get('obs')});criados++;continue
      }
      if(!doadora){doadora={id:uid(),clienteId:cliente.id,nome:doadoraNome};novo.doadoras.push(doadora)}
      const data=dataISO(get('data'))
      if(!data){erros++;continue}
      if(destino==='aspiracoes'){
        if(novo.aspiracoes.some(x=>x.clienteId===cliente.id&&x.doadoraId===doadora!.id&&x.data===data)){duplicados++;continue}
        novo.aspiracoes.push({id:uid(),clienteId:cliente.id,doadoraId:doadora.id,data,grau1:numero(get('grau1')),grau2:numero(get('grau2')),grau3:numero(get('grau3')),grau4:numero(get('grau4')),grau5:numero(get('grau5'))});criados++
      }else{
        const touroNome=get('touro')
        let touro=novo.touros.find(x=>norm(x.nome)===norm(touroNome))
        if(touroNome&&!touro){touro={id:uid(),nome:touroNome,clienteId:cliente.id};novo.touros=[...novo.touros,touro]}
        if(novo.producoes.some(x=>x.clienteId===cliente.id&&x.doadoraId===doadora!.id&&x.data===data&&(!touroNome||x.touroId===touro?.id))){duplicados++;continue}
        novo.producoes.push({id:uid(),clienteId:cliente.id,doadoraId:doadora.id,data,touroId:touro?.id,oocitos:numero(get('oocitos')),oocitosViaveis:numero(get('oocitosViaveis')),clivados:numero(get('clivados')),embriõesD7:numero(get('embriõesD7')),transferidosFresco:numero(get('transferidosFresco')),congeladosDT:numero(get('congeladosDT')),congeladosVT:numero(get('congeladosVT'))});criados++
      }
    }
    return {novo,criados,duplicados,erros}
  }
  const resumo=useMemo(()=>tabela.length?preparar():null, // eslint-disable-next-line react-hooks/exhaustive-deps
    [abas,aba,destino,cabecalho,mapa])
  return <section className="panel" style={{display:'grid',gap:16}}>
    <h2>Importar Dados · Editor de Planilhas</h2>
    <p>Abra uma planilha, edite células, organize colunas e confira os dados antes de importar. Nenhuma alteração será gravada automaticamente.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
      <label className="btn" style={{cursor:'pointer'}}>Abrir Excel / CSV <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={e=>carregarPlanilha(e.target.files?.[0])}/></label>
      {tabela.length>0&&<button type="button" onClick={exportar}>Baixar planilha editada</button>}
    </div>
    {aba&&<>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <label>Aba <select value={aba} onChange={e=>{setAba(e.target.value);setMapa({});setConfirmar(false)}}>{Object.keys(abas).map(n=><option key={n}>{n}</option>)}</select></label>
        <label>Importar como <select value={destino} onChange={e=>{setDestino(e.target.value as Destino);setMapa({});setConfirmar(false)}}>{Object.keys(campos).map(n=><option key={n} value={n}>{n==='aspiracoes'?'Aspirações (OPU)':n==='producoes'?'Produções':n==='doadoras'?'Doadoras':'Clientes'}</option>)}</select></label>
        <label><input type="checkbox" checked={cabecalho} onChange={e=>{setCabecalho(e.target.checked);setMapa({})}}/> Primeira linha é cabeçalho</label>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button type="button" onClick={()=>mudarTabela([...tabela,Array(largura).fill('')])}>+ Linha</button>
        <button type="button" onClick={()=>mudarTabela(tabela.map(r=>[...r,'']))}>+ Coluna</button>
        <button type="button" onClick={()=>{const i=Number(window.prompt('Número da linha a excluir (1, 2, 3...)'));if(i>=1&&i<=tabela.length)mudarTabela(tabela.filter((_,j)=>j!==i-1))}}>Excluir linha</button>
        <button type="button" onClick={()=>{const i=Number(window.prompt('Número da coluna a excluir (1, 2, 3...)'));if(i>=1&&i<=largura)mudarTabela(tabela.map(r=>r.filter((_,j)=>j!==i-1)))}}>Excluir coluna</button>
        <button type="button" onClick={()=>{const a=Number(window.prompt('Mover coluna: posição atual (1, 2, 3...)'))-1;const b=Number(window.prompt('Nova posição (1, 2, 3...)'))-1;if(a>=0&&a<largura&&b>=0&&b<largura)mudarTabela(tabela.map(r=>{const v=Array.from({length:largura},(_,i)=>r[i]||'');v.splice(b,0,v.splice(a,1)[0]);return v}))}}>Mover coluna</button>
      </div>
      <div style={{overflowX:'auto',maxHeight:440,overflowY:'auto',border:'1px solid #ddd'}}><table style={{borderCollapse:'collapse',width:'max-content',minWidth:'100%'}}><thead><tr><th>#</th>{titulos.map((h,j)=><th key={j} style={{minWidth:145}}>{j+1} · {h}</th>)}</tr></thead><tbody>{tabela.map((row,i)=><tr key={i}><td>{i+1}</td>{Array.from({length:largura},(_,j)=><td key={j} style={{padding:2}}><input aria-label={`Linha ${i+1}, coluna ${j+1}`} style={{width:145,minWidth:110}} value={row[j]||''} onChange={e=>editar(i,j,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
      <h3>Associar colunas ao EmbrioGestor</h3>
      <div style={{display:'flex',flexWrap:'wrap',gap:12}}>{campos[destino].map(field=><label key={field} style={{display:'grid',gap:4,minWidth:170}}><span>{field}</span><select value={mapping[field]??-1} onChange={e=>{setMapa(p=>({...p,[field]:Number(e.target.value)}));setConfirmar(false)}}><option value={-1}>Não importar</option>{titulos.map((h,j)=><option value={j} key={j}>{j+1} · {h}</option>)}</select></label>)}</div>
      {resumo&&<div className="message">Prévia: {resumo.criados} novos registros, {resumo.duplicados} possíveis duplicados ignorados, {resumo.erros} linhas incompletas ou com data inválida. Clientes e doadoras inexistentes serão cadastrados automaticamente. Produções importadas não movimentam automaticamente estoques nesta etapa.</div>}
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="button" disabled={!resumo?.criados} onClick={()=>setConfirmar(true)}>Revisar importação</button>{confirmar&&resumo&&<button type="button" onClick={()=>{onImportar(resumo.novo);setMensagem(`${resumo.criados} registros importados com sucesso.`);setConfirmar(false);setAbas({});setAba('')}}>Confirmar e gravar {resumo.criados} registros</button>}<button type="button" onClick={()=>{setAbas({});setAba('');setConfirmar(false)}}>Cancelar edição</button></div>
    </>}
    <hr/>
    <h3>Restaurar backup do EmbrioGestor (JSON)</h3>
    <p>Atenção: esta opção substitui o banco atual. Utilize apenas para restaurar backups completos.</p>
    <label className="upload-box"><input type="file" accept=".json,application/json" onChange={e=>carregarBackup(e.target.files?.[0])}/><strong>Selecionar backup JSON</strong></label>
    {mensagem&&<div className="message">{mensagem}</div>}
  </section>
}

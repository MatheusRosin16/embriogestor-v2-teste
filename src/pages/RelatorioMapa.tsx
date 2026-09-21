import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { BancoEmbrioGestor } from '../types/domain'

const COLUNAS=[
  'Semestre ',
  'Ano',
  'Tipo de produto (inserir se in vivo ou in vitro)',
  'Classificação (informar se CCPE, CPIVE)',
  'Razão social do estabelecimento',
  'CNPJ (usar o formato UF XX.XXX.XXX/XXXX-XX)',
  'Nº de registro junto ao MAPA (usar o formato UF XXXX-X)',
  'UF',
  'Município',
  'Espécie (Bovino, bubalino, caprino, equídeo, ovino, suíno)',
  'Nome do  reprodutor',
  'Raça  do reprodutor ',
  'RGD/CEIP do reprodutor',
  'Nome da reprodutora',
  'Raça  da  reprodutora ',
  'RGD ou identificação da reprodutora',
  'Embriões produzidos (obrigatório preenchimento mesmo que seja  igual "0")',
  'Razão social do estabelecimento de origem do produto (preencher somente quando se tratar de outro estabelecimento)',
  'Embriões adquiridos de terceiros não importados (obrigatório preenchimento mesmo que seja  igual "0")',
  'Embriões importados (obrigatório preenchimento mesmo que seja  igual "0")',
  'País de origem dos embriões importados (obrigatório preenchimento mesmo que seja  igual "0")',
  'Embriões exportados (obrigatório preenchimento mesmo que seja  igual "0")',
  'País de destino dos embriões exportados (obrigatório preenchimento mesmo que seja  igual "0")',
  'Embriões comercializados no País (obrigatório preenchimento mesmo que seja  igual "0")',
  'Embriões em estoque (obrigatório preenchimento mesmo que seja  igual "0")'
] as const

type Cell=string|number
type Row={key:string; auto:boolean; values:Cell[]}

type Config={
  tipoProduto:string
  classificacao:string
  razaoSocial:string
  cnpj:string
  registroMapa:string
  uf:string
  municipio:string
  especie:string
}

const CONFIG_KEY='embriogestor2_mapa_config_v2'
const padrao:Config={
  tipoProduto:'in vitro',
  classificacao:'CPIVE',
  razaoSocial:'L F CICHOSKI E CIA LTDA',
  cnpj:'21.725.209/0001-92',
  registroMapa:'PR003999-3',
  uf:'PR',
  municipio:'Francisco Beltrão',
  especie:'BOVINO'
}

const AUTO_COLS=new Set([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,24])
const ZERO_COLS=[16,18,19,20,21,22,23,24]

function lerConfig():Config{
  try{return {...padrao,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}}catch{return padrao}
}
function storageKey(ano:string,semestre:string){return `embriogestor2_mapa_grid_${ano}_${semestre}`}
function lerSalvo(ano:string,semestre:string):Row[]{
  try{return JSON.parse(localStorage.getItem(storageKey(ano,semestre))||'[]')}catch{return []}
}
function salvarGrid(ano:string,semestre:string,rows:Row[]){
  localStorage.setItem(storageKey(ano,semestre),JSON.stringify(rows))
}

export function RelatorioMapa({db}:{db:BancoEmbrioGestor}){
  const[ano,setAno]=useState(String(new Date().getFullYear()))
  const[semestre,setSemestre]=useState<'1'|'2'>((new Date().getMonth()<6?'1':'2'))
  const[cfg,setCfg]=useState<Config>(lerConfig)
  const[rows,setRows]=useState<Row[]>([])
  const[carregando,setCarregando]=useState(false)

  function setConfig<K extends keyof Config>(k:K,v:Config[K]){
    const novo={...cfg,[k]:v}
    setCfg(novo)
    localStorage.setItem(CONFIG_KEY,JSON.stringify(novo))
  }

  const automaticas=useMemo(()=>{
    const a=Number(ano)
    const ini=semestre==='1'?`${a}-01-01`:`${a}-07-01`
    const fim=semestre==='1'?`${a}-06-30`:`${a}-12-31`
    const producoes=db.producoes.filter(p=>p.data>=ini&&p.data<=fim&&p.touroId)

    const grupos=new Map<string,typeof producoes>()
    producoes.forEach(p=>{
      const key=`${p.doadoraId}|${p.touroId||''}`
      const arr=grupos.get(key)||[]
      arr.push(p);grupos.set(key,arr)
    })

    return [...grupos.entries()].map(([key,itens]):Row=>{
      const p=itens[0]
      const d=db.doadoras.find(x=>x.id===p.doadoraId)
      const t=db.touros.find(x=>x.id===p.touroId)
      const rd=db.racas.find(x=>x.id===d?.racaId)
      const rt=db.racas.find(x=>x.id===t?.racaId)
      const produzidos=itens.reduce((s,x)=>s+Number(x.embriõesD7||0),0)

      // Estoque ATUAL. Como transferências DT/VT dão baixa no estoque,
      // esta coluna acompanha automaticamente as saídas de congelados.
      const estoque=db.estoqueEmbrioes
        .filter(e=>
          e.doadoraId===p.doadoraId &&
          e.touroId===(p.touroId||'') &&
          Number(e.quantidade)>0
        )
        .reduce((s,e)=>s+Number(e.quantidade||0),0)

      const values:Cell[]=[
        Number(semestre),
        Number(ano),
        cfg.tipoProduto,
        cfg.classificacao,
        cfg.razaoSocial,
        cfg.cnpj,
        cfg.registroMapa,
        cfg.uf,
        cfg.municipio,
        cfg.especie,
        t?.nome||'',
        rt?.nome||rt?.abreviatura||t?.raca||'',
        t?.registro||'',
        d?.nome||'',
        rd?.nome||rd?.abreviatura||d?.raca||'',
        d?.registro||'',
        produzidos,
        '',
        0,0,0,0,0,0,
        estoque
      ]
      return {key:`AUTO:${key}`,auto:true,values}
    })
  },[db,ano,semestre,cfg])

  // Combina linhas automáticas + edições manuais.
  // As colunas automáticas são sempre ressincronizadas com o banco.
  useEffect(()=>{
    const salvas=lerSalvo(ano,semestre)
    const salvasPorKey=new Map(salvas.map(r=>[r.key,r]))
    const merged:Row[]=automaticas.map(a=>{
      const old=salvasPorKey.get(a.key)
      if(!old)return a
      const vals=[...old.values]
      a.values.forEach((v,i)=>{ if(AUTO_COLS.has(i)) vals[i]=v })
      ZERO_COLS.forEach(i=>{ if(vals[i]===''||vals[i]===null||vals[i]===undefined) vals[i]=0 })
      return {...a,values:vals}
    })
    const manuais=salvas.filter(r=>!r.auto)
    setRows([...merged,...manuais])
  },[automaticas,ano,semestre])

  useEffect(()=>{
    if(rows.length) salvarGrid(ano,semestre,rows)
  },[rows,ano,semestre])

  function editar(rowIndex:number,colIndex:number,value:string){
    setRows(atual=>atual.map((r,i)=>{
      if(i!==rowIndex)return r
      const values=[...r.values]
      values[colIndex]=ZERO_COLS.includes(colIndex)&&value!==''&&!Number.isNaN(Number(value))?Number(value):value
      return {...r,values}
    }))
  }

  function adicionarLinha(){
    const values:Cell[]=Array(25).fill('')
    values[0]=Number(semestre);values[1]=Number(ano)
    values[2]=cfg.tipoProduto;values[3]=cfg.classificacao;values[4]=cfg.razaoSocial
    values[5]=cfg.cnpj;values[6]=cfg.registroMapa;values[7]=cfg.uf;values[8]=cfg.municipio;values[9]=cfg.especie
    ZERO_COLS.forEach(i=>values[i]=0)
    setRows(r=>[...r,{key:`MANUAL:${Date.now()}`,auto:false,values}])
  }

  function excluirLinha(index:number){
    const r=rows[index]
    if(r.auto){
      alert('Esta linha é gerada automaticamente pelas Produções. Para removê-la, corrija o cadastro/produção de origem.')
      return
    }
    if(confirm('Excluir esta linha manual?'))setRows(x=>x.filter((_,i)=>i!==index))
  }

  function restaurarAutomaticos(){
    if(!confirm('Atualizar os campos automáticos com os dados atuais do EmbrioGestor? Os campos manuais serão mantidos.'))return
    const manuais=rows.filter(r=>!r.auto)
    setRows([...automaticas,...manuais])
  }

  async function exportar(){
    setCarregando(true)
    try{
      const resp=await fetch(`${import.meta.env.BASE_URL}modelos/Relatorio_MAPA_modelo.xlsx`)
      if(!resp.ok)throw new Error('Modelo MAPA não encontrado.')
      const buffer=await resp.arrayBuffer()
      const wb=XLSX.read(buffer,{type:'array',cellStyles:true})
      const ws=wb.Sheets['Embriões']
      if(!ws)throw new Error('A aba "Embriões" não foi encontrada no modelo.')

      // Remove somente os dados antigos do modelo. Mantém linha 1 e a aba Orientações.
      const ref=XLSX.utils.decode_range(ws['!ref']||'A1:Y212')
      const last=Math.max(ref.e.r+1,rows.length+5)
      for(let r=1;r<last;r++){
        for(let c=0;c<25;c++){
          delete ws[XLSX.utils.encode_cell({r,c})]
        }
      }

      // Garante obrigatórios numéricos com 0 quando vazios.
      const dados=rows.map(r=>{
        const v=[...r.values]
        ZERO_COLS.forEach(i=>{if(v[i]===''||v[i]===null||v[i]===undefined)v[i]=0})
        return v
      })
      if(dados.length)XLSX.utils.sheet_add_aoa(ws,dados,{origin:'A2'})
      ws['!ref']=`A1:Y${Math.max(1,dados.length+1)}`

      XLSX.writeFile(wb,`Relatorio_MAPA_${ano}_${semestre}_semestre.xlsx`,{bookType:'xlsx',cellStyles:true})
    }catch(e:any){
      alert(e?.message||'Não foi possível gerar o arquivo MAPA.')
    }finally{
      setCarregando(false)
    }
  }

  return <section>
    <div className="page-title-block">
      <h2>Relatório Semestral MAPA</h2>
      <p>Modelo oficial com preenchimento automático e edição em formato de planilha.</p>
    </div>

    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Dados do estabelecimento</h3>
          <p>Os dados abaixo alimentam automaticamente todas as linhas do relatório.</p>
        </div>
        <button className="btn primary" onClick={exportar} disabled={carregando}>
          {carregando?'Gerando...':'Exportar Excel oficial'}
        </button>
      </div>

      <div className="mapa-config-grid">
        <label><span>Ano</span><input type="number" value={ano} onChange={e=>setAno(e.target.value)}/></label>
        <label><span>Semestre</span><select value={semestre} onChange={e=>setSemestre(e.target.value as '1'|'2')}><option value="1">1º semestre</option><option value="2">2º semestre</option></select></label>
        <label><span>Tipo de produto</span><select value={cfg.tipoProduto} onChange={e=>setConfig('tipoProduto',e.target.value)}><option value="in vitro">in vitro</option><option value="in vivo">in vivo</option></select></label>
        <label><span>Classificação</span><select value={cfg.classificacao} onChange={e=>setConfig('classificacao',e.target.value)}><option value="CPIVE">CPIVE</option><option value="CCPE">CCPE</option></select></label>
        <label><span>Razão social do estabelecimento</span><input value={cfg.razaoSocial} onChange={e=>setConfig('razaoSocial',e.target.value)}/></label>
        <label><span>CNPJ</span><input value={cfg.cnpj} onChange={e=>setConfig('cnpj',e.target.value)}/></label>
        <label><span>Nº de registro junto ao MAPA</span><input value={cfg.registroMapa} onChange={e=>setConfig('registroMapa',e.target.value)}/></label>
        <label><span>UF</span><input value={cfg.uf} onChange={e=>setConfig('uf',e.target.value)}/></label>
        <label><span>Município</span><input value={cfg.municipio} onChange={e=>setConfig('municipio',e.target.value)}/></label>
        <label><span>Espécie</span><select value={cfg.especie} onChange={e=>setConfig('especie',e.target.value)}><option>BOVINO</option><option>BUBALINO</option><option>CAPRINO</option><option>EQUÍDEO</option><option>OVINO</option><option>SUÍNO</option></select></label>
      </div>

      <div className="mapa-toolbar">
        <div>
          <strong>{rows.length}</strong> linha(s) • <strong>{automaticas.length}</strong> gerada(s) automaticamente
        </div>
        <div className="actions">
          <button className="btn small" onClick={restaurarAutomaticos}>Atualizar automáticos</button>
          <button className="btn small primary" onClick={adicionarLinha}>+ Adicionar linha manual</button>
        </div>
      </div>

      <div className="note-box">
        <strong>Automático:</strong> reprodutor, raça, RGD/CEIP, reprodutora, raça, registro/identificação, Embriões produzidos e Embriões em estoque são lidos do EmbrioGestor. 
        Quando uma transferência <strong>DT ou VT</strong> dá baixa no Estoque de Embriões, a coluna <strong>Embriões em estoque</strong> é atualizada automaticamente.
      </div>

      <div className="mapa-excel-wrap">
        <table className="mapa-excel">
          <thead>
            <tr>
              <th className="mapa-rownum">#</th>
              {COLUNAS.map((c,i)=><th key={c}><span className="mapa-col-letter">{XLSX.utils.encode_col(i)}</span>{c}</th>)}
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,ri)=><tr key={r.key} className={r.auto?'auto-row':'manual-row'}>
              <td className="mapa-rownum">{ri+2}</td>
              {r.values.map((v,ci)=><td key={ci} className={AUTO_COLS.has(ci)&&r.auto?'auto-cell':''}>
                <input
                  value={String(v??'')}
                  inputMode={ZERO_COLS.includes(ci)?'numeric':undefined}
                  onChange={e=>editar(ri,ci,e.target.value)}
                  title={AUTO_COLS.has(ci)&&r.auto?'Preenchido automaticamente. Pode editar antes da exportação.':''}
                />
              </td>)}
              <td><button className="btn small danger" onClick={()=>excluirLinha(ri)}>Excluir</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {!rows.length&&<div className="note-box">Não há Produções com touro cadastrado neste semestre. Você também pode adicionar uma linha manual.</div>}
    </div>
  </section>
}

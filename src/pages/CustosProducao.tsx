import { useMemo, useState } from 'react'
import type { BancoEmbrioGestor, CustoProducao } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'

const categorias:CustoProducao['categoria'][]=[
  'Meios de cultivo/laboratório','Material descartável','Mão de obra','Transporte',
  'Manutenção','Nitrogênio','Energia','Água','Outros'
]
const tipos:Array<NonNullable<CustoProducao['tipo']>>=['Fixo','Variável','Depreciação']
const id=()=> 'CUSTO_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)
const hojeMes=()=>new Date().toISOString().slice(0,7)
const n=(v:any)=>Math.max(0,Number(v)||0)
const moeda=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const pct=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'
const vazio:CustoProducao={
  id:'',competencia:hojeMes(),categoria:'Meios de cultivo/laboratório',
  descricao:'',valor:0,tipo:'Variável',clienteId:'',obs:''
}

export function CustosProducao({db,onChange}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void}){
  const[competencia,setCompetencia]=useState(hojeMes())
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<CustoProducao|null>(null)
  const[precoEmb,setPrecoEmb]=useState<number>(0)
  const[custoTe,setCustoTe]=useState<number>(0)

  const custosMes=useMemo(()=>db.custosProducao.filter(c=>c.competencia===competencia),[db,competencia])
  const custos=useMemo(()=>custosMes.filter(c=>{
    const cli=db.clientes.find(x=>x.id===c.clienteId)?.nome||''
    const q=busca.toLowerCase()
    return !q||String(c.categoria+' '+c.tipo+' '+c.descricao+' '+c.obs+' '+cli).toLowerCase().includes(q)
  }).sort((a,b)=>(a.tipo||'Variável').localeCompare(b.tipo||'Variável','pt-BR')||a.categoria.localeCompare(b.categoria,'pt-BR')),[custosMes,busca,db])

  const producoesMes=useMemo(()=>db.producoes.filter(p=>p.data.startsWith(competencia)),[db,competencia])
  const aspiracoesMes=useMemo(()=>db.aspiracoes.filter(a=>a.data.startsWith(competencia)),[db,competencia])
  const transferenciasMes=useMemo(()=>db.transferencias.filter(t=>t.data.startsWith(competencia)),[db,competencia])

  const indicadores=useMemo(()=>{
    const custoTotal=custosMes.reduce((s,c)=>s+n(c.valor),0)
    const fixos=custosMes.filter(c=>(c.tipo||'Variável')==='Fixo').reduce((s,c)=>s+n(c.valor),0)
    const variaveis=custosMes.filter(c=>(c.tipo||'Variável')==='Variável').reduce((s,c)=>s+n(c.valor),0)
    const depreciacao=custosMes.filter(c=>c.tipo==='Depreciação').reduce((s,c)=>s+n(c.valor),0)
    const oocitosViaveis=producoesMes.reduce((s,p)=>s+n(p.oocitosViaveis),0)
    const d7=producoesMes.reduce((s,p)=>s+n(p.embriõesD7),0)
    const fresco=producoesMes.reduce((s,p)=>s+n(p.transferidosFresco),0)
    const dt=producoesMes.reduce((s,p)=>s+n(p.congeladosDT),0)
    const vt=producoesMes.reduce((s,p)=>s+n(p.congeladosVT),0)
    const destinados=fresco+dt+vt
    const dg=transferenciasMes.filter(t=>t.diagnostico&&t.diagnostico!=='Pendente')
    const prenhes=dg.filter(t=>String(t.diagnostico).toLowerCase()==='positiva').length
    const custoComTE=custoTotal+n(custoTe)
    const margemUnitaria=precoEmb>0&&d7>0?precoEmb-(custoTotal/d7):0
    const margemTotal=precoEmb>0?precoEmb*destinados-custoTotal:0
    const custoVariavelUnit=d7?variaveis/d7:0
    const margemContrib=precoEmb-custoVariavelUnit
    const pontoEquilibrio=precoEmb>0&&margemContrib>0?Math.ceil((fixos+depreciacao)/margemContrib):0
    return {
      custoTotal,fixos,variaveis,depreciacao,oocitosViaveis,d7,fresco,dt,vt,destinados,prenhes,
      opus:aspiracoesMes.length,
      custoOocito:oocitosViaveis?custoTotal/oocitosViaveis:0,
      custoD7:d7?custoTotal/d7:0,
      custoDestinado:destinados?custoTotal/destinados:0,
      custoOPU:aspiracoesMes.length?custoTotal/aspiracoesMes.length:0,
      custoPrenhez:prenhes?custoComTE/prenhes:0,
      margemUnitaria,margemTotal,pontoEquilibrio,
      taxaProducao:oocitosViaveis?d7/oocitosViaveis*100:0
    }
  },[custosMes,producoesMes,aspiracoesMes,transferenciasMes,precoEmb,custoTe])

  const porCategoria=useMemo(()=>categorias.map(categoria=>({
    categoria,valor:custosMes.filter(c=>c.categoria===categoria).reduce((s,c)=>s+n(c.valor),0)
  })),[custosMes])

  const porCliente=useMemo(()=>{
    const totalProd=producoesMes.reduce((s,p)=>s+n(p.embriõesD7),0)
    return db.clientes.map(cli=>{
      const ps=producoesMes.filter(p=>p.clienteId===cli.id)
      const d7=ps.reduce((s,p)=>s+n(p.embriõesD7),0)
      const diretos=custosMes.filter(c=>c.clienteId===cli.id).reduce((s,c)=>s+n(c.valor),0)
      const compartilhados=custosMes.filter(c=>!c.clienteId).reduce((s,c)=>s+n(c.valor),0)
      const rateio=totalProd?compartilhados*(d7/totalProd):0
      const custo=diretos+rateio
      return {id:cli.id,nome:cli.nome,d7,diretos,rateio,custo,custoD7:d7?custo/d7:0}
    }).filter(x=>x.d7||x.diretos)
      .sort((a,b)=>b.custo-a.custo)
  },[db,custosMes,producoesMes])

  function salvar(c:CustoProducao){
    if(!c.competencia)return alert('Informe a competência.')
    if(n(c.valor)<=0)return alert('Informe um valor maior que zero.')
    const item={...c,id:c.id||id(),valor:n(c.valor),tipo:c.tipo||'Variável'}
    onChange({...db,custosProducao:c.id?db.custosProducao.map(x=>x.id===c.id?item:x):[...db.custosProducao,item]})
    setEdit(null)
  }

  return <section>
    <div className="page-title-block">
      <h2>Gestão Econômica da PIVE</h2>
      <p>Custos fixos, variáveis e depreciação com indicadores por etapa da produção.</p>
    </div>
    <div className="panel">
      <div className="panel-head">
        <div><h3>Competência mensal</h3><p>O custo por D7 mede a produção laboratorial; o custo por destinado mede o embrião efetivamente fresco/DT/VT.</p></div>
        <button className="btn primary" onClick={()=>setEdit({...vazio,competencia})}>Novo custo</button>
      </div>

      <div className="economic-controls">
        <label><span>Mês</span><input type="month" value={competencia} onChange={e=>setCompetencia(e.target.value)}/></label>
        <label><span>Preço médio cobrado/embrião (opcional)</span><input type="number" min="0" step="0.01" value={precoEmb||''} onChange={e=>setPrecoEmb(n(e.target.value))}/></label>
        <label><span>Custos adicionais TE/receptoras no mês</span><input type="number" min="0" step="0.01" value={custoTe||''} onChange={e=>setCustoTe(n(e.target.value))}/></label>
        <SearchBar value={busca} onChange={setBusca} placeholder="Pesquisar custos"/>
      </div>

      <h3 className="economic-section-title">Estrutura de custos</h3>
      <div className="cost-kpis">
        <div><span>Custos fixos</span><strong>{moeda(indicadores.fixos)}</strong></div>
        <div><span>Custos variáveis</span><strong>{moeda(indicadores.variaveis)}</strong></div>
        <div><span>Depreciação</span><strong>{moeda(indicadores.depreciacao)}</strong></div>
        <div className="cost-highlight"><span>Custo total</span><strong>{moeda(indicadores.custoTotal)}</strong></div>
      </div>

      <h3 className="economic-section-title">Eficiência e custo unitário</h3>
      <div className="economic-kpis">
        <div><span>OPUs</span><strong>{indicadores.opus}</strong><small>{moeda(indicadores.custoOPU)} / OPU</small></div>
        <div><span>Oócitos viáveis</span><strong>{indicadores.oocitosViaveis}</strong><small>{moeda(indicadores.custoOocito)} / viável</small></div>
        <div className="primary-economic"><span>Embriões D7</span><strong>{indicadores.d7}</strong><small>{moeda(indicadores.custoD7)} / embrião D7</small></div>
        <div><span>Taxa de produção</span><strong>{pct(indicadores.taxaProducao)}</strong><small>D7 ÷ viáveis</small></div>
        <div><span>Embriões destinados</span><strong>{indicadores.destinados}</strong><small>{moeda(indicadores.custoDestinado)} / destinado</small></div>
        <div><span>Fresco / DT / VT</span><strong>{indicadores.fresco} / {indicadores.dt} / {indicadores.vt}</strong><small>destinação dos embriões</small></div>
        <div><span>Prenhezes registradas</span><strong>{indicadores.prenhes}</strong><small>{indicadores.prenhes?moeda(indicadores.custoPrenhez)+' / prenhez':'Sem DG positiva no mês'}</small></div>
      </div>

      <div className="economic-explain">
        <strong>Como interpretar:</strong> “Custo por embrião D7” é o indicador principal do custo de produção laboratorial.
        “Custo por embrião destinado” usa Fresco + DT + VT. “Custo por prenhez” adiciona o valor informado de TE/receptoras antes de dividir pelas prenhezes registradas.
      </div>

      {precoEmb>0&&<><h3 className="economic-section-title">Resultado econômico</h3>
        <div className="cost-kpis">
          <div><span>Preço médio informado</span><strong>{moeda(precoEmb)}</strong></div>
          <div><span>Margem estimada / D7</span><strong>{moeda(indicadores.margemUnitaria)}</strong></div>
          <div><span>Resultado sobre destinados</span><strong>{moeda(indicadores.margemTotal)}</strong></div>
          <div><span>Ponto de equilíbrio</span><strong>{indicadores.pontoEquilibrio||'—'}</strong><small>embriões D7/mês</small></div>
        </div></>}

      <h3 className="economic-section-title">Custos por categoria</h3>
      <div className="cost-category-grid">
        {porCategoria.map(x=><div key={x.categoria}><span>{x.categoria}</span><strong>{moeda(x.valor)}</strong></div>)}
      </div>

      <h3 className="economic-section-title">Custo estimado por cliente</h3>
      <div className="economic-explain">
        Custos vinculados a um cliente entram diretamente nele. Custos sem cliente são compartilhados proporcionalmente aos embriões D7 produzidos no mês.
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Cliente</th><th>D7</th><th>Custos diretos</th><th>Rateio compartilhado</th><th>Custo atribuído</th><th>Custo/D7</th></tr></thead>
        <tbody>{porCliente.map(x=><tr key={x.id}><td><strong>{x.nome}</strong></td><td>{x.d7}</td><td>{moeda(x.diretos)}</td><td>{moeda(x.rateio)}</td><td>{moeda(x.custo)}</td><td><strong>{moeda(x.custoD7)}</strong></td></tr>)}
        {!porCliente.length&&<tr><td colSpan={6}>Sem dados para rateio neste mês.</td></tr>}</tbody></table>
      </div>

      <h3 className="economic-section-title">Lançamentos</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Tipo</th><th>Categoria</th><th>Cliente</th><th>Descrição</th><th>Valor</th><th>Observação</th><th>Ações</th></tr></thead>
        <tbody>{custos.map(c=><tr key={c.id}>
          <td><span className={`cost-type ${(c.tipo||'Variável').toLowerCase().replace('á','a')}`}>{c.tipo||'Variável'}</span></td>
          <td>{c.categoria}</td><td>{db.clientes.find(x=>x.id===c.clienteId)?.nome||'Compartilhado'}</td>
          <td>{c.descricao||'—'}</td><td>{moeda(c.valor)}</td><td>{c.obs||''}</td>
          <td><div className="actions"><button className="btn small" onClick={()=>setEdit({...c})}>Editar</button>
          <button className="btn small danger" onClick={()=>{if(confirm('Excluir este custo?'))onChange({...db,custosProducao:db.custosProducao.filter(x=>x.id!==c.id)})}}>Excluir</button></div></td>
        </tr>)}{!custos.length&&<tr><td colSpan={7}>Nenhum custo cadastrado nesta competência.</td></tr>}</tbody>
      </table></div>
    </div>

    {edit&&<Modal title={edit.id?'Editar custo':'Novo custo'} onClose={()=>setEdit(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Competência"><input type="month" value={edit.competencia} onChange={e=>setEdit({...edit,competencia:e.target.value})}/></Field>
        <Field label="Tipo de custo"><select value={edit.tipo||'Variável'} onChange={e=>setEdit({...edit,tipo:e.target.value as CustoProducao['tipo']})}>{tipos.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Categoria"><select value={edit.categoria} onChange={e=>setEdit({...edit,categoria:e.target.value as CustoProducao['categoria']})}>{categorias.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Cliente (opcional)"><SearchableSelect value={edit.clienteId||''} onChange={v=>setEdit({...edit,clienteId:v})} options={[...db.clientes].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio].join(' ')}))} placeholder="Digite o nome do cliente (opcional)"/></Field>
        <Field label="Descrição"><input value={edit.descricao||''} onChange={e=>setEdit({...edit,descricao:e.target.value})}/></Field>
        <Field label="Valor (R$)"><input type="number" min="0" step="0.01" value={edit.valor||''} onChange={e=>setEdit({...edit,valor:n(e.target.value)})}/></Field>
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>
      <div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn primary" data-enter-final="true" onClick={()=>salvar(edit)}>Salvar custo</button></div>
    </Modal>}
  </section>
}

import { useEffect, useMemo, useState } from 'react'
import type { BancoEmbrioGestor, Producao, Aspiracao, ServicoSemen, MovimentacaoItem, EstoqueEmbriaoItem, Transferencia } from '../types/domain'
import { Field, Modal, SearchBar, SearchableSelect } from '../components/CrudUI'
import { handleEnterFlow } from '../components/EnterFlow'
import { touroDoCliente } from '../services/tourosClientes'

const n=(v:any)=>Math.max(0,Number(String(v??'').replace(',','.'))||0)
const id=(p:string)=>p+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)
const hoje=()=>new Date().toISOString().slice(0,10)
const somarDias=(data:string,dias:number)=>{const d=new Date(data+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+dias);return d.toISOString().slice(0,10)}
const validarOPS=(p:Producao)=>{const q=n(p.congeladosVT),ops=p.opsDistribuicao||[];return q===0|| (ops.length>0&&ops.every(x=>Number.isInteger(x)&&x>=1&&x<=5)&&ops.reduce((a,b)=>a+b,0)===q)}

const novaProd:Producao={
  id:'',data:somarDias(hoje(),8),clienteId:'',doadoraId:'',touroId:'',
  oocitos:0,oocitosViaveis:0,clivados:0,embriõesD7:0,
  transferidosFresco:0,congeladosDT:0,congeladosVT:0,obs:''
}

const novoServico:ServicoSemen={
  id:'',data:hoje(),clienteId:'',touroId:'',partida:'',doses:1,obs:''
}

export type FiltroDashboardProducoes =
  | { modo: 'SERVICO'; clienteId: string; data: string }
  | { modo: 'MES'; ano: string; mes: string }
  | { modo: 'ANO'; ano: string }

export function Producoes({db,onChange,filtroInicial=null}:{db:BancoEmbrioGestor,onChange:(db:BancoEmbrioGestor)=>void,filtroInicial?:FiltroDashboardProducoes|null}){
  const[filtroDashboard,setFiltroDashboard]=useState<FiltroDashboardProducoes|null>(filtroInicial)
  const[busca,setBusca]=useState('')
  const[edit,setEdit]=useState<Producao|null>(null)
  const[manual,setManual]=useState<Producao|null>(null)
  const[ultimaSessao,setUltimaSessao]=useState<{clienteId:string,data:string}|null>(null)
  const[servico,setServico]=useState<ServicoSemen|null>(null)
  const[clienteAberto,setClienteAberto]=useState<string|null>(null)
  const[dataAberta,setDataAberta]=useState<string|null>(null)

  // Repara também produções antigas que foram cadastradas sem ficha de aspiração.
  useEffect(()=>{
    let mudou=false
    let aspiracoes=[...db.aspiracoes]
    let producoes=[...db.producoes]
    const grupos=new Map<string,Producao[]>()
    for(const p of producoes){
      if(!p.clienteId||!p.doadoraId||!p.data)continue
      const k=[p.clienteId,p.doadoraId,p.data].join('|')
      if(!grupos.has(k))grupos.set(k,[])
      grupos.get(k)!.push(p)
    }
    for(const itens of grupos.values()){
      const p=itens[0]
      let asp=aspiracoes.find(a=>a.id===p.origemAspiracaoId) || aspiracoes.find(a=>a.clienteId===p.clienteId&&a.doadoraId===p.doadoraId&&somarDias(a.data,8)===p.data)
      if(!asp){
        asp={id:id('ASP'),data:somarDias(p.data,-8),clienteId:p.clienteId,doadoraId:p.doadoraId,grau1:0,grau2:0,grau3:0,grau4:0,grau5:0,oocitosTotaisInformados:itens.reduce((v,x)=>v+n(x.oocitos),0),oocitosViaveisInformados:itens.reduce((v,x)=>v+n(x.oocitosViaveis),0),geradaPelaProducao:true,touroId:p.touroId||'',obs:'Aspiração gerada automaticamente a partir da Produção de Embriões.'}
        aspiracoes.push(asp);mudou=true
      }else if(asp.geradaPelaProducao){
        const total=itens.reduce((v,x)=>v+n(x.oocitos),0),viaveis=itens.reduce((v,x)=>v+n(x.oocitosViaveis),0)
        if(n(asp.oocitosTotaisInformados)!==total||n(asp.oocitosViaveisInformados)!==viaveis){
          aspiracoes=aspiracoes.map(a=>a.id===asp!.id?{...a,oocitosTotaisInformados:total,oocitosViaveisInformados:viaveis}:a);mudou=true
        }
      }
      if(itens.some(x=>x.origemAspiracaoId!==asp!.id)){
        const ids=new Set(itens.map(x=>x.id));producoes=producoes.map(x=>ids.has(x.id)?{...x,origemAspiracaoId:asp!.id}:x);mudou=true
      }
    }
    if(mudou)onChange({...db,aspiracoes,producoes})
  },[db.aspiracoes,db.producoes])

  const grupos=useMemo(()=>{
    const m=new Map<string,Producao[]>()

    for(const p of db.producoes){
      const data=String(p.data||'').slice(0,10)
      if(filtroDashboard?.modo==='SERVICO' && (p.clienteId!==filtroDashboard.clienteId || data!==filtroDashboard.data))continue
      if(filtroDashboard?.modo==='MES' && (data.slice(0,4)!==filtroDashboard.ano || data.slice(5,7)!==filtroDashboard.mes))continue
      if(filtroDashboard?.modo==='ANO' && data.slice(0,4)!==filtroDashboard.ano)continue

      const c=db.clientes.find(x=>x.id===p.clienteId)
      const d=db.doadoras.find(x=>x.id===p.doadoraId)
      const t=db.touros.find(x=>x.id===p.touroId)
      const q=busca.toLowerCase()

      if(q&&!String(c?.nome+' '+d?.nome+' '+t?.nome+' '+p.data).toLowerCase().includes(q))continue

      const key=p.clienteId+'|'+data
      if(!m.has(key))m.set(key,[])
      m.get(key)!.push(p)
    }

    return [...m.entries()].map(([key,itens])=>{
      const [clienteId,data]=key.split('|')
      return {
        cliente:db.clientes.find(c=>c.id===clienteId),
        clienteId,
        data,
        itens:[...itens].sort((a,b)=>(n(a.ordem)-n(b.ordem)) || db.producoes.indexOf(a)-db.producoes.indexOf(b))
      }
    }).filter(g=>g.cliente)
      .sort((a,b)=>a.cliente!.nome.localeCompare(b.cliente!.nome,'pt-BR')||b.data.localeCompare(a.data))
  },[db,busca,filtroDashboard])

  const clientesGrupos=useMemo(()=>{
    const mapa=new Map<string,typeof grupos>()
    for(const g of grupos){
      if(!mapa.has(g.clienteId))mapa.set(g.clienteId,[])
      mapa.get(g.clienteId)!.push(g)
    }
    return [...mapa.entries()].map(([clienteId,datas])=>({
      clienteId,
      cliente:datas[0]?.cliente,
      datas:[...datas].sort((a,b)=>b.data.localeCompare(a.data)),
      total:datas.reduce((n,g)=>n+g.itens.length,0)
    })).sort((a,b)=>(a.cliente?.nome||'').localeCompare(b.cliente?.nome||'','pt-BR'))
  },[grupos])

  function sincronizarTransferenciasFresco(transferencias:Transferencia[],p:Producao,quantidade:number){
    const desejado=n(quantidade)
    const existentes=transferencias.filter(t=>t.origemProducaoId===p.id&&t.destino==='Fresco'&&t.geradaPelaProducao)
    let resultado=[...transferencias]
    if(existentes.length<desejado){
      const faltam=desejado-existentes.length
      for(let i=0;i<faltam;i++){
        resultado.push({
          id:id('TEAUTO'),data:p.data,clienteId:p.clienteId,doadoraId:p.doadoraId,touroId:p.touroId||'',
          origemProducaoId:p.id,usarDoadoraOutroProdutor:false,receptora:'',embriãoEstagio:'',
          embriãoGrau:'',ovarioCL:'',destino:'Fresco',diagnostico:'',dataDiagnostico:'',
          profissionalId:'',obs:'Transferência gerada automaticamente a partir de embrião a fresco na Produção.',
          geradaPelaProducao:true
        })
      }
    }else if(existentes.length>desejado){
      const remover=new Set(existentes.slice(desejado).map(t=>t.id))
      resultado=resultado.filter(t=>!remover.has(t.id))
    }
    return resultado
  }

  // Garante também para dados antigos que todo embrião a fresco tenha sua linha de transferência/relatório.
  useEffect(()=>{
    let transferencias=[...db.transferencias]
    let mudou=false
    for(const p of db.producoes){
      const qtd=n(p.transferidosFresco)
      const atual=transferencias.filter(t=>t.origemProducaoId===p.id&&t.destino==='Fresco'&&t.geradaPelaProducao).length
      if(atual!==qtd){transferencias=sincronizarTransferenciasFresco(transferencias,p,qtd);mudou=true}
    }
    if(mudou)onChange({...db,transferencias})
  },[db.producoes,db.transferencias])

  function proximaOrdem(clienteId:string,data:string){
    const itens=db.producoes.filter(p=>p.clienteId===clienteId&&String(p.data||'').slice(0,10)===String(data||'').slice(0,10))
    return itens.reduce((m,p,i)=>Math.max(m,Number(p.ordem)||i+1),0)+1
  }

  function moverProducao(p:Producao,direcao:-1|1){
    const itens=db.producoes
      .filter(x=>x.clienteId===p.clienteId&&String(x.data||'').slice(0,10)===String(p.data||'').slice(0,10))
      .sort((a,b)=>(n(a.ordem)-n(b.ordem)) || db.producoes.indexOf(a)-db.producoes.indexOf(b))
    const idx=itens.findIndex(x=>x.id===p.id), destino=idx+direcao
    if(idx<0||destino<0||destino>=itens.length)return
    const ids=[...itens.map(x=>x.id)]; [ids[idx],ids[destino]]=[ids[destino],ids[idx]]
    const ordem=new Map(ids.map((id,i)=>[id,i+1]))
    onChange({...db,producoes:db.producoes.map(x=>ordem.has(x.id)?{...x,ordem:ordem.get(x.id)}:x)})
  }

  function sincronizarAspiracaoDaProducao(baseAspiracoes:Aspiracao[],producoes:Producao[],item:Producao){
    const existente=baseAspiracoes.find(a=>a.id===item.origemAspiracaoId) || baseAspiracoes.find(a=>a.clienteId===item.clienteId&&a.doadoraId===item.doadoraId&&somarDias(a.data,8)===item.data)
    if(existente&&!existente.geradaPelaProducao)return {aspiracoes:baseAspiracoes,aspiracaoId:existente.id}
    const relacionadas=producoes.filter(p=>p.clienteId===item.clienteId&&p.doadoraId===item.doadoraId&&p.data===item.data)
    const total=relacionadas.reduce((s,p)=>s+n(p.oocitos),0)
    const viaveis=relacionadas.reduce((s,p)=>s+n(p.oocitosViaveis),0)
    if(existente){
      return {aspiracoes:baseAspiracoes.map(a=>a.id===existente.id?{...a,oocitosTotaisInformados:total,oocitosViaveisInformados:viaveis,touroId:a.touroId||item.touroId||''}:a),aspiracaoId:existente.id}
    }
    const nova:Aspiracao={id:id('ASP'),data:somarDias(item.data,-8),clienteId:item.clienteId,doadoraId:item.doadoraId,grau1:0,grau2:0,grau3:0,grau4:0,grau5:0,oocitosTotaisInformados:total,oocitosViaveisInformados:viaveis,geradaPelaProducao:true,touroId:item.touroId||'',obs:'Aspiração gerada automaticamente a partir da Produção de Embriões.'}
    return {aspiracoes:[...baseAspiracoes,nova],aspiracaoId:nova.id}
  }

  function atualizarEstoqueCongelado(producao:Producao, estoqueInicial:EstoqueEmbriaoItem[], movimentosIniciais:MovimentacaoItem[]){
    const estoque=[...estoqueInicial],movimentos=[...movimentosIniciais]
    for(const tipo of ['DT','VT'] as const){
      const existentes=estoque.filter(e=>e.origemProducaoId===producao.id&&e.tipo===tipo)
      const usados=movimentos.filter(m=>m.tipo==='SAIDA_EMBRIAO'&&existentes.some(e=>e.id===m.estoqueId)).reduce((v,m)=>v+n(m.quantidade),0)
      const totalNovo=tipo==='DT'?n(producao.congeladosDT):n(producao.congeladosVT)
      if(existentes.some(e=>e.entregue)||usados>0){
        const anterior=db.producoes.find(p=>p.id===producao.id)
        const totalAntigo=tipo==='DT'?n(anterior?.congeladosDT):n(anterior?.congeladosVT)
        if(totalNovo!==totalAntigo||(tipo==='VT'&&JSON.stringify(anterior?.opsDistribuicao||[])!==JSON.stringify(producao.opsDistribuicao||[])))throw new Error('Já existem movimentações deste congelamento. Não é possível redistribuir ou alterar a quantidade sem conciliação do estoque.')
        continue
      }
      if(tipo==='VT'&&existentes.some(e=>e.quantidade<1))throw new Error('Há OPS VT já utilizadas. Não é possível redistribuir a produção.')
      const quantidades=tipo==='VT'?(producao.opsDistribuicao||[]):totalNovo?[totalNovo]:[]
      const jaCorreto=existentes.length===quantidades.length&&existentes.every((e,i)=>n(e.quantidade)===quantidades[i]&&(tipo!=='VT'||e.opsId===`${producao.id}-OPS-${String(i+1).padStart(2,'0')}`))
      if(jaCorreto)continue
      for(const e of existentes){const i=estoque.findIndex(x=>x.id===e.id);if(i>=0)estoque.splice(i,1)}
      quantidades.forEach((q,i)=>{
        const e:EstoqueEmbriaoItem={id:id('EMBEST'),clienteId:producao.clienteId,data:producao.data,doadoraId:producao.doadoraId,touroId:producao.touroId||'',tipo,quantidade:q,origemProducaoId:producao.id,opsId:tipo==='VT'?`${producao.id}-OPS-${String(i+1).padStart(2,'0')}`:undefined,botijao:existentes[i]?.botijao||'',caneca:existentes[i]?.caneca||'',raque:existentes[i]?.raque||'',posicao:existentes[i]?.posicao||'',obs:'Gerado pela produção; localização editável no estoque'}
        estoque.push(e)
        movimentos.push({id:id('MOV'),data:new Date().toISOString(),tipo:'ENTRADA_EMBRIAO',clienteId:e.clienteId,doadoraId:e.doadoraId,touroId:e.touroId,estoqueId:e.id,quantidade:q,descricao:`Entrada ${tipo} da produção ${producao.id}${e.opsId?' — '+e.opsId:''}`})
      })
    }
    return {estoqueEmbrioes:estoque,movimentacoes:movimentos}
  }


  function camposOPS(p:Producao,alterar:(p:Producao)=>void){
    const quantidades=p.opsDistribuicao||[]
    return <div className="ops-editor" style={{gridColumn:'1 / -1',border:'1px solid #c8d8e3',padding:12,borderRadius:8}}>
      <strong>Distribuição VT por OPS (1 a 5 embriões por OPS)</strong>
      <p style={{fontSize:12,margin:'5px 0'}}>Identifique as OPS agora; botijão, caneca e rack serão preenchidos no estoque. Total: {quantidades.reduce((a,b)=>a+n(b),0)} de {n(p.congeladosVT)} embriões.</p>
      {quantidades.map((q,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',margin:'5px 0'}}><label style={{minWidth:68}}>OPS {i+1}</label><input aria-label={`Embriões OPS ${i+1}`} type="number" min="1" max="5" value={q} onChange={e=>alterar({...p,opsDistribuicao:quantidades.map((v,j)=>j===i?n(e.target.value):v)})}/><button type="button" className="btn small" onClick={()=>alterar({...p,opsDistribuicao:quantidades.filter((_,j)=>j!==i)})}>Excluir OPS</button></div>)}
      <button type="button" className="btn small" onClick={()=>alterar({...p,opsDistribuicao:[...quantidades,Math.min(5,Math.max(1,n(p.congeladosVT)-quantidades.reduce((a,b)=>a+n(b),0)))]})}>+ Adicionar OPS</button>
      {!validarOPS(p)&&<p style={{color:'#b42318',fontWeight:700}}>A soma das OPS deve ser igual aos embriões VT produzidos.</p>}
    </div>
  }

  function salvarEdicao(p:Producao){
    const antigo=db.producoes.find(x=>x.id===p.id)
    const atualizado={...p,oocitos:n(p.oocitos),oocitosViaveis:n(p.oocitosViaveis),clivados:n(p.clivados),embriõesD7:n(p.embriõesD7),transferidosFresco:n(p.transferidosFresco),congeladosDT:n(p.congeladosDT),congeladosVT:n(p.congeladosVT)}
    let estoqueEmbrioes:EstoqueEmbriaoItem[],movimentacoes:MovimentacaoItem[]
    try{({estoqueEmbrioes,movimentacoes}=atualizarEstoqueCongelado(atualizado,db.estoqueEmbrioes,db.movimentacoes))}catch(e){return alert((e as Error).message)}
    if(!validarOPS(atualizado))return alert('Distribua todos os embriões VT em OPS de 1 a 5 embriões antes de salvar.')
    if(n(atualizado.oocitosViaveis)>n(atualizado.oocitos))return alert('Os oócitos viáveis não podem ser maiores que os oócitos totais.')
    let producoes=db.producoes.map(x=>x.id===p.id?atualizado:x)
    const sync=sincronizarAspiracaoDaProducao(db.aspiracoes,producoes,atualizado)
    producoes=producoes.map(x=>x.id===atualizado.id?{...x,origemAspiracaoId:x.origemAspiracaoId||sync.aspiracaoId}:x)
    const transferencias=sincronizarTransferenciasFresco(db.transferencias,atualizado,atualizado.transferidosFresco)
    onChange({...db,aspiracoes:sync.aspiracoes,producoes,estoqueEmbrioes,movimentacoes,transferencias});setEdit(null)
  }
  function salvarManual(p:Producao,continuarDivisao=false){
    if(!p.data||!p.clienteId||!p.doadoraId)return alert('Informe data, cliente e doadora.')
    if(!validarOPS(p))return alert('Distribua todos os embriões VT em OPS de 1 a 5 embriões antes de salvar.')
    if(n(p.oocitosViaveis)>n(p.oocitos))return alert('Os oócitos viáveis não podem ser maiores que os oócitos totais.')

    const item:Producao={...p,id:p.id||id('PROD'),ordem:p.ordem||proximaOrdem(p.clienteId,p.data),oocitos:n(p.oocitos),oocitosViaveis:n(p.oocitosViaveis),clivados:n(p.clivados),embriõesD7:n(p.embriõesD7),transferidosFresco:n(p.transferidosFresco),congeladosDT:n(p.congeladosDT),congeladosVT:n(p.congeladosVT)}
    let producoes=p.id?db.producoes.map(x=>x.id===p.id?item:x):[...db.producoes,item]
    const sync=sincronizarAspiracaoDaProducao(db.aspiracoes,producoes,item)
    const itemVinculado={...item,origemAspiracaoId:item.origemAspiracaoId||sync.aspiracaoId}
    producoes=producoes.map(x=>x.id===item.id?itemVinculado:x)
    const transferencias=sincronizarTransferenciasFresco(db.transferencias,itemVinculado,itemVinculado.transferidosFresco)
    let estoqueEmbrioes:EstoqueEmbriaoItem[],movimentacoes:MovimentacaoItem[]
    try{({estoqueEmbrioes,movimentacoes}=atualizarEstoqueCongelado(itemVinculado,db.estoqueEmbrioes,db.movimentacoes))}catch(e){return alert((e as Error).message)}
    onChange({...db,aspiracoes:sync.aspiracoes,producoes,transferencias,estoqueEmbrioes,movimentacoes})
    setUltimaSessao({clienteId:item.clienteId,data:item.data})
    if(continuarDivisao){
      setManual({...novaProd,data:item.data,clienteId:item.clienteId,doadoraId:item.doadoraId,origemAspiracaoId:sync.aspiracaoId,ordem:(item.ordem||0)+1})
    }else setManual(null)
  }

  function excluirProducao(p:Producao){
    if(confirm('Excluir esta produção?')){
      const producoes=db.producoes.filter(x=>x.id!==p.id)
      let aspiracoes=[...db.aspiracoes]
      const asp=aspiracoes.find(a=>a.id===p.origemAspiracaoId || (a.clienteId===p.clienteId&&a.doadoraId===p.doadoraId&&somarDias(a.data,8)===p.data))
      if(asp?.geradaPelaProducao){
        const restantes=producoes.filter(x=>x.clienteId===p.clienteId&&x.doadoraId===p.doadoraId&&x.data===p.data)
        if(!restantes.length)aspiracoes=aspiracoes.filter(a=>a.id!==asp.id)
        else aspiracoes=aspiracoes.map(a=>a.id===asp.id?{...a,oocitosTotaisInformados:restantes.reduce((v,x)=>v+n(x.oocitos),0),oocitosViaveisInformados:restantes.reduce((v,x)=>v+n(x.oocitosViaveis),0)}:a)
      }
      onChange({...db,aspiracoes,producoes})
    }
  }

  function abrirServico(clienteId:string,data:string,s?:ServicoSemen){
    if(s){
      setServico({...s})
      return
    }
    setServico({...novoServico,clienteId,data})
  }

  function salvarServico(s:ServicoSemen){
    if(!s.clienteId||!s.data||!s.touroId)return alert('Informe cliente, data e touro.')
    if(n(s.doses)<=0)return alert('Informe a quantidade de doses.')
    const item={...s,id:s.id||id('SEM'),doses:n(s.doses)}
    const anterior=s.id?db.servicosSemen.find(x=>x.id===s.id):undefined
    const servicos=s.id?db.servicosSemen.map(x=>x.id===s.id?item:x):[...db.servicosSemen,item]
    let estoque=[...db.estoque], movimentacoes=[...db.movimentacoes]
    const deltaDose=n(item.doses)-n(anterior?.doses||0)
    if(deltaDose!==0 && item.partida){
      const chave=(v:any)=>String(v||'').trim().toLowerCase().replace(/\s+/g,'')
      const indices=estoque.map((e,i)=>({e,i})).filter(({e})=>e.clienteId===item.clienteId&&e.touroId===item.touroId&&chave(e.partida)===chave(item.partida))
      if(indices.length){
        const disponivel=indices.reduce((a,{e})=>a+n(e.saldo),0)
        if(deltaDose>0 && disponivel<deltaDose){alert(`Saldo insuficiente desta partida. Disponível: ${disponivel.toLocaleString('pt-BR')} dose(s).`);return}
        if(deltaDose>0){
          let falta=deltaDose
          for(const {i} of indices){
            if(falta<=0)break
            const atual=estoque[i], retirar=Math.min(n(atual.saldo),falta)
            if(retirar<=0)continue
            estoque[i]={...atual,usadas:n(atual.usadas)+retirar,saldo:Math.max(0,n(atual.saldo)-retirar)}
            falta-=retirar
          }
        }else{
          // Ao reduzir uma dose já lançada, devolve o saldo para uma das posições da mesma partida.
          const i=indices[0].i, atual=estoque[i], devolver=Math.abs(deltaDose)
          estoque[i]={...atual,usadas:Math.max(0,n(atual.usadas)-devolver),saldo:n(atual.saldo)+devolver}
        }
        const mov:MovimentacaoItem={id:id('MOV'),data:new Date().toISOString(),tipo:deltaDose>0?'SAIDA_SEMEN':'AJUSTE',clienteId:item.clienteId,touroId:item.touroId,estoqueId:indices[0].e.id,quantidade:Math.abs(deltaDose),descricao:deltaDose>0?`Uso de sêmen no serviço de ${item.data}${item.partida?' — partida '+item.partida:''}`:`Ajuste de doses do serviço de ${item.data}${item.partida?' — partida '+item.partida:''}`}
        movimentacoes=[...movimentacoes,mov]
      }
    }
    const producoes=db.producoes.map(p=>p.clienteId===item.clienteId&&p.data===item.data&&!p.touroId?{...p,touroId:item.touroId}:p)
    onChange({...db,servicosSemen:servicos,producoes,estoque,movimentacoes});setServico(null)
  }
  function excluirServico(s:ServicoSemen){
    if(confirm('Excluir este registro de sêmen do serviço?')){
      onChange({...db,servicosSemen:db.servicosSemen.filter(x=>x.id!==s.id)})
    }
  }

  const tourosClienteEdit=edit?db.touros.filter(t=>touroDoCliente(t,edit.clienteId)):[]
  const tourosClienteManual=manual?db.touros.filter(t=>touroDoCliente(t,manual.clienteId)):[]
  const doadorasClienteManual=manual?db.doadoras.filter(d=>d.clienteId===manual.clienteId):[]
  const tourosClienteServico=servico?db.touros.filter(t=>touroDoCliente(t,servico.clienteId)):[]

  const partidasServico=useMemo(()=>{
    if(!servico?.clienteId||!servico?.touroId)return []
    const itens=(db.estoque||[]).filter((e:any)=>
      String(e.clienteId||'')===String(servico.clienteId) &&
      String(e.touroId||'')===String(servico.touroId)
    )
    return [...new Set(itens.map((e:any)=>String(e.partida||'').trim()).filter(Boolean))]
  },[db.estoque,servico?.clienteId,servico?.touroId])

  return <section className="panel production-date-design">
    <div className="panel-head"><div><h2>Produção de Embriões</h2><p>Produções organizadas por cliente e, dentro de cada cliente, por data.</p></div><button className="btn primary" onClick={()=>setManual({...novaProd,...(ultimaSessao||{})})}>Nova produção</button></div>

    {filtroDashboard && <div className="dashboard-production-filter-notice"><span>{filtroDashboard.modo==='SERVICO'?`Exibindo somente a produção selecionada de ${db.clientes.find(c=>c.id===filtroDashboard.clienteId)?.nome||'cliente'} em ${filtroDashboard.data.split('-').reverse().join('/')}.`:filtroDashboard.modo==='MES'?`Exibindo somente as produções de ${filtroDashboard.mes}/${filtroDashboard.ano}.`:`Exibindo somente as produções de ${filtroDashboard.ano}.`}</span><button className="btn small" onClick={()=>setFiltroDashboard(null)}>Mostrar todas</button></div>}
    <div className="toolbar donor-search-toolbar"><SearchBar value={busca} onChange={v=>{setBusca(v);if(v){setFiltroDashboard(null);setClienteAberto(null);setDataAberta(null)}}} placeholder="Pesquisar cliente, doadora, touro ou data"/></div>

    <div className={`donor-folders ${clienteAberto&&!busca.trim()&&!filtroDashboard?'has-open':''}`}>
      {clientesGrupos.map(cg=>{
        const forcarAberto=!!filtroDashboard
        const aberto=forcarAberto?true:clienteAberto===cg.clienteId
        if(clienteAberto&&!forcarAberto&&!aberto)return null
        return <div className={`donor-client-card ${aberto?'is-open':''}`} key={cg.clienteId}>
          <button type="button" className="donor-client-button" onClick={()=>{if(!forcarAberto){setClienteAberto(aberto?null:cg.clienteId);setDataAberta(null);if(!aberto)setBusca('')}}}><span className="donor-folder-icon">▰</span><span className="donor-client-main"><strong>{cg.cliente?.nome}</strong><small>{cg.cliente?.propriedade||cg.cliente?.municipio||'Cliente'}</small></span><span className="donor-folder-count">{cg.datas.length} data(s)</span></button>
          {aberto&&<div className="donor-open-content">
            <div className="donor-open-head"><div><strong>{cg.cliente?.nome}</strong><span>{cg.total} produção(ões) em {cg.datas.length} data(s)</span></div><div className="actions">{!forcarAberto&&<button className="btn small" onClick={()=>{setClienteAberto(null);setDataAberta(null);setBusca('')}}>Voltar aos clientes</button>}<button className="btn primary small" onClick={()=>setManual({...novaProd,clienteId:cg.clienteId})}>+ Nova produção</button></div></div>
            <div className="date-folder-grid">{cg.datas.map(g=>{
              const servicos=db.servicosSemen.filter(x=>x.clienteId===g.clienteId&&String(x.data||'').slice(0,10)===g.data)
              const chave=g.clienteId+'|'+g.data
              const dataOpen=forcarAberto?true:dataAberta===chave
              return <div className={`date-folder-card ${dataOpen?'is-open':''}`} key={chave}>
                <button className="date-folder-button" onClick={()=>{if(!forcarAberto)setDataAberta(dataOpen?null:chave)}}><span className="date-folder-icon">▰</span><span><strong>{g.data.split('-').reverse().join('/')}</strong><small>{g.itens.length} produção(ões) • {servicos.length} serviço(s)</small></span></button>
                {dataOpen&&<div className="date-folder-content"><div className="date-folder-head"><strong>Produção de {g.data.split('-').reverse().join('/')}</strong>{!forcarAberto&&<button className="btn small" onClick={()=>setDataAberta(null)}>Fechar data</button>}</div>
                <div className="table-wrap"><table><thead><tr><th>Doadora</th><th>Raça</th><th>Touro</th><th>Raça</th><th>Oócitos totais</th><th>Viáveis</th><th>Clivados</th><th>% Cliv.</th><th>Embriões D7</th><th>% Prod.</th><th>Fresco</th><th>Cong. DT</th><th>Cong. VT</th><th>Total cong.</th><th>Ações</th></tr></thead><tbody>
                {g.itens.map(p=>{const d=db.doadoras.find(x=>x.id===p.doadoraId);const rd=db.racas.find(x=>x.id===d?.racaId);const t=db.touros.find(x=>x.id===p.touroId);const rt=db.racas.find(x=>x.id===t?.racaId);const pctCliv=p.oocitosViaveis?Math.round((p.clivados/p.oocitosViaveis)*100)+'%':'0%';const pctProd=p.oocitosViaveis?Math.round((p.embriõesD7/p.oocitosViaveis)*100)+'%':'0%';const totalCong=n(p.congeladosDT)+n(p.congeladosVT);return <tr key={p.id}><td><strong>{d?.nome||'—'}</strong></td><td>{rd?.abreviatura||d?.raca||'—'}</td><td>{t?.nome||'—'}</td><td>{rt?.abreviatura||t?.raca||'—'}</td><td>{p.oocitos}</td><td>{p.oocitosViaveis}</td><td>{p.clivados}</td><td>{pctCliv}</td><td>{p.embriõesD7}</td><td>{pctProd}</td><td>{p.transferidosFresco}</td><td>{p.congeladosDT}</td><td>{p.congeladosVT}</td><td>{totalCong}</td><td><div className="actions production-row-actions"><button className="btn small order-btn" title="Mover para cima" onClick={()=>moverProducao(p,-1)}>↑</button><button className="btn small order-btn" title="Mover para baixo" onClick={()=>moverProducao(p,1)}>↓</button><button className="btn small" onClick={()=>setEdit({...p})}>Editar</button><button className="btn small" onClick={()=>setManual({...novaProd,data:p.data,clienteId:p.clienteId,doadoraId:p.doadoraId,origemAspiracaoId:p.origemAspiracaoId,ordem:proximaOrdem(p.clienteId,p.data)})}>Dividir</button><button className="btn small danger" onClick={()=>excluirProducao(p)}>Excluir</button></div></td></tr>})}
                </tbody><tfoot><tr><th>TOTAL</th><th>—</th><th>—</th><th>—</th><th>{g.itens.reduce((s,p)=>s+n(p.oocitos),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.oocitosViaveis),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.clivados),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.oocitosViaveis),0)?Math.round(g.itens.reduce((s,p)=>s+n(p.clivados),0)/g.itens.reduce((s,p)=>s+n(p.oocitosViaveis),0)*100)+'%':'0%'}</th><th>{g.itens.reduce((s,p)=>s+n(p.embriõesD7),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.oocitosViaveis),0)?Math.round(g.itens.reduce((s,p)=>s+n(p.embriõesD7),0)/g.itens.reduce((s,p)=>s+n(p.oocitosViaveis),0)*100)+'%':'0%'}</th><th>{g.itens.reduce((s,p)=>s+n(p.transferidosFresco),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.congeladosDT),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.congeladosVT),0)}</th><th>{g.itens.reduce((s,p)=>s+n(p.congeladosDT)+n(p.congeladosVT),0)}</th><th>—</th></tr></tfoot></table></div>
                <section className="service-box"><div className="service-head"><strong>Sêmen utilizado no serviço</strong><button className="btn small" onClick={()=>abrirServico(g.clienteId,g.data)}>Registrar doses do serviço</button></div>{servicos.length?<div className="table-wrap service-table"><table><thead><tr><th>Touro</th><th>Raça</th><th>Partida</th><th>Doses</th><th>Ações</th></tr></thead><tbody>{servicos.map(ss=>{const t=db.touros.find(x=>x.id===ss.touroId);const r=db.racas.find(x=>x.id===t?.racaId);return <tr key={ss.id}><td><strong>{t?.nome||'—'}</strong></td><td>{r?.abreviatura||t?.raca||'—'}</td><td>{ss.partida||'—'}</td><td>{Number(ss.doses).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})}</td><td><div className="actions"><button className="btn small" onClick={()=>abrirServico(g.clienteId,g.data,ss)}>Editar</button><button className="btn small danger" onClick={()=>excluirServico(ss)}>Excluir</button></div></td></tr>})}</tbody></table></div>:<div className="service-empty">Nenhum sêmen registrado para este serviço.</div>}</section>
                </div>}
              </div>
            })}</div>
          </div>}
        </div>
      })}
      {!clientesGrupos.length&&<div className="note-box">Nenhuma produção cadastrada. Você pode criar uma Nova Produção ou salvar uma Aspiração.</div>}
    </div>

    {manual&&<Modal title={manual.id?'Editar produção manual':'Nova produção'} onClose={()=>setManual(null)}>
      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Data final da produção (D7)"><input type="date" value={manual.data} onChange={e=>setManual({...manual,data:e.target.value})}/></Field>

        <Field label="Cliente"><SearchableSelect value={manual.clienteId} onChange={v=>setManual({...manual,clienteId:v,doadoraId:'',touroId:''})} options={db.clientes.map(c=>({value:c.id,label:c.nome,search:[c.propriedade,c.municipio,c.cpf].join(' ')}))} placeholder="Digite o nome do cliente"/></Field>

        <Field label="Doadora"><SearchableSelect value={manual.doadoraId} onChange={v=>setManual({...manual,doadoraId:v})} options={doadorasClienteManual.map(d=>({value:d.id,label:d.nome,search:[d.registro,d.raca].join(' ')}))} placeholder="Digite o número/nome da doadora"/></Field>

        <Field label="Oócitos totais"><input type="number" min="0" value={manual.oocitos} onChange={e=>setManual({...manual,oocitos:n(e.target.value)})}/></Field>
        <Field label="Oócitos viáveis"><input type="number" min="0" value={manual.oocitosViaveis} onChange={e=>setManual({...manual,oocitosViaveis:n(e.target.value)})}/></Field>
        <Field label="Desnudos / não viáveis"><input value={Math.max(0,n(manual.oocitos)-n(manual.oocitosViaveis))} readOnly /></Field>

        <Field label="Touro"><SearchableSelect value={manual.touroId||''} onChange={v=>setManual({...manual,touroId:v})} options={tourosClienteManual.map(t=>({value:t.id,label:t.nome,search:[t.registro,t.codigo,t.tipoSemen].join(' ')}))} placeholder="Digite o nome do touro"/></Field>

        <Field label="Clivados"><input type="number" min="0" value={manual.clivados} onChange={e=>setManual({...manual,clivados:n(e.target.value)})}/></Field>
        <Field label="Embriões D7"><input type="number" min="0" value={manual.embriõesD7} onChange={e=>setManual({...manual,embriõesD7:n(e.target.value)})}/></Field>
        <Field label="Fresco"><input type="number" min="0" value={manual.transferidosFresco} onChange={e=>setManual({...manual,transferidosFresco:n(e.target.value)})}/></Field>
        <Field label="Congelados DT"><input type="number" min="0" value={manual.congeladosDT} onChange={e=>setManual({...manual,congeladosDT:n(e.target.value)})}/></Field>
        <Field label="Congelados VT"><input type="number" min="0" value={manual.congeladosVT} onChange={e=>setManual({...manual,congeladosVT:n(e.target.value)})}/></Field>
        {camposOPS(manual,setManual)}
        <Field label="Observações"><input value={manual.obs||''} onChange={e=>setManual({...manual,obs:e.target.value})}/></Field>
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={()=>setManual(null)}>Cancelar</button>
        <button className="btn" onClick={()=>salvarManual(manual,true)}>Salvar e dividir doadora</button>
        <button className="btn primary" data-enter-final="true" onClick={()=>salvarManual(manual)}>Salvar produção</button>
      </div>
    </Modal>}

    {edit&&<Modal title="Completar / editar produção" onClose={()=>setEdit(null)}>
      <div className="readonly-box">
        <span><b>Cliente:</b> {db.clientes.find(c=>c.id===edit.clienteId)?.nome}</span>
        <span><b>Doadora:</b> {db.doadoras.find(d=>d.id===edit.doadoraId)?.nome}</span>
        <span><b>Data final D7:</b> {edit.data.split('-').reverse().join('/')}</span>
        <span><b>Oócitos:</b> {edit.oocitos}</span>
        <span><b>Viáveis:</b> {edit.oocitosViaveis}</span>
      </div>

      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Data final da produção (D7)"><input type="date" value={edit.data} onChange={e=>setEdit({...edit,data:e.target.value})}/></Field>
        <Field label="Oócitos após descarte (editável)"><input type="number" min="0" value={edit.oocitos} onChange={e=>setEdit({...edit,oocitos:n(e.target.value)})}/></Field>
        <Field label="Viáveis após descarte (editável)"><input type="number" min="0" value={edit.oocitosViaveis} onChange={e=>setEdit({...edit,oocitosViaveis:n(e.target.value)})}/></Field>
        <Field label="Desnudos / não viáveis"><input value={Math.max(0,n(edit.oocitos)-n(edit.oocitosViaveis))} readOnly /></Field>
        <Field label="Touro"><SearchableSelect value={edit.touroId||''} onChange={v=>setEdit({...edit,touroId:v})} options={tourosClienteEdit.map(t=>({value:t.id,label:t.nome,search:[t.registro,t.codigo,t.tipoSemen].join(' ')}))} placeholder="Digite o nome do touro"/></Field>

        <Field label="Clivados"><input type="number" min="0" value={edit.clivados} onChange={e=>setEdit({...edit,clivados:n(e.target.value)})}/></Field>
        <Field label="Embriões D7"><input type="number" min="0" value={edit.embriõesD7} onChange={e=>setEdit({...edit,embriõesD7:n(e.target.value)})}/></Field>
        <Field label="Embriões a fresco"><input type="number" min="0" value={edit.transferidosFresco} onChange={e=>setEdit({...edit,transferidosFresco:n(e.target.value)})}/></Field>
        <Field label="Congelados DT"><input type="number" min="0" value={edit.congeladosDT} onChange={e=>setEdit({...edit,congeladosDT:n(e.target.value)})}/></Field>
        <Field label="Congelados VT"><input type="number" min="0" value={edit.congeladosVT} onChange={e=>setEdit({...edit,congeladosVT:n(e.target.value)})}/></Field>
        {camposOPS(edit,setEdit)}
        <Field label="Observações"><input value={edit.obs||''} onChange={e=>setEdit({...edit,obs:e.target.value})}/></Field>
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={()=>setEdit(null)}>Cancelar</button>
        <button className="btn primary" data-enter-final="true" onClick={()=>salvarEdicao(edit)}>Salvar produção</button>
      </div>
    </Modal>}

    {servico&&<Modal title={servico.id?'Editar sêmen do serviço':'Registrar doses do serviço'} onClose={()=>setServico(null)}>
      <div className="readonly-box">
        <span><b>Cliente:</b> {db.clientes.find(c=>c.id===servico.clienteId)?.nome}</span>
        <span><b>Data:</b> {servico.data.split('-').reverse().join('/')}</span>
      </div>

      <div className="form-grid" onKeyDown={handleEnterFlow}>
        <Field label="Touro">
          <select value={servico.touroId} onChange={e=>setServico({...servico,touroId:e.target.value,partida:''})}>
            <option value="">Selecione...</option>
            {tourosClienteServico.map(t=><option key={t.id} value={t.id}>{t.nome} — {t.tipoSemen||'Convencional'}</option>)}
          </select>
        </Field>

        <Field label="Partida / lote">
          <input
            list="partidas-semen-servico"
            placeholder="Digite ou selecione a partida"
            value={servico.partida||''}
            onChange={e=>setServico({...servico,partida:e.target.value})}
          />
          <datalist id="partidas-semen-servico">
            {partidasServico.map(p=><option key={p} value={p}/>)}
          </datalist>
        </Field>

        <Field label="Doses utilizadas">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={String(servico.doses).replace('.',',')}
            onChange={e=>setServico({...servico,doses:e.target.value as any})}
          />
        </Field>

        <Field label="Observações">
          <input value={servico.obs||''} onChange={e=>setServico({...servico,obs:e.target.value})}/>
        </Field>
      </div>

      <div className="hint-box">
        Ao salvar, o touro será aplicado automaticamente às produções desta data que ainda estiverem sem touro.
      </div>

      <div className="modal-actions">
        <button className="btn" onClick={()=>setServico(null)}>Cancelar</button>
        <button className="btn primary" data-enter-final="true" onClick={()=>salvarServico({...servico,doses:n(servico.doses)})}>Salvar doses do serviço</button>
      </div>
    </Modal>}
  </section>
}

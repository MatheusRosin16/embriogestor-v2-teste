import type { BancoEmbrioGestor, PerfilAcesso } from '../types/domain'

const pct=(a:number,b:number)=>b?`${(a/b*100).toFixed(1)}%`:'0,0%'
const fmtData=(v?:string)=>{
  if(!v)return '—'
  const [a,m,d]=v.split('-')
  return a&&m&&d?`${d}/${m}/${a}`:v
}

export function PortalCliente({db,perfil}:{db:BancoEmbrioGestor;perfil:PerfilAcesso}){
  const cid=perfil.cliente_id||''
  const cli=db.clientes.find(c=>c.id===cid)
  const doadoras=db.doadoras.filter(x=>x.clienteId===cid).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
  const prods=db.producoes.filter(x=>x.clienteId===cid).sort((a,b)=>b.data.localeCompare(a.data))
  const transf=db.transferencias.filter(x=>x.clienteId===cid).sort((a,b)=>b.data.localeCompare(a.data))
  const estEmb=db.estoqueEmbrioes.filter(x=>x.clienteId===cid)
  const estSemen=db.estoque.filter(x=>x.clienteId===cid)

  const viaveis=prods.reduce((s,x)=>s+(Number(x.oocitosViaveis)||0),0)
  const d7=prods.reduce((s,x)=>s+(Number(x.embriõesD7)||0),0)
  const prenhes=transf.filter(x=>String(x.diagnostico).toLowerCase()==='positiva').length
  const dg=transf.filter(x=>x.diagnostico&&x.diagnostico!=='Pendente').length
  const saldoSemen=estSemen.reduce((s,x)=>s+(Number(x.saldo)||0),0)
  const saldoEmb=estEmb.reduce((s,x)=>s+(Number(x.quantidade)||0),0)

  const nomeD=(id:string)=>db.doadoras.find(x=>x.id===id)?.nome||'—'
  const touro=(id?:string)=>db.touros.find(x=>x.id===id)
  const nomeT=(id?:string)=>touro(id)?.nome||'—'
  const racaT=(id?:string)=>touro(id)?.raca||db.racas.find(r=>r.id===touro(id)?.racaId)?.abreviatura||'—'
  const tipoT=(id?:string)=>touro(id)?.tipoSemen||'—'

  if(!cid)return <section>
    <div className="page-title-block"><h2>Portal do Cliente</h2><p>Conta sem cliente vinculado.</p></div>
    <div className="panel"><div className="note-box">O Administrador precisa vincular esta conta a um cliente em “Usuários & Acessos”.</div></div>
  </section>

  return <section>
    <div className="page-title-block">
      <h2>Portal do Cliente</h2>
      <p>{cli?.nome||perfil.nome||perfil.email} — consulta dos seus animais, resultados e estoques.</p>
    </div>

    <div className="client-kpis">
      <div><span>Doadoras</span><strong>{doadoras.length}</strong></div>
      <div><span>Oócitos viáveis</span><strong>{viaveis}</strong></div>
      <div><span>Embriões D7</span><strong>{d7}</strong><small>{pct(d7,viaveis)} de produção</small></div>
      <div><span>Transferências</span><strong>{transf.length}</strong></div>
      <div><span>Taxa de prenhez</span><strong>{pct(prenhes,dg)}</strong><small>{prenhes}/{dg} DG</small></div>
      <div><span>Embriões em estoque</span><strong>{saldoEmb}</strong></div>
      <div><span>Doses de sêmen em estoque</span><strong>{saldoSemen}</strong></div>
    </div>

    <div className="panel">
      <div className="panel-head"><div><h3>Minhas doadoras</h3><p>Animais vinculados à sua conta.</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Doadora</th><th>Registro</th><th>Raça</th><th>Categoria</th><th>Status</th></tr></thead>
        <tbody>{doadoras.length?doadoras.map(d=><tr key={d.id}>
          <td><strong>{d.nome}</strong></td><td>{d.registro||'—'}</td><td>{d.raca||db.racas.find(r=>r.id===d.racaId)?.abreviatura||'—'}</td><td>{d.categoria||'—'}</td><td>{d.status||'—'}</td>
        </tr>):<tr><td colSpan={5}>Nenhuma doadora cadastrada.</td></tr>}</tbody>
      </table></div>
    </div>

    <div className="panel">
      <div className="panel-head"><div><h3>Meu estoque de sêmen</h3><p>Somente doses pertencentes ao seu cadastro. Consulta somente leitura.</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Touro</th><th>Raça</th><th>Tipo de sêmen</th><th>Partida</th><th>Entradas</th><th>Usadas</th><th>Saldo</th><th>Localização</th></tr></thead>
        <tbody>{estSemen.length?estSemen.map(x=><tr key={x.id}>
          <td><strong>{nomeT(x.touroId)}</strong></td>
          <td>{racaT(x.touroId)}</td>
          <td>{tipoT(x.touroId)}</td>
          <td>{x.partida||'—'}</td>
          <td>{Number(x.quantidade)||0}</td>
          <td>{Number(x.usadas)||0}</td>
          <td><strong>{Number(x.saldo)||0}</strong></td>
          <td>{[x.recipienteTipo,x.recipiente].filter(Boolean).join(' • ')||'—'}</td>
        </tr>):<tr><td colSpan={8}>Nenhuma dose de sêmen em estoque.</td></tr>}</tbody>
      </table></div>
    </div>

    <div className="panel">
      <div className="panel-head"><div><h3>Meu estoque de embriões</h3><p>Embriões DT e VT atualmente disponíveis.</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Data</th><th>Doadora</th><th>Touro</th><th>Tipo</th><th>Quantidade</th><th>Botijão</th><th>Caneca</th><th>Raque</th><th>Posição</th></tr></thead>
        <tbody>{estEmb.length?estEmb.map(x=><tr key={x.id}>
          <td>{fmtData(x.data)}</td><td>{nomeD(x.doadoraId)}</td><td>{nomeT(x.touroId)}</td><td>{x.tipo}</td><td><strong>{x.quantidade}</strong></td><td>{x.botijao||'—'}</td><td>{x.caneca||'—'}</td><td>{x.raque||'—'}</td><td>{x.posicao||'—'}</td>
        </tr>):<tr><td colSpan={9}>Nenhum embrião em estoque.</td></tr>}</tbody>
      </table></div>
    </div>

    <div className="panel"><div className="panel-head"><div><h3>Minhas produções</h3><p>Consulta somente leitura.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Doadora</th><th>Touro</th><th>Viáveis</th><th>D7</th><th>% Prod.</th><th>Fresco</th><th>DT</th><th>VT</th></tr></thead>
      <tbody>{prods.length?prods.slice(0,100).map(p=><tr key={p.id}><td>{fmtData(p.data)}</td><td>{nomeD(p.doadoraId)}</td><td>{nomeT(p.touroId)}</td><td>{p.oocitosViaveis}</td><td>{p.embriõesD7}</td><td>{pct(p.embriõesD7,p.oocitosViaveis)}</td><td>{p.transferidosFresco}</td><td>{p.congeladosDT}</td><td>{p.congeladosVT}</td></tr>):<tr><td colSpan={9}>Nenhuma produção cadastrada.</td></tr>}</tbody></table></div>
    </div>

    <div className="panel"><div className="panel-head"><div><h3>Minhas transferências</h3><p>Consulta somente leitura.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Doadora</th><th>Touro</th><th>Receptora</th><th>Estágio</th><th>Grau</th><th>Embrião</th><th>Diagnóstico</th></tr></thead>
      <tbody>{transf.length?transf.slice(0,100).map(t=><tr key={t.id}><td>{fmtData(t.data)}</td><td>{nomeD(t.doadoraId)}</td><td>{nomeT(t.touroId)}</td><td>{t.receptora||'—'}</td><td>{t.embriãoEstagio||'—'}</td><td>{t.embriãoGrau||'—'}</td><td>{t.destino||'—'}</td><td>{t.diagnostico||'Pendente'}</td></tr>):<tr><td colSpan={8}>Nenhuma transferência cadastrada.</td></tr>}</tbody></table></div>
    </div>
  </section>
}

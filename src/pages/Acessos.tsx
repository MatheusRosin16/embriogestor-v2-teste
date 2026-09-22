import { useEffect,useState } from 'react'
import type { BancoEmbrioGestor, NivelAcesso, PerfilAcesso } from '../types/domain'
import { listProfiles,updateProfile } from '../services/supabaseCloud'

const label:Record<NivelAcesso,string>={ADMIN:'Administrador',VETERINARIO:'Veterinário',CLIENTE:'Cliente'}

export function Acessos({db}:{db:BancoEmbrioGestor}){
  const[lista,setLista]=useState<PerfilAcesso[]>([])
  const[msg,setMsg]=useState('')
  async function carregar(){try{setLista(await listProfiles())}catch(e:any){setMsg(e?.message||'Falha ao carregar usuários.')}}
  useEffect(()=>{carregar()},[])

  async function alterar(p:PerfilAcesso,patch:Partial<PerfilAcesso>){
    try{
      const role=(patch.role||p.role) as NivelAcesso
      const profId=patch.profissional_id===undefined?p.profissional_id:patch.profissional_id
      if(role==='VETERINARIO'&&patch.ativo===true&&!profId)throw new Error('Selecione primeiro o profissional que será vinculado a este veterinário.')
      await updateProfile(p.user_id,{
        role,
        cliente_id:patch.cliente_id===undefined?p.cliente_id:patch.cliente_id,
        profissional_id:patch.profissional_id===undefined?p.profissional_id:patch.profissional_id,
        ativo:patch.ativo===undefined?p.ativo:patch.ativo,
        nome:patch.nome===undefined?p.nome:patch.nome
      })
      setMsg('Acesso atualizado.')
      await carregar()
    }catch(e:any){setMsg(e?.message||'Falha ao atualizar acesso.')}
  }

  return <section>
    <div className="page-title-block"><h2>Usuários & Níveis de Acesso</h2><p>Administrador, Veterinário e Cliente com permissões diferentes.</p></div>
    <div className="panel">
      <div className="panel-head"><div><h3>Perfis cadastrados</h3><p>Novos usuários solicitam acesso na tela inicial e aparecem aqui para aprovação.</p></div><button className="btn" onClick={carregar}>Atualizar</button></div>
      {msg&&<div className="note-box">{msg}</div>}
      <div className="access-role-summary">
        <div><strong>Administrador</strong><span>Acesso completo, gestão econômica, MAPA, backups e usuários.</span></div>
        <div><strong>Veterinário</strong><span>Cadastros e rotina técnica: OPU, produção, estoques, transferências e relatórios.</span></div>
        <div><strong>Cliente</strong><span>Somente leitura dos próprios animais, produções, transferências e estoque de embriões.</span></div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Usuário</th><th>Solicitado</th><th>Nível liberado</th><th>Cliente vinculado</th><th>Profissional vinculado</th><th>Status</th></tr></thead>
        <tbody>{lista.map(p=><tr key={p.user_id}>
          <td><strong>{p.nome||p.email}</strong><small style={{display:'block'}}>{p.email}</small></td>
          <td><span className="requested-role">{p.requested_role?label[p.requested_role]:'—'}</span></td>
          <td><select value={p.role} disabled={p.role==='ADMIN'} onChange={e=>alterar(p,{role:e.target.value as NivelAcesso,cliente_id:e.target.value==='CLIENTE'?p.cliente_id:null,profissional_id:e.target.value==='VETERINARIO'?p.profissional_id:null})}>
            {Object.entries(label).map(([v,n])=><option key={v} value={v}>{n}</option>)}
          </select></td>
          <td>{p.role==='CLIENTE'?<select value={p.cliente_id||''} onChange={e=>alterar(p,{cliente_id:e.target.value||null})}>
            <option value="">Selecione o cliente</option>{[...db.clientes].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>:<span>Todos os clientes</span>}</td>
          <td>{p.role==='VETERINARIO'?<select value={p.profissional_id||''} onChange={e=>alterar(p,{profissional_id:e.target.value||null})}>
            <option value="">Selecione o profissional</option>{[...db.profissionais].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(prof=><option key={prof.id} value={prof.id}>{prof.nome}{prof.crmv?` — ${prof.crmv}`:''} • {(prof.clienteIds||[]).length} cliente(s)</option>)}
          </select>:<span>—</span>}</td>
          <td>{p.role==='VETERINARIO'&&p.profissional_id&&<small style={{display:'block',marginBottom:4}}>{(db.profissionais.find(x=>x.id===p.profissional_id)?.clienteIds||[]).length} cliente(s) liberado(s)</small>}<button className={`btn small ${p.ativo?'':'primary'}`} disabled={p.role==='ADMIN'} onClick={()=>alterar(p,{ativo:!p.ativo})}>{p.ativo?'Ativo':'Liberar acesso'}</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </section>
}

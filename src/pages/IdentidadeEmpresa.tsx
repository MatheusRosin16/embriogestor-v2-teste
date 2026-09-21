import { useState } from 'react'
import { saveSharedCompanyIdentity } from '../services/supabaseCloud'
import type { BancoEmbrioGestor, IdentidadeEmpresa } from '../types/domain'

const padrao:IdentidadeEmpresa={
  nome:'SÊMINNA – Laboratório de Reprodução Animal',
  nomeFantasia:'SÊMINNA',
  cnpj:'',
  telefone:'',
  email:'',
  endereco:'AV. General Osório, 797, sala 01, Francisco Beltrão - PR',
  logoDataUrl:''
}

export function IdentidadeEmpresaPage({db,onChange}:{db:BancoEmbrioGestor;onChange:(db:BancoEmbrioGestor)=>void}){
  const[form,setForm]=useState<IdentidadeEmpresa>({...padrao,...(db.identidadeEmpresa||{})})
  const[msg,setMsg]=useState('')

  function campo<K extends keyof IdentidadeEmpresa>(k:K,v:IdentidadeEmpresa[K]){
    setForm(f=>({...f,[k]:v}))
    setMsg('')
  }
  function logo(file?:File){
    if(!file)return
    if(!file.type.startsWith('image/')){setMsg('Selecione uma imagem PNG, JPG, WEBP ou SVG.');return}
    if(file.size>2*1024*1024){setMsg('A logo deve ter no máximo 2 MB.');return}
    const r=new FileReader()
    r.onload=()=>campo('logoDataUrl',String(r.result||''))
    r.readAsDataURL(file)
  }
  async function salvar(){
    const nome=form.nome.trim()
    if(!nome){setMsg('Informe o nome da empresa/laboratório.');return}
    const identidade={...form,nome,nomeFantasia:(form.nomeFantasia||'').trim()}
    const localAtualizado={...db,identidadeEmpresa:identidade}
    onChange(localAtualizado)
    localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(identidade))
    setForm(identidade)
    setMsg('Salvando identidade na nuvem…')
    try{
      await saveSharedCompanyIdentity(identidade,localAtualizado)
      setMsg('Identidade salva e compartilhada na nuvem. Veterinários e clientes receberão a mesma logo.')
    }catch(e:any){
      setMsg(`Identidade salva neste aparelho, mas não foi possível enviar a logo à nuvem: ${e?.message||'erro de sincronização'}`)
    }
  }
  function restaurar(){
    if(!confirm('Restaurar os dados institucionais padrão da SÊMINNA?'))return
    setForm({...padrao})
    onChange({...db,identidadeEmpresa:{...padrao}})
    localStorage.setItem('embriogestor2_identidade_publica',JSON.stringify(padrao))
    setMsg('Identidade padrão restaurada.')
  }

  return <section className="company-settings">
    <div className="panel">
      <div className="panel-head"><div><h2>Identidade da Empresa</h2><p>Personalize o EmbrioGestor para a empresa ou laboratório que utiliza o sistema.</p></div></div>
      <div className="company-layout">
        <div className="company-logo-card">
          <div className="company-logo-preview">
            {form.logoDataUrl?<img src={form.logoDataUrl} alt="Logo da empresa"/>:<div className="company-logo-placeholder">LOGO</div>}
          </div>
          <label className="btn primary company-upload">Carregar logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>logo(e.target.files?.[0])}/></label>
          {form.logoDataUrl&&<button className="btn" onClick={()=>campo('logoDataUrl','')}>Remover logo</button>}
          <small>PNG, JPG, WEBP ou SVG. Máximo 2 MB.</small>
        </div>
        <div className="company-form">
          <label><span>Nome da empresa / laboratório *</span><input value={form.nome} onChange={e=>campo('nome',e.target.value)} placeholder="Ex.: Laboratório XYZ Reprodução Animal"/></label>
          <label><span>Nome fantasia</span><input value={form.nomeFantasia||''} onChange={e=>campo('nomeFantasia',e.target.value)} placeholder="Ex.: XYZ Embriões"/></label>
          <label><span>CNPJ</span><input value={form.cnpj||''} onChange={e=>campo('cnpj',e.target.value)} placeholder="00.000.000/0000-00"/></label>
          <label><span>Telefone / WhatsApp</span><input value={form.telefone||''} onChange={e=>campo('telefone',e.target.value)} placeholder="(00) 00000-0000"/></label>
          <label><span>E-mail</span><input type="email" value={form.email||''} onChange={e=>campo('email',e.target.value)} placeholder="contato@empresa.com.br"/></label>
          <label className="company-address"><span>Endereço</span><input value={form.endereco||''} onChange={e=>campo('endereco',e.target.value)} placeholder="Rua, número, cidade - UF"/></label>
        </div>
      </div>
      {msg&&<div className="message">{msg}</div>}
      <div className="company-actions"><button className="btn" onClick={restaurar}>Restaurar padrão</button><button className="btn primary" onClick={salvar}>Salvar identidade</button></div>
      <div className="note-box"><b>EmbrioGestor</b> continua sendo o nome do software. A identidade acima representa a empresa que utiliza/aluga o sistema e aparece no menu e nos relatórios.</div>
    </div>
  </section>
}

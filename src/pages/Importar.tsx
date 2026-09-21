import { useState } from 'react'
import { importarBackup } from '../services/importLegacy'
import type { BancoEmbrioGestor } from '../types/domain'

export function Importar({
  onImportar
}:{
  onImportar:(db:BancoEmbrioGestor)=>void
}) {
  const [mensagem,setMensagem] = useState('')

  async function carregar(file?:File) {
    if(!file) return

    try {
      const db = await importarBackup(file)
      onImportar(db)

      setMensagem(
        `Importado: ${db.clientes.length} clientes, `+
        `${db.doadoras.length} doadoras, `+
        `${db.aspiracoes.length} OPUs e `+
        `${db.producoes.length} produções.`
      )
    } catch {
      setMensagem('Não foi possível importar este JSON.')
    }
  }

  return (
    <section className="panel">
      <h2>Importar EmbrioGestor atual</h2>
      <p>Selecione um backup JSON do sistema atual para testar os dados nesta nova versão.</p>

      <label className="upload-box">
        <input
          type="file"
          accept=".json,application/json"
          onChange={e=>carregar(e.target.files?.[0])}
        />
        <strong>Selecionar backup JSON</strong>
        <span>Clique aqui para escolher o arquivo.</span>
      </label>

      {mensagem && <div className="message">{mensagem}</div>}
    </section>
  )
}

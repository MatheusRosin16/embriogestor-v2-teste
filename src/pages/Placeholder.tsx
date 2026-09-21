export function Placeholder({
  titulo,
  descricao
}:{
  titulo:string
  descricao:string
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{titulo}</h2>
          <p>{descricao}</p>
        </div>
        <span className="pill pending">EM MIGRAÇÃO</span>
      </div>

      <div className="placeholder">
        <strong>Módulo preparado na nova estrutura.</strong>
        <p>As funções do EmbrioGestor atual serão migradas para esta área sem apagar a versão oficial.</p>
      </div>
    </section>
  )
}

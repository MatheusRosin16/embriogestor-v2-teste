import { useMemo } from 'react'
import type { BancoEmbrioGestor, Producao } from '../types/domain'
import type { PageId } from '../components/Sidebar'

function numero(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function percentual(n: number, d: number) {
  return d > 0 ? `${(n / d * 100).toFixed(1).replace('.', ',')}%` : '0,0%'
}

function anoDaData(data?: string) {
  return String(data || '').slice(0, 4)
}

function mesDaData(data?: string) {
  return String(data || '').slice(5, 7)
}

function dataBR(data?: string) {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function chaveServico(clienteId?: string, data?: string) {
  return `${clienteId || 'sem-cliente'}|${String(data || '').slice(0, 10)}`
}

const MESES = [
  { valor: '01', nome: 'Jan' }, { valor: '02', nome: 'Fev' },
  { valor: '03', nome: 'Mar' }, { valor: '04', nome: 'Abr' },
  { valor: '05', nome: 'Mai' }, { valor: '06', nome: 'Jun' },
  { valor: '07', nome: 'Jul' }, { valor: '08', nome: 'Ago' },
  { valor: '09', nome: 'Set' }, { valor: '10', nome: 'Out' },
  { valor: '11', nome: 'Nov' }, { valor: '12', nome: 'Dez' },
]

export type Periodo = 'ANO' | 'MES' | 'TODOS'

export type DashboardFilterState = {
  periodoRascunho: Periodo
  anoRascunho: string
  mesRascunho: string
  profissionalRascunho: string
  filtro: { periodo: Periodo; ano: string; mes: string; profissionalId: string }
}

type GrupoProducao = {
  chave: string
  data: string
  clienteId: string
  doadoras: Set<string>
  embrioesD7: number
  dt: number
  vt: number
}

function MiniChart({ valores, onMesClick }: { valores: number[]; onMesClick?: (mes: string) => void }) {
  const width = 960
  const height = 260
  const padX = 46
  const padTop = 20
  const padBottom = 44
  const max = Math.max(1, ...valores)
  const usableH = height - padTop - padBottom
  const stepX = (width - padX * 2) / 11
  const pontos = valores.map((v, i) => ({
    x: padX + i * stepX,
    y: padTop + usableH - (v / max) * usableH,
    v,
  }))
  const path = pontos.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')

  const linhas = [0, .25, .5, .75, 1].map(f => ({
    y: padTop + usableH - f * usableH,
    valor: Math.round(max * f),
  }))

  return (
    <div className="dashboard-chart-scroll" aria-label="Produções por mês">
      <svg className="dashboard-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        {linhas.map((l, i) => (
          <g key={i}>
            <line x1={padX} y1={l.y} x2={width - padX} y2={l.y} className="dashboard-chart-grid" />
            <text x={padX - 10} y={l.y + 5} textAnchor="end" className="dashboard-chart-axis">{l.valor}</text>
          </g>
        ))}
        <path d={path} className="dashboard-chart-line" />
        {pontos.map((p, i) => (
          <g key={i} className="dashboard-chart-point" onClick={() => onMesClick?.(MESES[i].valor)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onMesClick?.(MESES[i].valor) }}>
            <circle cx={p.x} cy={p.y} r="5.5" className="dashboard-chart-dot" />
            {p.v > 0 && <text x={p.x} y={p.y - 12} textAnchor="middle" className="dashboard-chart-value">{p.v}</text>}
            <text x={p.x} y={height - 15} textAnchor="middle" className="dashboard-chart-month">{MESES[i].nome}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function Dashboard({ db, onNavigate, onOpenProduction, onOpenMonth, filterState, onFilterStateChange }: { db: BancoEmbrioGestor; onNavigate: (page: PageId) => void; onOpenProduction: (clienteId: string, data: string) => void; onOpenMonth: (ano: string, mes: string) => void; filterState: DashboardFilterState; onFilterStateChange: (state: DashboardFilterState) => void }) {
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>()
    ;[...db.aspiracoes, ...db.producoes, ...db.transferencias].forEach(item => {
      const ano = anoDaData(item.data)
      if (/^\d{4}$/.test(ano)) anos.add(ano)
    })
    if (!anos.size) anos.add(String(new Date().getFullYear()))
    return Array.from(anos).sort((a, b) => Number(b) - Number(a))
  }, [db])

  const periodoRascunho = filterState.periodoRascunho
  const anoRascunho = filterState.anoRascunho || anosDisponiveis[0]
  const mesRascunho = filterState.mesRascunho
  const profissionalRascunho = filterState.profissionalRascunho || 'TODOS'
  const filtro = {
    ...filterState.filtro,
    ano: filterState.filtro.ano || anosDisponiveis[0],
    profissionalId: filterState.filtro.profissionalId || 'TODOS',
  }
  const profissionalSelecionado=db.profissionais.find(p=>p.id===filtro.profissionalId)
  const clientesProfissional=new Set(profissionalSelecionado?.clienteIds||[])
  const dentroProfissional=(clienteId?:string)=>filtro.profissionalId==='TODOS'||clientesProfissional.has(clienteId||'')

  const atualizarFiltroState = (patch: Partial<DashboardFilterState>) => {
    onFilterStateChange({ ...filterState, ...patch })
  }

  const dentroPeriodo = (data?: string) => {
    if (filtro.periodo === 'TODOS') return true
    if (anoDaData(data) !== filtro.ano) return false
    if (filtro.periodo === 'MES' && mesDaData(data) !== filtro.mes) return false
    return true
  }

  const aspiracoes = db.aspiracoes.filter(a => dentroPeriodo(a.data) && dentroProfissional(a.clienteId))
  const producoes = db.producoes.filter(p => dentroPeriodo(p.data) && dentroProfissional(p.clienteId))
  const transferencias = db.transferencias.filter(t => dentroPeriodo(t.data) && dentroProfissional(t.clienteId))

  // REGRA CENTRAL: 1 OPU/produção de serviço = 1 cliente + 1 data.
  // Várias doadoras do mesmo cliente no mesmo dia continuam contando como apenas 1 OPU.
  const chavesOPU = new Set<string>()
  aspiracoes.forEach(a => chavesOPU.add(chaveServico(a.clienteId, a.data)))
  producoes.forEach(p => chavesOPU.add(chaveServico(p.clienteId, p.data)))
  const totalOPU = chavesOPU.size

  // Oócitos têm como fonte oficial a Aspiração/OPU, não a Produção.
  // Isso evita duplicações ou números desatualizados em produções manuais/legadas.
  const oocitosViaveis = aspiracoes.reduce((s, a) => s + (a.geradaPelaProducao ? numero(a.oocitosViaveisInformados) : numero(a.grau1) + numero(a.grau2) + numero(a.grau3)), 0)
  const oocitosTotais = aspiracoes.reduce((s, a) => s + (a.geradaPelaProducao ? numero(a.oocitosTotaisInformados) : numero(a.grau1) + numero(a.grau2) + numero(a.grau3) + numero(a.grau4)), 0)
  const embrioesD7 = producoes.reduce((s, p) => s + numero(p.embriõesD7), 0)
  const fresco = producoes.reduce((s, p) => s + numero(p.transferidosFresco), 0)

  // Congelados são SOMENTE os campos de produção DT e VT.
  // Estoque de sêmen e transferências não entram neste cálculo.
  const congeladosDT = producoes.reduce((s, p) => s + numero(p.congeladosDT), 0)
  const congeladosVT = producoes.reduce((s, p) => s + numero(p.congeladosVT), 0)
  const congeladosTotal = congeladosDT + congeladosVT

  // Saldo atual do estoque de embriões. Este número NÃO usa o filtro de período:
  // representa o que está fisicamente disponível agora no estoque do laboratório.
  const estoqueAtualDT = db.estoqueEmbrioes
    .filter(item => item.tipo === 'DT' && dentroProfissional(item.clienteId))
    .reduce((s, item) => s + numero(item.quantidade), 0)
  const estoqueAtualVT = db.estoqueEmbrioes
    .filter(item => item.tipo === 'VT' && dentroProfissional(item.clienteId))
    .reduce((s, item) => s + numero(item.quantidade), 0)
  const estoqueAtualTotal = estoqueAtualDT + estoqueAtualVT

  const cards: Array<{ nome: string; valor: number | string; obs?: string; destino: PageId }> = [
    { nome: 'OPUs / Produções', valor: totalOPU, obs: '1 cliente + 1 data = 1 OPU', destino: 'aspiracoes' },
    { nome: 'Oócitos coletados (viáveis)', valor: oocitosViaveis, destino: 'aspiracoes' },
    { nome: 'Oócitos coletados totais', valor: oocitosTotais, destino: 'aspiracoes' },
    { nome: 'Embriões D7', valor: embrioesD7, destino: 'producoes' },
    { nome: 'Transferidos a fresco', valor: fresco, destino: 'transferencias' },
    { nome: 'Congelados DT', valor: congeladosDT, obs: 'Produzidos no período', destino: 'estoqueEmbrioes' },
    { nome: 'Congelados VT', valor: congeladosVT, obs: 'Produzidos no período', destino: 'estoqueEmbrioes' },
    { nome: 'Transferências', valor: transferencias.length, destino: 'transferencias' },
  ]

  const resumo: Array<{ nome: string; valor: number | string; obs: string; destino: PageId }> = [
    { nome: 'Total de embriões frescos', valor: fresco, obs: 'Transferidos a fresco no período', destino: 'transferencias' },
    { nome: 'Congelados produzidos no período', valor: congeladosTotal, obs: 'DT + VT das produções do período selecionado', destino: 'estoqueEmbrioes' },
    { nome: 'Embriões atualmente em estoque', valor: estoqueAtualTotal, obs: `Saldo atual: DT ${estoqueAtualDT} + VT ${estoqueAtualVT}`, destino: 'estoqueEmbrioes' },
    { nome: '% de produção', valor: percentual(embrioesD7, oocitosViaveis), obs: 'Embriões D7 ÷ oócitos viáveis', destino: 'producoes' },
  ]

  const producoesPorMes = useMemo(() => {
    const valores = Array(12).fill(0) as number[]
    const chavesPorMes = Array.from({ length: 12 }, () => new Set<string>())
    const anoGrafico = filtro.periodo === 'TODOS' ? anosDisponiveis[0] : filtro.ano
    ;[...db.aspiracoes, ...db.producoes].forEach(item => {
      if (anoDaData(item.data) !== anoGrafico || !dentroProfissional(item.clienteId)) return
      const mes = Number(mesDaData(item.data)) - 1
      if (mes < 0 || mes > 11) return
      chavesPorMes[mes].add(chaveServico(item.clienteId, item.data))
    })
    chavesPorMes.forEach((set, i) => { valores[i] = set.size })
    return { valores, ano: anoGrafico }
  }, [db, filtro, anosDisponiveis])

  const ultimasProducoes = useMemo(() => {
    const grupos = new Map<string, GrupoProducao>()
    producoes.forEach((p: Producao) => {
      const chave = chaveServico(p.clienteId, p.data)
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          chave,
          data: p.data,
          clienteId: p.clienteId,
          doadoras: new Set<string>(),
          embrioesD7: 0,
          dt: 0,
          vt: 0,
        })
      }
      const grupo = grupos.get(chave)!
      if (p.doadoraId) grupo.doadoras.add(p.doadoraId)
      grupo.embrioesD7 += numero(p.embriõesD7)
      grupo.dt += numero(p.congeladosDT)
      grupo.vt += numero(p.congeladosVT)
    })
    return Array.from(grupos.values())
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, 6)
  }, [producoes])

  const clienteNome = (id: string) => db.clientes.find(c => c.id === id)?.nome || 'Cliente não identificado'

  const abrirProducaoEspecifica = (clienteId: string, data: string) => {
    onOpenProduction(clienteId, String(data || '').slice(0, 10))
  }

  const abrirProducoesDoMes = (ano: string, mes: string) => {
    onOpenMonth(ano, mes)
  }

  const alertas = useMemo(() => {
    const semenBaixo = db.estoque.filter(item => dentroProfissional(item.clienteId) && numero(item.saldo) <= 2)
    const producaoSemTouro = db.producoes.filter(item => dentroProfissional(item.clienteId) && !item.touroId)
    const transferenciaSemDG = db.transferencias.filter(item => dentroProfissional(item.clienteId) && !String(item.diagnostico || '').trim())
    const embriaoSemLocal = db.estoqueEmbrioes.filter(item => dentroProfissional(item.clienteId) && numero(item.quantidade) > 0 && (!String(item.botijao || '').trim() || !String(item.caneca || '').trim()))
    return [
      { nome: 'Sêmen com estoque baixo', valor: semenBaixo.length, obs: 'Partidas com saldo de 2 doses ou menos', destino: 'estoque' as PageId },
      { nome: 'Produções sem touro', valor: producaoSemTouro.length, obs: 'Produções que precisam ter o touro informado', destino: 'producoes' as PageId },
      { nome: 'Transferências sem diagnóstico', valor: transferenciaSemDG.length, obs: 'Transferências ainda sem DG registrado', destino: 'transferencias' as PageId },
      { nome: 'Embriões sem localização completa', valor: embriaoSemLocal.length, obs: 'Itens em estoque sem botijão ou caneca', destino: 'estoqueEmbrioes' as PageId },
    ]
  }, [db])

  const rotuloProfissional = filtro.profissionalId==='TODOS' ? 'Todos os profissionais' : (profissionalSelecionado?.nome||'Profissional')

  const rotuloPeriodo = filtro.periodo === 'TODOS'
    ? 'Todos os períodos'
    : filtro.periodo === 'MES'
      ? `${MESES.find(m => m.valor === filtro.mes)?.nome || filtro.mes}/${filtro.ano}`
      : filtro.ano

  return (
    <div className="page-grid dashboard-page">
      <section className="panel dashboard-filter-panel">
        <div className="dashboard-filter-title">
          <strong>Período do Dashboard</strong>
          <span>Os indicadores abaixo usam o período selecionado.</span>
        </div>
        <div className="dashboard-filter-grid">
          <label className="field">
            <span>Período</span>
            <select value={periodoRascunho} onChange={e => atualizarFiltroState({ periodoRascunho: e.target.value as Periodo })}>
              <option value="ANO">Ano</option>
              <option value="MES">Mês</option>
              <option value="TODOS">Todos</option>
            </select>
          </label>
          {periodoRascunho !== 'TODOS' && (
            <label className="field">
              <span>Ano</span>
              <select value={anoRascunho} onChange={e => atualizarFiltroState({ anoRascunho: e.target.value })}>
                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </label>
          )}
          {periodoRascunho === 'MES' && (
            <label className="field">
              <span>Mês</span>
              <select value={mesRascunho} onChange={e => atualizarFiltroState({ mesRascunho: e.target.value })}>
                {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>Profissional</span>
            <select value={profissionalRascunho} onChange={e=>atualizarFiltroState({profissionalRascunho:e.target.value})}>
              <option value="TODOS">Todos os profissionais</option>
              {[...db.profissionais].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <button
            className="btn primary dashboard-apply-filter"
            onClick={() => atualizarFiltroState({ filtro: { periodo: periodoRascunho, ano: anoRascunho, mes: mesRascunho, profissionalId: profissionalRascunho } })}
          >
            Aplicar filtro
          </button>
        </div>
        <div className="dashboard-filter-active">Filtro ativo: <b>{rotuloPeriodo}</b> • Profissional: <b>{rotuloProfissional}</b></div>
      </section>

      <section className="dashboard-kpi-grid">
        {cards.map(card => (
          <button
            type="button"
            className="dashboard-kpi-card dashboard-clickable-card"
            key={card.nome}
            onClick={() => onNavigate(card.destino)}
            title={`Abrir ${card.nome}`}
          >
            <span>{card.nome}</span>
            <strong>{card.valor}</strong>
            {card.obs && <small>{card.obs}</small>}
          </button>
        ))}
      </section>

      <section className="dashboard-summary-grid">
        {resumo.map(card => (
          <button
            type="button"
            className="dashboard-summary-card dashboard-clickable-card"
            key={card.nome}
            onClick={() => onNavigate(card.destino)}
            title={`Abrir ${card.nome}`}
          >
            <span>{card.nome}</span>
            <strong>{card.valor}</strong>
            <small>{card.obs}</small>
          </button>
        ))}
      </section>

      <section className="dashboard-lower-grid">
        <article className="panel dashboard-chart-panel">
          <div className="dashboard-section-head">
            <div>
              <h2>Produções por mês</h2>
              <p>Cada cliente + data conta como um único serviço/OPU em {producoesPorMes.ano}.</p>
            </div>
          </div>
          <MiniChart valores={producoesPorMes.valores} onMesClick={mes => abrirProducoesDoMes(producoesPorMes.ano, mes)} />
        </article>

        <article className="panel dashboard-recent-panel">
          <div className="dashboard-section-head">
            <div>
              <h2>Últimas produções</h2>
              <p>Serviços agrupados por cliente e data.</p>
            </div>
          </div>
          <div className="dashboard-recent-list">
            {ultimasProducoes.length === 0 && <div className="dashboard-empty">Nenhuma produção no período.</div>}
            {ultimasProducoes.map(grupo => {
              const totalCong = grupo.dt + grupo.vt
              const tipo = grupo.dt > 0 && grupo.vt > 0 ? 'DT + VT' : grupo.dt > 0 ? 'DT' : grupo.vt > 0 ? 'VT' : '—'
              return (
                <button type="button" className="dashboard-recent-row dashboard-recent-clickable" key={grupo.chave} onClick={() => abrirProducaoEspecifica(grupo.clienteId, grupo.data)} title="Abrir esta produção">
                  <div className="dashboard-recent-main">
                    <b>{clienteNome(grupo.clienteId)}</b>
                    <span>{dataBR(grupo.data)}</span>
                  </div>
                  <div><span>Doadoras</span><b>{grupo.doadoras.size}</b></div>
                  <div><span>Embriões D7</span><b>{grupo.embrioesD7}</b></div>
                  <div><span>Congelados</span><b>{totalCong}</b></div>
                  <div><span>Tipo</span><b>{tipo}</b></div>
                </button>
              )
            })}
          </div>
        </article>
      </section>

      <section className="panel dashboard-alerts-panel">
        <div className="dashboard-section-head">
          <div>
            <h2>Alertas operacionais</h2>
            <p>Pendências que merecem conferência no dia a dia do laboratório.</p>
          </div>
        </div>
        <div className="dashboard-alerts-grid">
          {alertas.map(alerta => (
            <button type="button" className={`dashboard-alert-card ${alerta.valor > 0 ? 'has-alert' : 'ok'}`} key={alerta.nome} onClick={() => onNavigate(alerta.destino)}>
              <span>{alerta.nome}</span>
              <strong>{alerta.valor}</strong>
              <small>{alerta.valor > 0 ? alerta.obs : 'Nenhuma pendência'}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

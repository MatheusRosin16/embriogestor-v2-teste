export type NivelAcesso = 'ADMIN' | 'VETERINARIO' | 'CLIENTE'

export interface PerfilAcesso {
  user_id: string
  owner_id: string
  email: string
  nome?: string
  role: NivelAcesso
  requested_role?: NivelAcesso | null
  cliente_id?: string | null
  profissional_id?: string | null
  ativo: boolean
  created_at?: string
}

export type Status = 'Ativo' | 'Inativo'
export type TipoSemen = 'Convencional' | 'Sexado macho' | 'Sexado fêmea'

export interface Cliente {
  id: string
  nome: string
  cpf?: string
  propriedade?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
}

export interface Raca {
  id: string
  nome: string
  abreviatura: string
}

export interface Doadora {
  id: string
  clienteId: string
  nome: string
  registro?: string
  racaId?: string
  raca?: string
  categoria?: string
  nascimento?: string
  status?: Status
  obs?: string
}

export interface Touro {
  id: string
  clienteId?: string
  clienteIds?: string[]
  nome: string
  registro?: string
  racaId?: string
  raca?: string
  central?: string
  codigo?: string
  tipoSemen?: TipoSemen
  obs?: string
}

export interface Aspiracao {
  id: string
  data: string
  clienteId: string
  doadoraId: string
  grau1: number
  grau2: number
  grau3: number
  grau4: number
  grau5: number
  oocitosTotaisInformados?: number
  oocitosViaveisInformados?: number
  geradaPelaProducao?: boolean
  touroId?: string
  obs?: string
}

export interface Producao {
  id: string
  data: string
  clienteId: string
  doadoraId: string
  touroId?: string
  oocitos: number
  oocitosViaveis: number
  clivados: number
  embriõesD7: number
  transferidosFresco: number
  congeladosDT: number
  congeladosVT: number
  origemAspiracaoId?: string
  ordem?: number
  obs?: string
}


export interface EstoqueSemenItem {
  id: string
  clienteId: string
  touroId: string
  partida?: string
  quantidade: number
  usadas: number
  saldo: number
  recipienteTipo?: 'BOTIJAO' | 'CANECA'
  recipiente?: string
  obs?: string
}

export interface EstoqueEmbriaoItem {
  id: string
  clienteId: string
  data?: string
  doadoraId: string
  touroId: string
  tipo: 'DT' | 'VT'
  quantidade: number
  botijao?: string
  caneca?: string
  raque?: string
  posicao?: string
  origemProducaoId?: string
  obs?: string
}

export interface MovimentacaoItem {
  id: string
  data: string
  tipo: 'ENTRADA_SEMEN' | 'SAIDA_SEMEN' | 'ENTRADA_EMBRIAO' | 'SAIDA_EMBRIAO' | 'AJUSTE'
  clienteId?: string
  touroId?: string
  doadoraId?: string
  estoqueId?: string
  quantidade: number
  descricao: string
}

export interface ServicoSemen {
  id: string
  data: string
  clienteId: string
  touroId: string
  partida?: string
  doses: number
  obs?: string
}

export interface Profissional {
  id: string
  nome: string
  funcao?: string
  crmv?: string
  telefone?: string
  email?: string
  obs?: string
  clienteIds?: string[]
}

export interface Transferencia {
  id: string
  data: string
  clienteId: string
  doadoraId: string
  touroId: string
  origemProducaoId?: string
  usarDoadoraOutroProdutor?: boolean
  receptora?: string
  embriãoEstagio?: 'MO' | 'BI' | 'BL' | 'BX' | 'BN' | 'BE' | ''
  embriãoGrau?: 'G1' | 'G2' | 'G3' | ''
  ovarioCL?: 'OE1' | 'OE2' | 'OE3' | 'OD1' | 'OD2' | 'OD3' | ''
  destino?: 'Fresco' | 'DT' | 'VT'
  diagnostico?: string
  dataDiagnostico?: string
  profissionalId?: string
  obs?: string
  geradaPelaProducao?: boolean
  estoqueEmbriaoId?: string
}

export interface CustoProducao {
  id: string
  competencia: string
  categoria:
    | 'Meios de cultivo/laboratório'
    | 'Material descartável'
    | 'Mão de obra'
    | 'Transporte'
    | 'Manutenção'
    | 'Nitrogênio'
    | 'Energia'
    | 'Água'
    | 'Outros'
  descricao?: string
  valor: number
  tipo?: 'Fixo' | 'Variável' | 'Depreciação'
  clienteId?: string
  obs?: string
}


export interface LinhaRelatorioTransferenciaEditavel {
  id: string
  transferenciaId?: string
  data: string
  cliente: string
  doadora: string
  racaDoadora: string
  touro: string
  racaTouro: string
  receptora: string
  grauD7: string
  estagioD7: string
  ovario: string
  grauCL: string
  clCavitario: string
  diagnostico: string
  dataDiagnostico: string
  destino?: 'Fresco' | 'DT' | 'VT'
  estoqueEmbriaoId?: string
  estoqueBaixado?: boolean
}

export interface RelatorioTransferenciaEditavelSalvo {
  id: string
  criadoEm: string
  clienteId: string
  nomeRelatorio: string
  tipoPeriodo: 'dia' | 'mes' | 'ano'
  periodo: string
  obs?: string
  linhas: LinhaRelatorioTransferenciaEditavel[]
}

export interface IdentidadeEmpresa {
  nome: string
  nomeFantasia?: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  logoDataUrl?: string
}

export interface BancoEmbrioGestor {
  versao: number
  clientes: Cliente[]
  fazendas: any[]
  doadoras: Doadora[]
  touros: Touro[]
  racas: Raca[]
  profissionais: Profissional[]
  usuarios: any[]
  estoque: EstoqueSemenItem[]
  movimentacoes: MovimentacaoItem[]
  estoqueEmbrioes: EstoqueEmbriaoItem[]
  aspiracoes: Aspiracao[]
  producoes: Producao[]
  transferencias: Transferencia[]
  congelamentos: any[]
  servicosSemen: ServicoSemen[]
  custosProducao: CustoProducao[]
  relatoriosTransferenciaEditaveis?: RelatorioTransferenciaEditavelSalvo[]
  identidadeEmpresa?: IdentidadeEmpresa
}

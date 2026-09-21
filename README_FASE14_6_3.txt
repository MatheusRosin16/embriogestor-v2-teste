EMBRIOGESTOR 2.0 — FASE 14.6.3 — FILTRO PERSISTENTE + CORREÇÃO DE INFORMAÇÕES

Base: Fase 14.6.2.

CORREÇÕES
- O filtro do Dashboard agora permanece selecionado ao sair do Dashboard e voltar.
- Período, ano, mês e filtro aplicado ficam no estado principal do aplicativo enquanto a sessão estiver aberta.
- Não usa sessionStorage para essa navegação.
- Oócitos viáveis e totais do Dashboard passam a usar a Aspiração/OPU como fonte oficial.
- Oócitos viáveis = G1 + G2 + G3.
- Oócitos totais = G1 + G2 + G3 + G4.
- Evita divergência quando existe produção manual, produção antiga ou produção com dados de oócitos desatualizados.
- Embriões D7, frescos, DT e VT continuam vindo das Produções.
- Transferências continuam vindo dos registros de Transferência.
- Estoque atual de embriões continua vindo do Estoque de Embriões e não é afetado pelo filtro de período.
- OPU continua = 1 cliente + 1 data.

NÃO REQUER SQL NOVO.

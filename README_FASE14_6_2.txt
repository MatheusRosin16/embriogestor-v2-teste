EMBRIOGESTOR 2.0 — FASE 14.6.2 — FILTROS DO DASHBOARD CORRIGIDOS NA ORIGEM

Base: Fase 14.6.1.

CORREÇÃO
- Removido o uso de sessionStorage para transportar filtros do Dashboard para Produções.
- O React StrictMode executava o inicializador duas vezes no desenvolvimento; como o filtro era apagado na primeira leitura, a segunda leitura recebia vazio e abria a tela geral.
- Agora o filtro é transportado diretamente pelo estado do App.
- Clique em Últimas produções abre somente Cliente + Data selecionados.
- Clique no gráfico abre somente Ano + Mês selecionados.
- Navegação normal pelo menu Produções limpa o filtro e mostra todas.
- Mantido o botão Mostrar todas na tela filtrada.

NÃO HÁ SQL NOVO.

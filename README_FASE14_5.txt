EMBRIOGESTOR 2.0 — FASE 14.5 — DASHBOARD ITENS 1 A 5

Base: Fase 14.4.1 Dashboard Ajustado.

ALTERAÇÕES
1. Mantido o layout aprovado e responsivo da Fase 14.4.1.
2. Origem dos números preservada/corrigida:
   - OPU = cliente + data;
   - oócitos e embriões vêm das produções do período;
   - congelados produzidos = somente DT + VT das produções;
   - estoque de sêmen não participa de nenhum total de embriões.
3. Regra de OPU mantida: várias doadoras do mesmo cliente na mesma data contam como 1 OPU.
4. Separado no Dashboard:
   - Congelados produzidos no período;
   - Embriões atualmente em estoque (saldo atual DT + VT).
   O estoque atual não é afetado pelo filtro de período.
5. Cards do Dashboard agora funcionam como atalhos:
   - OPU e oócitos -> Aspiração de Oócitos;
   - Embriões D7 e % produção -> Produção de Embriões;
   - Frescos e Transferências -> Transferência de Embriões;
   - DT, VT, congelados e estoque atual -> Estoque de Embriões.

AINDA NÃO INCLUÍDO NESTA FASE
- clique no gráfico por mês;
- clique em uma linha de Últimas produções para abrir a produção específica;
- alertas operacionais.

TESTE
npm install
npm run dev

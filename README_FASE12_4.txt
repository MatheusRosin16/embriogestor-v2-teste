EMBRIOGESTOR 2.0 — FASE 12.4 — PORTAL DO CLIENTE

Base: Fase 12.3 validada.

PERFIL CLIENTE
- somente leitura;
- recebe somente os dados do cliente vinculado pelo Administrador;
- Minhas doadoras;
- Meu estoque de sêmen;
- Meu estoque de embriões;
- Minhas produções;
- Minhas transferências;
- indicadores de produção e prenhez.

ESTOQUE DE SÊMEN
Exibe:
- Touro
- Raça
- Tipo de sêmen
- Partida
- Entradas
- Doses usadas
- Saldo atual
- Localização

SEGURANÇA
A Fase 12.3 já filtra no Supabase o array "estoque" pelo cliente_id.
A Fase 12.4 apenas apresenta esses dados no Portal do Cliente.
O cliente continua sem permissão de edição.

NÃO HÁ NOVO SQL PARA ESTA FASE.

TESTE
npm install
npm run dev

Depois:
1. Administrador > Usuários & Acessos
2. vincular a conta CLIENTE ao cadastro correto
3. liberar acesso
4. entrar como Cliente

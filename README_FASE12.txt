EMBRIOGESTOR 2.0 — FASE 12 — NÍVEIS DE ACESSO

NÍVEIS
1. ADMINISTRADOR
- acesso completo
- Gestão Econômica
- Relatório MAPA
- Nuvem & Backup
- Importação
- Usuários & Acessos
- todos os clientes

2. VETERINÁRIO
- Dashboard
- Clientes, Doadoras, Touros, Raças e Profissionais
- Estoques e Movimentações
- Aspiração/OPU
- Produção
- Transferências
- Análise de Touros
- Relatórios por Cliente
- não acessa custos, MAPA, nuvem, importação nem gestão de usuários

3. CLIENTE
- Portal do Cliente somente leitura
- visualiza apenas o cliente vinculado
- doadoras, produções, transferências e estoque/resultados próprios
- filtro é feito no servidor pela função embrio_get_state(), não apenas escondendo menus

LOGIN
- Tela inicial própria do EmbrioGestor
- e-mail/senha
- botão Entrar com Google
- novo cadastro entra aguardando aprovação
- Admin libera o nível e, se for Cliente, vincula ao cadastro do cliente

OBRIGATÓRIO NO SUPABASE
Execute no SQL Editor:
supabase/FASE12_NIVEIS_ACESSO.sql

IMPORTANTE
O SQL transforma o primeiro usuário já existente no Supabase em ADMINISTRADOR.
Os próximos usuários entram como CLIENTE inativo até a aprovação.

SEGURANÇA LOCAL
Cada usuário usa uma chave localStorage separada para evitar que um Cliente veja
dados administrativos deixados no mesmo navegador por outro login.

TESTE
npm install
npm run dev

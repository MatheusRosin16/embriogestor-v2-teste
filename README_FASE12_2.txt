EMBRIOGESTOR 2.0 — FASE 12.2

ALTERAÇÕES:
- Administrador / Veterinário / Cliente agora são botões selecionáveis na tela inicial.
- O login mostra explicitamente "Entrar como Administrador/Veterinário/Cliente".
- O sistema valida se o nível selecionado corresponde ao nível realmente liberado.
- "Criar novo cadastro" abre um formulário de verdade:
  Nome, e-mail, senha, confirmação e perfil solicitado.
- Novo usuário NÃO ganha permissão sozinho.
- Todo novo cadastro continua inativo até aprovação do Administrador.
- A tela Usuários & Acessos passa a mostrar o "Perfil solicitado".
- Mantido o botão Sair da Fase 12.1.

OBRIGATÓRIO:
Execute no Supabase SQL Editor:
supabase/FASE12_2_CADASTRO_PERFIS.sql

Depois:
npm install
npm run dev

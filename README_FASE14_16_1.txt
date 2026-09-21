EmbrioGestor 2.0 — Fase 14.16.1

Base segura: Fase 14.15.4.

CORREÇÕES
- NÃO altera ativo, role ou owner_id dos usuários existentes.
- Veterinário continua no mesmo banco mestre indicado pelo owner_id já aprovado.
- Adiciona profissional_id apenas como vínculo complementar.
- Administrador escolhe o profissional em Usuários & Níveis de Acesso.
- Cliente continua somente leitura e recebe apenas seu cliente vinculado.
- Identidade/logo incluída na visão do Cliente.
- Corrigida chamada de inicialização OAuth/identidade no AuthGate.
- Novo botão “Esqueci minha senha” envia recuperação pelo Supabase Auth.

IMPORTANTE
Execute somente supabase/FASE14_16_1_ACESSO_SYNC_SENHA.sql.
Este SQL NÃO libera nem bloqueia usuários automaticamente.
Se usuários já estiverem com ativo=false no Supabase por alteração anterior, eles precisam ser liberados pelo Administrador uma vez; esta versão não força mudanças de segurança.

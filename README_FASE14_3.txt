EMBRIOGESTOR 2.0 — FASE 14.3 — REDESIGN MOBILE

Base: Fase 14.2 Mobile/Realtime.

CORREÇÕES MOBILE
- O botão ☰ não fica mais flutuando sobre o Dashboard.
- Novo cabeçalho móvel fixo com logo, nome e perfil.
- Menu lateral redesenhado para celular.
- Ícones aparecem junto de Clientes, Doadoras, Touros, Estoques etc.
- Menu respeita integralmente o nível de acesso:
  Administrador, Veterinário ou Cliente.
- Área ativa fica destacada.
- Botão Sair fixado no rodapé do menu.
- Dashboard e títulos não ficam escondidos.
- Cards reorganizados em uma coluna em celulares.
- Tabelas usam rolagem horizontal.
- Formulários ficam em uma coluna.
- Modais abrem como painel inferior, usando melhor a tela.
- Login e Portal do Cliente ajustados para telas pequenas.
- Mantém PWA, Supabase Realtime, polling de segurança, offline e sincronização.

NÃO HÁ SQL NOVO nesta correção visual.
Se o SQL FASE14_2_REALTIME.sql já foi executado, não execute novamente.

TESTE:
npm install
npm run dev
Abra o endereço Network no celular.

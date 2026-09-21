EMBRIOGESTOR 2.0 — FASE 14.2 — MOBILE + PWA + REALTIME

Base: Fase 14.1.

CORREÇÕES PRINCIPAIS
- Remove conflito de CSS que escondia o menu mobile.
- Usa o menu mobile existente com permissões por perfil.
- Login por e-mail/senha funciona em IP local sem redirecionar para localhost.
- Google OAuth fica desabilitado em HTTP por IP local para evitar callback inválido; em produção HTTPS usa a URL atual dinamicamente.
- Supabase Realtime em embrio_app_state para atualização imediata entre notebook e celular.
- Fallback REST a cada 5 s se o Realtime estiver indisponível.
- Envio de alterações locais reduzido para ~1,2 s.
- Offline continua local-first e sincroniza ao reconectar.
- PWA com aviso de instalação; iPhone mostra orientação Compartilhar > Adicionar à Tela de Início.
- Publishable key pública pré-configurada. Nenhuma chave secreta.

SUPABASE
Execute supabase/FASE14_2_REALTIME.sql uma vez para habilitar a tabela no Realtime.

IMPORTANTE PARA INSTALAR COMO APP
Service Worker/PWA completo exige HTTPS (localhost é exceção). O IP local http://192.168... serve para testar a interface e sincronização, mas a instalação definitiva deve ser feita após publicar em HTTPS.

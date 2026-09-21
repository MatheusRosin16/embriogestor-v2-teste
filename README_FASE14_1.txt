EMBRIOGESTOR 2.0 — FASE 14.1 — SUPABASE PRÉ-CONFIGURADO

Base: Fase 14 Mobile/PWA.

Alterações:
- Project URL público já embutido no app.
- Publishable key pública já embutida no app.
- Em aparelhos novos, a tela "Configurar EmbrioGestor" não aparece mais.
- O usuário vai direto para a tela de login.
- Mantém Mobile/PWA, Supabase, sincronização e modo offline.

Segurança:
- Somente a Publishable key pública foi incorporada.
- Nenhuma service_role/secret key foi adicionada.

Teste:
1. npm install
2. npm run dev
3. Abra o endereço Network no notebook e no celular.
4. A tela esperada é o login do EmbrioGestor.

Não requer SQL novo.

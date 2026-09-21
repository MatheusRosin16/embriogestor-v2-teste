EMBRIOGESTOR 2.0 — FASE 14.14 PWA OFFLINE-FIRST

Base: Fase 14.13.9. Esta Fase 14.14 NÃO reutiliza a antiga tentativa de 14.14 de acessos.

Incluído:
- PWA com service worker registrado automaticamente.
- Cache do aplicativo para reabertura sem internet após o primeiro carregamento online.
- Cache de páginas e recursos estáticos.
- Indicador Online/Offline existente reforçado.
- Alterações locais feitas offline continuam salvas no banco local do aparelho.
- Fila simples de pendência offline para indicar que há alteração aguardando nuvem.
- Ao recuperar conexão, o evento de sincronização existente é disparado para o fluxo Supabase já presente.
- Instalação como aplicativo no celular/computador continua disponível.
- Vite continua com host:true para testes na rede local.
- base './' preservado para publicação estática.

IMPORTANTE:
1. Para funcionar em QUALQUER Wi-Fi/4G/5G, ainda é necessário PUBLICAR o projeto em HTTPS (GitHub Pages, Cloudflare Pages, Vercel etc.).
2. Offline funciona depois que o aparelho tiver carregado/instalado o app ao menos uma vez online.
3. O login inicial/autenticação Supabase pode exigir internet se não houver sessão válida armazenada.
4. Esta fase não altera perfis, permissões ou regras de acesso.
5. Para sincronização concorrente realmente transacional de estoque entre vários aparelhos offline, uma etapa futura deve migrar movimentos críticos para operações/filas por registro no backend, em vez de sincronizar apenas o estado agregado do banco.

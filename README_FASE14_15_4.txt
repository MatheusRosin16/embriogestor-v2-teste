EmbrioGestor 2.0 — Fase 14.15.4 — Sincronização por perfil

Problema encontrado:
- Os metadados de sincronização (última sync/conflito/dirty) eram compartilhados no mesmo navegador mesmo ao trocar Admin/Veterinário/Cliente.
- Cliente recebe dados via RPC filtrada, mas a RPC antiga não incluía identidadeEmpresa; por isso a logo não chegava.
- Cliente é somente leitura e não deve tentar publicar banco local.

Correções:
1. Ao mudar de usuário, o contexto de sincronização anterior é zerado, sem apagar o banco.
2. Cliente: nuvem é sempre fonte de verdade; ao sincronizar, baixa sua visão filtrada e não envia alterações.
3. Veterinário: continua recebendo banco completo do mesmo owner_id e pode sincronizar alterações autorizadas.
4. Conflito de um login não é herdado por outro login no mesmo aparelho.
5. SQL FASE14_15_4_SYNC_PERFIS.sql inclui identidadeEmpresa na visão do Cliente.
6. Admin/Veterinário continuam recebendo o banco completo.

OBRIGATÓRIO PARA CLIENTE/LOGO:
Executar supabase/FASE14_15_4_SYNC_PERFIS.sql no SQL Editor do projeto Supabase.
Sem esse SQL, o navegador não consegue fazer o servidor enviar identidadeEmpresa ao Cliente.

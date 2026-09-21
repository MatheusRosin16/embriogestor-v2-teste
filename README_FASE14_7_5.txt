EMBRIOGESTOR 2.0 — FASE 14.7.5 — MIGRAÇÃO DE ASPIRAÇÕES ANTIGAS

- Mantém a criação automática para novas Produções.
- Ao carregar o banco, verifica TODAS as produções já existentes.
- Para cada produção sem Aspiração correspondente (cliente + doadora + data), cria a OPU automaticamente.
- Usa oócitos totais e viáveis já gravados na produção.
- G1, G2, G3, G4 e G5 = 0.
- Não duplica quando a Aspiração já existe.
- A regularização também é aplicada quando chega um banco remoto do Supabase.
- As OPUs criadas são salvas e sincronizadas.

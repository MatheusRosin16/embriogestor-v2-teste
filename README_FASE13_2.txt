EMBRIOGESTOR 2.0 — FASE 13.2 — CORREÇÃO DE COMPILAÇÃO

Corrige um erro de sintaxe introduzido na Fase 13.1.
O código havia ficado com o texto literal "\1" em filtros de touros por cliente.

Arquivos corrigidos:
- EstoqueEmbrioes.tsx
- EstoqueSemen.tsx
- Producoes.tsx
- Transferencias.tsx
- AnaliseTouros.tsx

Mantém todas as regras da Fase 13.1:
- touro pode estar vinculado a vários clientes;
- recuperação automática de vínculos pelos dados existentes;
- sem duplicar cadastro genético;
- sem novo SQL.

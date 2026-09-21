EMBRIOGESTOR 2.0 — FASE 13.1 — TOUROS POR CLIENTE

Correção específica sobre a Fase 13.

- Um touro passa a poder ser vinculado a vários clientes.
- O sistema recupera automaticamente os vínculos existentes usando:
  estoque de sêmen, estoque de embriões, produções, transferências,
  serviços de sêmen e movimentações.
- Não duplica o cadastro genético do touro.
- Os seletores de Produção, Transferência e Estoques respeitam a carteira do cliente.
- Na tela Touros, o cadastro pode ter vários clientes marcados.
- "Sem cliente definido" fica apenas para touros sem qualquer vínculo recuperável.
- Não requer SQL novo.

IMPORTANTE: ao abrir como Administrador, aguarde o indicador de sincronização.
A normalização recupera os vínculos e a próxima sincronização salva a estrutura corrigida na nuvem.

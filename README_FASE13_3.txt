EMBRIOGESTOR 2.0 — FASE 13.3

Correção específica dos modais que ficavam em tela branca:

1. Estoque de Sêmen > Editar
   - corrigido filtro de touros para usar edit.clienteId.

2. Estoque de Embriões > Editar
   - corrigido o mesmo erro.

3. Produções > Nova produção
   - corrigido filtro para manual.clienteId.

4. Produções > Registrar doses do serviço
   - corrigido filtro para servico.clienteId.

A tela branca acontecia por referência a variáveis inexistentes/nulas durante a abertura do modal.
O texto ?error=invalid_request... na URL era um resíduo de tentativa OAuth anterior e agora é limpo ao iniciar o app.

Não requer SQL novo.

EmbrioGestor 2.0 — Fase 14.16.2 — Sync celular

Correção do conflito persistente no Veterinário/Cliente:
- Veterinário e Cliente, ao entrar online, carregam a nuvem como fonte inicial.
- Conflito antigo sem alteração local pendente é limpo automaticamente.
- Cliente nunca cria conflito local (somente leitura).
- Se Veterinário estiver com conflito e clicar “Baixar dados”, o aparelho baixa o banco mestre do laboratório e substitui somente a cópia local conflitante.
- Banco remoto do Administrador não é apagado nesse procedimento.
- Alterações normais feitas pelo Veterinário continuam podendo subir quando não existe conflito real.
- Mantidos vínculo com Profissional e “Esqueci minha senha” da 14.16.1.

Não há SQL novo nesta fase. Use o SQL FASE14_16_1_ACESSO_SYNC_SENHA.sql somente se ainda não o executou.

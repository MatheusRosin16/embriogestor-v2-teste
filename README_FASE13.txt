EMBRIOGESTOR 2.0 — FASE 13 — SINCRONIZAÇÃO MULTIDISPOSITIVO E OFFLINE

Base: Fase 12.4 validada.

O QUE FOI FEITO
- Sincronização automática entre dispositivos a cada 20 segundos.
- Atualização imediata ao voltar para a aba ou janela do EmbrioGestor.
- Cliente recebe alterações novas do laboratório sem precisar sair e entrar.
- Administrador e Veterinário também recebem alterações remotas.
- Metadados de sincronização agora são separados por usuário no mesmo navegador.
- Continua local-first: qualquer alteração é salva primeiro no aparelho.
- Se a internet cair, o sistema continua funcionando localmente.
- Ao voltar a internet, a sincronização é retomada.
- Indicador no topo:
  * Sincronizado
  * Salvando na nuvem
  * Offline
  * Conflito de sincronização
- Se dois usuários alterarem o banco ao mesmo tempo, o sistema evita sobrescrever silenciosamente e marca conflito.

NÃO HÁ NOVO SQL NESTA FASE.

TESTE RECOMENDADO
1. npm install
2. npm run dev
3. Abra Administrador em um navegador.
4. Abra Cliente ou Veterinário em outro navegador/dispositivo.
5. Faça uma alteração no Administrador/Veterinário.
6. Aguarde até 20 segundos no outro dispositivo.
7. Confirme que o dado aparece automaticamente.

IMPORTANTE
Esta fase mantém o modelo local-first + Supabase já existente. Nenhum dado da Fase 12.4 é apagado.

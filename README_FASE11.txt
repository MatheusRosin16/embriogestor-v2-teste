EMBRIOGESTOR 2.0 — FASE 11 — NUVEM & BACKUP

IMPLEMENTADO
- funcionamento local-first
- conexão Google Drive por OAuth
- pasta EmbrioGestor
- backup JSON com data/hora
- arquivo principal EmbrioGestor_Dados_Principais.json
- enviar dados deste aparelho
- carregar dados do Drive
- listar backups
- restaurar backup
- baixar cópia local JSON
- importar cópia local JSON
- cópia de emergência antes de importação/restauração
- custosProducao preservados na normalização

CONFIGURAÇÃO
O Client ID do projeto anterior já foi mantido em:
src/config/cloud.ts

IMPORTANTE
Para o login do Google funcionar depois de publicado, a URL do GitHub Pages precisa constar nas origens JavaScript autorizadas do Client ID do Google Cloud.

MODELO DE SINCRONIZAÇÃO
Esta fase NÃO faz edição simultânea em tempo real.
Fluxo recomendado:
1. Trabalhar normalmente (salva local).
2. Antes de trocar de aparelho: Enviar dados deste aparelho.
3. No outro aparelho: Carregar dados do Drive.

TESTE
npm install
npm run dev

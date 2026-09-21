EMBRIOGESTOR 2.0 — FASE 11.1
SUPABASE PRINCIPAL + GOOGLE DRIVE BACKUP

ARQUITETURA
1. Salva localmente imediatamente em cada alteração.
2. Se houver internet + sessão Supabase, sincroniza automaticamente após ~5 segundos.
3. Se ficar offline, mantém a alteração local marcada como pendente.
4. Quando a internet volta, tenta sincronizar.
5. Cria backup histórico diário no Supabase.
6. Google Drive funciona como segunda cópia de segurança enquanto a autorização OAuth estiver válida.
7. Backup local JSON continua disponível.

SEGURANÇA
- Supabase usa autenticação por e-mail/senha.
- RLS: cada usuário só lê/escreve seu próprio banco.
- URL e chave pública/anon podem ficar no frontend.
- NUNCA colocar service_role key no navegador.

ANTES DE USAR
1. Criar projeto no Supabase.
2. Abrir SQL Editor.
3. Executar: supabase/embrio_schema.sql
4. Em Project Settings/API copiar:
   - Project URL
   - Publishable key / anon public key
5. No EmbrioGestor > Nuvem & Backup, colar os dois campos.
6. Criar a conta do administrador ou entrar.

CONFLITOS
Se este aparelho e a nuvem forem alterados separadamente depois da última sincronização,
o sistema não sobrescreve automaticamente. Mostra duas opções:
- manter este aparelho
- usar versão da nuvem

GOOGLE DRIVE
O Google Drive permanece como backup adicional.
Se ocorrer erro 400 origin_mismatch, cadastre a origem JavaScript autorizada
no Google Cloud. O Supabase e o uso local continuam funcionando normalmente.

TESTE
npm install
npm run dev

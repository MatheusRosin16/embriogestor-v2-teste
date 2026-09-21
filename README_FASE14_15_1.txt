EmbrioGestor 2.0 — Fase 14.15.1

1) DIGITALIZAÇÃO EM UM ÚNICO MÓDULO
- Digitalizar Ficha de TE aceita foto, imagem e PDF.
- Seletor: Detectar automaticamente / Planilha antiga / Ficha de campo manuscrita SÊMINNA.
- Prévia editável única.
- Campo DG60 incluído na revisão.
- Preparado para interpretar repetição manuscrita (||) e preservar zeros à esquerda quando o OCR/IA online for conectado.
- Continua sem movimentar estoque automaticamente.
- OCR/IA real ainda depende do backend online seguro.

2) SINCRONIZAÇÃO NO CELULAR
- Corrigida a detecção excessivamente sensível de conflito.
- Primeiro acesso de um perfil em aparelho sem baseline passa a priorizar a nuvem quando não há alteração local relevante.
- Adicionada tolerância de 5 segundos para diferenças de timestamp.
- Conflito continua existindo quando há evidência de alteração local e remota concorrente.
- Não foram alterados login, perfis ou permissões.

IMPORTANTE: esta correção não apaga dados nem resolve automaticamente conflitos já gravados no localStorage de uma instalação anterior. Um conflito já marcado deve ser resolvido pela tela Nuvem & Backup escolhendo conscientemente a versão correta (nuvem ou local).

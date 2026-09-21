EMBRIOGESTOR 2.0 — FASE 7

ALTERAÇÕES ESPECÍFICAS NA TRANSFERÊNCIA

1. FILTRO PELO CLIENTE
Após selecionar o Cliente:
- Produções: somente do cliente
- Doadoras: somente do cliente
- Touros: somente do cliente

2. DOADORA DE OUTRO PRODUTOR
Foi criada a opção:
"Usar doadora de outro produtor"

Quando marcada:
- mostra as doadoras dos demais clientes
- mostra também o nome do proprietário da doadora

3. ESTÁGIO PRIMEIRO
Ordem:
- Estágio
- Grau D7

Estágios permitidos:
MO
BI
BL
BX
BN
BE

4. GRAU D7
G1
G2
G3

5. OVÁRIO + CL
Foram removidos os campos separados:
- Ovário
- Grau do CL
- CL cavitário

Agora existe somente:
Ovário + CL

Opções:
OE1
OE2
OE3
OD1
OD2
OD3

6. EMBRIÃO
O campo "Destino" foi renomeado na interface para:
EMBRIÃO

Opções:
FRESCO
DT
VT

7. BAIXA AUTOMÁTICA DO ESTOQUE
Se escolher DT ou VT:
- procura no estoque do CLIENTE selecionado
- mesma doadora
- mesmo touro
- mesmo tipo DT ou VT
- quantidade maior que zero

Ao salvar:
- baixa 1 embrião do estoque
- gera movimentação automática

Se não existir embrião compatível:
- a transferência não é salva
- o sistema informa que não há estoque disponível

IMPORTANTE:
Editar uma transferência já existente NÃO baixa outra unidade.

8. ENTER
Mantido para avançar entre os campos.

COMO ABRIR
1. Extraia EmbrioGestor_2_0_FASE7
2. Abra a pasta interna no VS Code
3. npm install
4. npm run dev
5. Abra http://localhost:5173/

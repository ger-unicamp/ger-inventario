# Inventário GER

Interface web para o inventário do Grupo de Estudos em Robótica da Unicamp. Roda como serviço no PC do GER, em `http://localhost:3939`, e usa uma planilha do Google Sheets como banco de dados.

**Next.js + shadcn/ui + Google Sheets API.**

---

Códigos descartados não são reaproveitados. Dar baixa marca o item como `Descartado` e mantém a linha, porque item com plaqueta de patrimônio da Unicamp precisa de baixa formal e o rastro importa.

---

## Instalação

### Passo 1 — Criar a planilha

Crie uma planilha nova no Google Sheets, na conta do GER (não na sua pessoal — gestão muda). Guarde o ID, que é o trecho da URL entre `/d/` e `/edit`:

```
https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit
                                       └──────┬──────┘
                                          é este
```

### Passo 2 — Criar a service account

A service account é uma "conta de robô" que dá ao app permissão de escrever na planilha sem ninguém ficar logado. É isso que permite ele rodar como daemon.

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto (nome livre, ex.: `ger-inventario`).
2. Em **APIs e serviços → Biblioteca**, procure **Google Sheets API** e clique em **Ativar**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**. Dê um nome e conclua; não precisa conceder papéis no projeto.
4. Abra a conta criada → aba **Chaves** → **Adicionar chave → Criar nova chave → JSON**. O arquivo baixa automaticamente. **Esse arquivo é uma senha**: não suba no Git, não mande no grupo do WhatsApp.
5. Copie o `client_email` do JSON (algo como `inventario@ger-inventario.iam.gserviceaccount.com`).
6. Volte à planilha → **Compartilhar** → cole esse e-mail → permissão **Editor**.

O passo 6 é o que mais trava gente: sem ele, a API responde 403 mesmo com a credencial certa.

### Passo 3 — Configurar o projeto

```bash
cp .env.example .env
```

Preencha o `.env` com o ID da planilha, o `client_email` e a `private_key` do JSON. A chave privada vai entre aspas duplas, inteira, com os `\n` exatamente como estão no arquivo:

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBAD...\n-----END PRIVATE KEY-----\n"
```

### Passo 4 — Preparar a planilha e subir

```bash
npm install
npm run init-sheet    # cria as abas Inventario, Locais e Emprestimos, cabeçalhos e listas suspensas
npm run build
npm run start         # http://localhost:3939
```

`init-sheet` é seguro de rodar mais de uma vez: não apaga dados nem duplica abas. Ele também copia para a aba Locais os locais que já estavam escritos nos itens, e avisa no terminal os que estão fora do padrão `Móvel / Zona`.

### Passo 5 — Deixar rodando como serviço

**Linux (systemd):**

```bash
sudo bash deploy/instalar-linux.sh
```

O script copia o projeto para `/opt/ger-inventario`, compila, instala o serviço e habilita o boot automático. Depois:

```bash
systemctl status ger-inventario     # ver se está de pé
journalctl -u ger-inventario -f     # acompanhar os logs
sudo systemctl restart ger-inventario
```

**Windows:** veja [`deploy/windows.md`](deploy/windows.md).

---

## Uso

### No dia a dia

Abra `http://localhost:3939` no PC do GER. A busca aceita código, nome, local, plaqueta de patrimônio e observações, ignora acentos, e exige que todas as palavras digitadas apareçam no item — `multimetro armario b` encontra o multímetro que está no armário B.

Antes de cadastrar qualquer coisa, preencha **"quem está mexendo"** no topo. O nome fica salvo no navegador e vai para a coluna `Atualizado por` de toda alteração. Sem login não há como saber quem mudou o quê, e é justamente esse campo que permite reconstruir o que aconteceu quando algo some.

### Quantidade ou nível?

Para ferramentas e equipamentos, use **quantidade**. Para consumíveis — parafusos, jumpers, resistores, fita — use **nível** (`Sobrando` / `Pouco` / `Acabou`) e ignore a quantidade. Contar parafuso unidade por unidade trava um mutirão inteiro e o número fica errado em uma semana. O contador no topo mostra quantos consumíveis estão em `Pouco` ou `Acabou`, o que vira a lista de compras.

### Etiquetas

```bash
npm run etiquetas                            # todos os itens ativos
npm run etiquetas -- --de 0001 --ate 0120    # uma faixa
npm run etiquetas -- --projeto "Braco Robotico"
```

Gera `etiquetas.html`. Abra no navegador e imprima **com escala 100%** — "ajustar à página" desalinha a grade. A grade vem configurada para folha A4 de 3 × 8 (63,5 × 33,9 mm, padrão Pimaco 6180 / Avery 3474); para outro formato, ajuste `--colunas`, `--largura` e `--altura` no CSS do arquivo gerado, ou direto em `scripts/gerar-etiquetas.ts`.

Faça um teste em papel comum antes de gastar a folha adesiva.

Se vocês usarem rotuladora com numeração automática em vez de folha adesiva, o script não é necessário: basta configurar a rotuladora para começar no próximo código livre e cadastrar na mesma ordem em que for etiquetando.

### Empréstimos

A aba **Empréstimos** registra quem levou o quê. Para emprestar, use o botão de mão na linha do item ou "Novo empréstimo" digitando o código da etiqueta. Informe quem leva, o contato (telefone, e-mail ou RA), a quantidade e, se quiser, até quando deve voltar.

- Item contável pode sair em parte: de 10 servos, emprestar 3 deixa 7 disponíveis. Não dá para emprestar mais do que está disponível.
- Consumível não é emprestado: é retirado. Para ele, use o Nível.
- A devolução é do empréstimo inteiro. Se só parte voltou, registre a devolução e abra um empréstimo novo com o que ficou fora.
- Empréstimo com prazo vencido aparece como atrasado, com contador no topo da tela de itens.
- Item com unidades emprestadas não pode receber baixa, e sua quantidade não pode ficar abaixo do que está fora.

Na planilha, a aba `Emprestimos` é um livro de registro: cada empréstimo é uma linha, e a devolução preenche "Devolvido em" na mesma linha. Nada é apagado, então o histórico completo fica lá. O app abre direto numa aba com `?aba=emprestimos` ou `?aba=locais`.

### Locais

Os locais ficam numa aba própria da planilha, `Locais`, e são gerenciados na tela **Locais** do app. Cada local é um **móvel** (armário, bancada, estante) e, opcionalmente, uma **zona** dentro dele (prateleira, gaveta, painel). No item aparece o nome completo: `Armario B / Gaveta 3`, ou só `Bancada 1` quando o local é o móvel inteiro.

- O item só aceita local cadastrado. Isso acaba com as grafias divergentes que transformavam o filtro em ruído. Dá para cadastrar um local novo sem sair do formulário do item.
- Renomear um local reescreve a coluna Local de todos os itens dele, numa única escrita.
- Um local só pode ser removido quando nenhum item ativo está nele.
- O filtro de local aceita um móvel inteiro ("Tudo em Armario B") ou uma zona específica.

Na planilha, a coluna D da aba Locais (`Nome`) é preenchida pelo app e serve à lista suspensa da coluna Local do inventário. Se editar Móvel ou Zona direto na planilha, rode `npm run init-sheet` de novo para recalcular o Nome. O app em si sempre recalcula o nome a partir de Móvel e Zona, então não é enganado por um Nome desatualizado.

---

## Estrutura

```
src/
  app/
    api/items/route.ts            GET lista, POST cadastra
    api/items/[codigo]/route.ts   PATCH edita, DELETE dá baixa
    api/locais/route.ts           GET, POST, PATCH (rename em cascata), DELETE
    api/emprestimos/route.ts      GET, POST empresta, PATCH registra devolução
    api/status/route.ts           diagnóstico da conexão
    page.tsx
  components/
    inventario.tsx                tela principal: busca, filtros, tabela
    item-form-dialog.tsx          cadastro e edição
    locais.tsx                    tela de locais, agrupada por móvel
    local-form-dialog.tsx         cadastro e edição de local
    emprestimos.tsx               tela de empréstimos abertos e histórico
    emprestimo-form-dialog.tsx    registro de empréstimo
    ui/                           componentes shadcn
  lib/
    sheets.ts                     leitura, escrita e fila de escrita
    types.ts                      modelo de dados e colunas da planilha
    locais.ts                     agrupamento e filtro de locais (cliente)
scripts/
  init-sheet.ts                   prepara a planilha
  gerar-etiquetas.ts              folha A4 de etiquetas
deploy/
  ger-inventario.service          unidade systemd
  instalar-linux.sh               instalação automatizada
  windows.md                      equivalente para Windows
```

### Colunas da planilha

| Coluna | Conteúdo |
|---|---|
| Código | 4 dígitos, imutável, igual ao da etiqueta |
| Nome | descrição curta do item |
| Categoria | Ferramenta, Componente eletrônico, Peça mecânica, Consumível, Equipamento, Material de escritório, Outro |
| Projeto | Futebol de Robôs, Braço Robótico, Projeto Social, Geral / ADM |
| Local | nome de um local da aba `Locais` (`Móvel / Zona`) |
| Quantidade / Unidade | para itens contáveis |
| Nível | para consumíveis: Sobrando, Pouco, Acabou |
| Estado | Funciona, Com defeito, Não testado, Descartado |
| Patrimônio | número da plaqueta da Unicamp, quando houver |
| Observações | defeito conhecido, pendências |
| Atualizado em / por | preenchidos automaticamente |

Mudar a **ordem** das colunas quebra o app: a ordem está fixada em `COLUNAS`, em `src/lib/types.ts`. Adicionar colunas **depois** da coluna M é seguro.

---

## Testes

```bash
npm test
```

Roda 54 testes, sem rede e sem credencial: as conversões entre linha da planilha e item (`scripts/testar-mapeamento.ts`) e o caminho de escrita contra uma planilha falsa em memória (`scripts/testar-escrita.mts`).

O que eles protegem, concretamente: que o `update` escreva na linha certa mesmo havendo linha em branco no meio da planilha, que dois cadastros simultâneos não recebam o mesmo código, que `0001` não vire `1`, e que o código de um item descartado não seja reaproveitado — uma etiqueta velha ainda colada em algo no fundo de um armário passaria a apontar para outro item. Nenhuma dessas falhas dá erro na tela; elas só corrompem o inventário em silêncio.

Rode antes de mexer em `src/lib/sheets.ts` ou na ordem das colunas.

---

## Notas técnicas

**Cache.** Leituras ficam 20 segundos em cache para não estourar a cota da API do Sheets. Toda escrita invalida o cache, e o botão de recarregar força leitura nova. Se alguém editar direto na planilha, a mudança aparece em até 20 segundos ou no próximo refresh.

**Escritas em série.** Todas as escritas passam por uma fila de um slot (`src/lib/sheets.ts`). Sem isso, dois cadastros simultâneos poderiam receber o mesmo código ou sobrescrever a mesma linha.

**Sem autenticação.** O serviço escuta apenas em `127.0.0.1`, então só quem está no PC do GER alcança. Se um dia vocês quiserem acesso pela rede do laboratório — útil no dia do mutirão, com celular na mão — troque `-H 127.0.0.1` por `-H 0.0.0.0` no script `start` do `package.json`. **Nesse momento passa a ser necessário algum controle de acesso**: qualquer máquina da rede poderá apagar itens. Não exponha para fora da Unicamp sem autenticação.

**Zeros à esquerda.** A coluna Código é formatada como texto pelo `init-sheet`. Sem isso o Sheets converteria `0001` em `1` e os códigos deixariam de bater com as etiquetas.

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `403` ou "The caller does not have permission" | A planilha não foi compartilhada como **Editor** com o `client_email` da service account |
| `404` / "Requested entity was not found" | `GOOGLE_SHEETS_ID` errado — confira o trecho entre `/d/` e `/edit` |
| `error:1E08010C:DECODER routines::unsupported` | A `GOOGLE_PRIVATE_KEY` perdeu os `\n`. Cole o valor inteiro do JSON, entre aspas duplas |
| "A planilha não tem a aba Inventario" | Falta rodar `npm run init-sheet` |
| Códigos aparecem como `1` em vez de `0001` | A coluna A foi reformatada como número. Volte para texto, ou rode `init-sheet` de novo |
| Serviço não sobe no boot | `systemctl status ger-inventario` e `journalctl -u ger-inventario -n 50` dizem o motivo |

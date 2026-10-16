/**
 * Testes do caminho de escrita, contra uma planilha falsa em memoria.
 *
 *   npx tsx --conditions react-server scripts/testar-escrita.ts
 *
 * O que estes testes protegem: o indice de linha usado no update. Um erro de
 * um na conta faz o app sobrescrever o item vizinho em vez do pedido — e isso
 * nao da erro nenhum, so corrompe o inventario em silencio.
 */

import assert from "node:assert/strict";
import type { sheets_v4 } from "googleapis";

process.env.GOOGLE_SHEETS_ID = "planilha-de-teste";
process.env.GOOGLE_SHEETS_ABA = "Inventario";
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "teste@exemplo.com";
process.env.GOOGLE_PRIVATE_KEY = "nao-usada";

const {
  atualizarItem,
  criarItem,
  criarLocal,
  darBaixa,
  definirClienteParaTeste,
  devolver,
  editarLocal,
  emprestar,
  EmprestimoInvalido,
  ItemNaoEncontrado,
  listarEmprestimos,
  listarItens,
  listarLocais,
  LocalInvalido,
  removerLocal,
} = await import("../src/lib/sheets");

/* ------------------------------------------------------------------ *
 * Planilha falsa: um array de linhas por aba, com a mesma semantica de
 * range que a API do Sheets usa para A2:M e A{n}:M{n} (Inventario) e
 * A2:D e A{n}:D{n} (Locais) e A2:L e A{n}:L{n} (Emprestimos).
 * ------------------------------------------------------------------ */

/** Os locais que os itens de teste usam, ja cadastrados. */
const LOCAIS_PADRAO: unknown[][] = [
  ["Painel 1", "", "", "Painel 1"],
  ["Armario A", "", "", "Armario A"],
  ["Armario C", "", "", "Armario C"],
  ["Bancada 2", "", "", "Bancada 2"],
];

function criarPlanilhaFalsa(
  linhasIniciais: unknown[][] = [],
  locaisIniciais: unknown[][] = LOCAIS_PADRAO,
  emprestimosIniciais: unknown[][] = [],
) {
  // Indice 0 do array = linha 2 da planilha (linha 1 e o cabecalho).
  const linhas: unknown[][] = linhasIniciais.map((l) => [...l]);
  const locais: unknown[][] = locaisIniciais.map((l) => [...l]);
  const emprestimos: unknown[][] = emprestimosIniciais.map((l) => [...l]);
  const chamadas = { get: 0, append: 0, update: 0, batchUpdate: 0 };

  function escrever(range: string, valores: unknown[]) {
    const item = /^Inventario!A(\d+):M\d+$/.exec(range);
    const local = /^Locais!A(\d+):D\d+$/.exec(range);
    const emprestimo = /^Emprestimos!A(\d+):L\d+$/.exec(range);
    const casamento = item ?? local ?? emprestimo;
    assert.ok(casamento, `range inesperado: ${range}`);
    const numeroLinha = Number(casamento[1]);
    assert.ok(numeroLinha >= 2, "nao pode escrever sobre o cabecalho");
    const alvo = item ? linhas : local ? locais : emprestimos;
    alvo[numeroLinha - 2] = [...valores];
  }

  const duble = {
    spreadsheets: {
      values: {
        get: async (parametros: { range?: string }) => {
          chamadas.get += 1;
          const range = parametros.range ?? "";
          const alvo = range.startsWith("Locais!")
            ? locais
            : range.startsWith("Emprestimos!")
              ? emprestimos
              : linhas;
          return { data: { values: alvo.map((l) => [...(l ?? [])]) } };
        },
        append: async (parametros: {
          requestBody?: { values?: unknown[][] };
        }) => {
          chamadas.append += 1;
          for (const linha of parametros.requestBody?.values ?? []) {
            linhas.push([...linha]);
          }
          return { data: {} };
        },
        update: async (parametros: {
          range?: string;
          requestBody?: { values?: unknown[][] };
        }) => {
          chamadas.update += 1;
          escrever(
            parametros.range ?? "",
            parametros.requestBody?.values?.[0] ?? [],
          );
          return { data: {} };
        },
        batchUpdate: async (parametros: {
          requestBody?: { data?: { range?: string; values?: unknown[][] }[] };
        }) => {
          chamadas.batchUpdate += 1;
          for (const bloco of parametros.requestBody?.data ?? []) {
            escrever(bloco.range ?? "", bloco.values?.[0] ?? []);
          }
          return { data: {} };
        },
        clear: async (parametros: { range?: string }) => {
          const casamento = /^Locais!A(\d+):D\d+$/.exec(parametros.range ?? "");
          assert.ok(casamento, `clear inesperado: ${parametros.range}`);
          locais[Number(casamento[1]) - 2] = [];
          return { data: {} };
        },
      },
    },
  } as unknown as sheets_v4.Sheets;

  definirClienteParaTeste(duble);
  return { linhas, locais, emprestimos, chamadas };
}

/* ------------------------------------------------------------------ */

let passou = 0;
const pendentes: { nome: string; corpo: () => Promise<void> }[] = [];

function teste(nome: string, corpo: () => Promise<void>) {
  pendentes.push({ nome, corpo });
}

function linhaDe(nome: string, codigo: string, local: string): unknown[] {
  return [
    codigo, nome, "Ferramenta", "Geral / ADM", local,
    1, "un", "", "Funciona", "", "", "", "",
  ];
}

/* ------------------------------------------------------------------ */

teste("cadastra o primeiro item como 0001", async () => {
  const { linhas } = criarPlanilhaFalsa();
  const item = await criarItem(
    {
      nome: "Alicate de corte",
      categoria: "Ferramenta",
      projeto: "Geral / ADM",
      local: "Painel 1",
      quantidade: 1,
      unidade: "un",
      nivel: "",
      estado: "Funciona",
      patrimonio: "",
      observacoes: "",
    },
    "Miguel",
  );

  assert.equal(item.codigo, "0001");
  assert.equal(item.atualizadoPor, "Miguel");
  assert.ok(item.atualizadoEm, "precisa gravar o momento da alteracao");
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0][0], "0001");
  assert.equal(linhas[0][1], "Alicate de corte");
});

teste("cadastros seguidos nao repetem codigo", async () => {
  criarPlanilhaFalsa([linhaDe("Chave de fenda", "0001", "Painel 1")]);

  const base = {
    categoria: "Ferramenta",
    projeto: "Geral / ADM",
    local: "Painel 1",
    quantidade: 1,
    unidade: "un",
    nivel: "" as const,
    estado: "Funciona" as const,
    patrimonio: "",
    observacoes: "",
  };

  // Disparados juntos de proposito: e o caso que a fila de escrita protege.
  const [a, b, c] = await Promise.all([
    criarItem({ ...base, nome: "Item A" }, "Miguel"),
    criarItem({ ...base, nome: "Item B" }, "Luiza"),
    criarItem({ ...base, nome: "Item C" }, "Miguel"),
  ]);

  const codigos = [a.codigo, b.codigo, c.codigo].sort();
  assert.deepEqual(codigos, ["0002", "0003", "0004"]);
});

teste("edita a linha certa, sem tocar nas vizinhas", async () => {
  const { linhas } = criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
    linhaDe("Item dois", "0002", "Armario A"),
    linhaDe("Item tres", "0003", "Armario A"),
  ]);

  await atualizarItem("0002", { local: "Armario C" }, "Luiza");

  assert.equal(linhas[0][4], "Armario A", "linha de cima foi alterada");
  assert.equal(linhas[1][4], "Armario C");
  assert.equal(linhas[2][4], "Armario A", "linha de baixo foi alterada");
  assert.equal(linhas[1][1], "Item dois", "o nome nao devia ter mudado");
  assert.equal(linhas[1][12], "Luiza");
});

teste("edita a linha certa mesmo com linha em branco no meio", async () => {
  // Alguem apagou o conteudo de uma linha na mao, sem remover a linha.
  const { linhas } = criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
    [],
    linhaDe("Item tres", "0003", "Armario A"),
  ]);

  await atualizarItem("0003", { local: "Bancada 2" }, "Miguel");

  assert.equal(linhas[2][4], "Bancada 2", "escreveu na linha errada");
  assert.equal(linhas[0][4], "Armario A");
});

teste("o codigo nao muda nem se vier no corpo da edicao", async () => {
  const { linhas } = criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
  ]);

  const item = await atualizarItem(
    "0001",
    { nome: "Novo nome", codigo: "9999" } as never,
    "Miguel",
  );

  assert.equal(item.codigo, "0001");
  assert.equal(linhas[0][0], "0001");
  assert.equal(linhas[0][1], "Novo nome");
});

teste("editar item inexistente devolve erro proprio", async () => {
  criarPlanilhaFalsa([linhaDe("Item um", "0001", "Armario A")]);
  await assert.rejects(
    () => atualizarItem("0404", { nome: "Fantasma" }, "Miguel"),
    ItemNaoEncontrado,
  );
});

teste("baixa marca Descartado e mantem a linha", async () => {
  const { linhas } = criarPlanilhaFalsa([
    linhaDe("Fonte queimada", "0001", "Armario A"),
  ]);

  const item = await darBaixa("0001", "Miguel");

  assert.equal(item.estado, "Descartado");
  assert.equal(linhas.length, 1, "a linha nao pode sumir");
  assert.equal(linhas[0][0], "0001");
  assert.equal(linhas[0][8], "Descartado");
});

teste("codigo nao e reaproveitado depois da baixa", async () => {
  criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
    linhaDe("Item dois", "0002", "Armario A"),
  ]);

  await darBaixa("0002", "Miguel");

  const novo = await criarItem(
    {
      nome: "Item novo",
      categoria: "Ferramenta",
      projeto: "Geral / ADM",
      local: "Armario A",
      quantidade: 1,
      unidade: "un",
      nivel: "",
      estado: "Funciona",
      patrimonio: "",
      observacoes: "",
    },
    "Miguel",
  );

  assert.equal(novo.codigo, "0003", "uma etiqueta velha apontaria para ele");
});

teste("uma escrita que falha nao trava as seguintes", async () => {
  criarPlanilhaFalsa([linhaDe("Item um", "0001", "Armario A")]);

  await assert.rejects(() => atualizarItem("0404", { nome: "x" }, "Miguel"));

  const item = await atualizarItem("0001", { nome: "Funcionou" }, "Miguel");
  assert.equal(item.nome, "Funcionou");
});

teste("listar ignora linhas em branco", async () => {
  criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
    [],
    ["", "", "", ""],
    linhaDe("Item tres", "0003", "Armario A"),
  ]);

  const itens = await listarItens(true);
  assert.equal(itens.length, 2);
  assert.deepEqual(
    itens.map((i) => i.codigo),
    ["0001", "0003"],
  );
});

teste("o cache evita releitura, e a escrita o invalida", async () => {
  const { chamadas } = criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
  ]);

  await listarItens(true);
  const depoisDaPrimeira = chamadas.get;
  await listarItens();
  assert.equal(chamadas.get, depoisDaPrimeira, "deveria ter usado o cache");

  await atualizarItem("0001", { nome: "Mudou" }, "Miguel");
  const itens = await listarItens();
  assert.equal(itens[0].nome, "Mudou", "o cache ficou velho apos a escrita");
});

/* ---------------------------- locais ------------------------------ */

const ITEM_BASE = {
  categoria: "Ferramenta",
  projeto: "Geral / ADM",
  quantidade: 1,
  unidade: "un",
  nivel: "" as const,
  estado: "Funciona" as const,
  patrimonio: "",
  observacoes: "",
};

teste("nao cadastra item em local que nao existe", async () => {
  const { linhas } = criarPlanilhaFalsa();
  await assert.rejects(
    () => criarItem({ ...ITEM_BASE, nome: "X", local: "Armario Z" }, "Miguel"),
    LocalInvalido,
  );
  assert.equal(linhas.length, 0, "nada pode ter sido escrito");
});

teste("item sem local continua permitido", async () => {
  criarPlanilhaFalsa();
  const item = await criarItem({ ...ITEM_BASE, nome: "X", local: "" }, "Miguel");
  assert.equal(item.local, "");
});

teste("item legado fora da tabela edita sem trocar o local", async () => {
  const { linhas } = criarPlanilhaFalsa([
    linhaDe("Antigo", "0001", "Lugar que sumiu"),
  ]);
  await atualizarItem("0001", { nome: "Antigo editado", local: "Lugar que sumiu" }, "Miguel");
  assert.equal(linhas[0][1], "Antigo editado");
  await assert.rejects(
    () => atualizarItem("0001", { local: "Outro inexistente" }, "Miguel"),
    LocalInvalido,
  );
});

teste("cria local na linha seguinte a ultima, mesmo com buraco", async () => {
  const { locais } = criarPlanilhaFalsa([], [["Armario A", "", ""], [], ["Bancada 2", "", ""]]);
  const local = await criarLocal({ movel: "Armario B", zona: "Gaveta 3", observacoes: "" });
  assert.equal(local.nome, "Armario B / Gaveta 3");
  assert.equal(locais.length, 4, "nao pode sobrescrever nem pular linha");
  assert.deepEqual(locais[3], ["Armario B", "Gaveta 3", "", "Armario B / Gaveta 3"]);
  assert.deepEqual(locais[2], ["Bancada 2", "", ""]);
});

teste("recusa local duplicado ignorando acento e caixa", async () => {
  criarPlanilhaFalsa([], [["Armário B", "Gaveta 3", ""]]);
  await assert.rejects(
    () => criarLocal({ movel: "armario b", zona: "gaveta 3", observacoes: "" }),
    LocalInvalido,
  );
});

teste("renomear local reescreve so os itens dele", async () => {
  const { linhas, locais } = criarPlanilhaFalsa([
    linhaDe("Item um", "0001", "Armario A"),
    linhaDe("Item dois", "0002", "Bancada 2"),
    linhaDe("Item tres", "0003", "Armario A"),
  ]);

  const { local, itensAtualizados } = await editarLocal(
    "Armario A",
    { movel: "Armario A", zona: "Prateleira 1", observacoes: "" },
    "Luiza",
  );

  assert.equal(local.nome, "Armario A / Prateleira 1");
  assert.equal(itensAtualizados, 2);
  assert.equal(linhas[0][4], "Armario A / Prateleira 1");
  assert.equal(linhas[1][4], "Bancada 2", "item de outro local foi alterado");
  assert.equal(linhas[2][4], "Armario A / Prateleira 1");
  assert.equal(linhas[0][12], "Luiza");
  assert.equal(linhas[0][1], "Item um", "o resto do item nao muda");
  assert.deepEqual(locais[1], ["Armario A", "Prateleira 1", "", "Armario A / Prateleira 1"]);

  const lidos = await listarLocais();
  assert.ok(lidos.some((l) => l.nome === "Armario A / Prateleira 1"));
});

teste("renomear para nome ja usado e recusado", async () => {
  criarPlanilhaFalsa();
  await assert.rejects(
    () => editarLocal("Armario A", { movel: "Armario C", zona: "", observacoes: "" }, "Miguel"),
    LocalInvalido,
  );
});

teste("nao remove local com item ativo", async () => {
  const { locais } = criarPlanilhaFalsa([linhaDe("Item um", "0001", "Armario A")]);
  await assert.rejects(() => removerLocal("Armario A"), LocalInvalido);
  assert.deepEqual(locais[1], ["Armario A", "", "", "Armario A"]);
});

teste("remove local que so tem descartados", async () => {
  const { locais } = criarPlanilhaFalsa([linhaDe("Item um", "0001", "Armario A")]);
  await darBaixa("0001", "Miguel");
  await removerLocal("Armario A");
  assert.deepEqual(locais[1], []);
  const lidos = await listarLocais();
  assert.ok(!lidos.some((l) => l.nome === "Armario A"));
});

/* -------------------------- emprestimos --------------------------- */

function itemContavel(codigo: string, quantidade: number, categoria = "Componente eletronico") {
  return [codigo, "Servo MG996R", categoria, "Braco Robotico", "Armario A",
    quantidade, "un", "", "Funciona", "", "", "", ""];
}

const PEDIDO = {
  codigo: "0001",
  quantidade: 1,
  pessoa: "Luiza",
  contato: "19 99999-0000",
  devolverAte: "2026-10-30",
  observacoes: "",
};

teste("empresta e grava a linha com id sequencial", async () => {
  const { emprestimos } = criarPlanilhaFalsa([itemContavel("0001", 10)]);
  const a = await emprestar({ ...PEDIDO, quantidade: 3 }, "Miguel");
  const b = await emprestar({ ...PEDIDO, quantidade: 2 }, "Miguel");

  assert.equal(a.id, "E0001");
  assert.equal(b.id, "E0002");
  assert.equal(emprestimos.length, 2);
  assert.equal(emprestimos[0][1], "0001");
  assert.equal(emprestimos[0][3], 3);
  assert.equal(emprestimos[0][7], "2026-10-30", "a data precisa ir como texto");
  assert.equal(emprestimos[0][8], "", "acabou de sair: nao tem devolucao");
  assert.equal(emprestimos[0][10], "Miguel");
});

teste("nao empresta mais do que esta disponivel", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 5)]);
  await emprestar({ ...PEDIDO, quantidade: 4 }, "Miguel");
  await assert.rejects(
    () => emprestar({ ...PEDIDO, quantidade: 2 }, "Miguel"),
    EmprestimoInvalido,
  );
  // 1 ainda cabe.
  await emprestar({ ...PEDIDO, quantidade: 1 }, "Miguel");
});

teste("emprestimos simultaneos nao estouram o estoque", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 2)]);
  const resultados = await Promise.allSettled([
    emprestar({ ...PEDIDO, quantidade: 1 }, "A"),
    emprestar({ ...PEDIDO, quantidade: 1 }, "B"),
    emprestar({ ...PEDIDO, quantidade: 1 }, "C"),
  ]);
  const ok = resultados.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 2, "so havia 2 unidades");
});

teste("devolucao libera as unidades", async () => {
  const { emprestimos } = criarPlanilhaFalsa([itemContavel("0001", 1)]);
  const e = await emprestar(PEDIDO, "Miguel");
  await assert.rejects(() => emprestar(PEDIDO, "Miguel"), EmprestimoInvalido);

  const devolvido = await devolver(e.id, "Luiza");
  assert.ok(devolvido.devolvidoEm);
  assert.equal(emprestimos[0][8], devolvido.devolvidoEm);
  assert.equal(emprestimos[0][11], "Luiza");
  assert.equal(emprestimos[0][4], "Luiza", "o resto da linha nao muda");

  await emprestar(PEDIDO, "Miguel");
});

teste("nao devolve duas vezes", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 1)]);
  const e = await emprestar(PEDIDO, "Miguel");
  await devolver(e.id, "Miguel");
  await assert.rejects(() => devolver(e.id, "Miguel"), EmprestimoInvalido);
});

teste("consumivel nao e emprestado", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 100, "Consumivel")]);
  await assert.rejects(() => emprestar(PEDIDO, "Miguel"), EmprestimoInvalido);
});

teste("emprestimo exige quem esta levando", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 1)]);
  await assert.rejects(
    () => emprestar({ ...PEDIDO, pessoa: "  " }, "Miguel"),
    EmprestimoInvalido,
  );
});

teste("nao da baixa em item emprestado", async () => {
  const { linhas } = criarPlanilhaFalsa([itemContavel("0001", 1)]);
  await emprestar(PEDIDO, "Miguel");
  await assert.rejects(() => darBaixa("0001", "Miguel"), EmprestimoInvalido);
  assert.equal(linhas[0][8], "Funciona");
});

teste("quantidade nao fica abaixo do emprestado", async () => {
  criarPlanilhaFalsa([itemContavel("0001", 5)]);
  await emprestar({ ...PEDIDO, quantidade: 3 }, "Miguel");
  await assert.rejects(
    () => atualizarItem("0001", { quantidade: 2 }, "Miguel"),
    EmprestimoInvalido,
  );
  await atualizarItem("0001", { quantidade: 3 }, "Miguel");
});

teste("le data digitada na planilha (numero de serie)", async () => {
  criarPlanilhaFalsa(
    [itemContavel("0001", 1)],
    LOCAIS_PADRAO,
    // 46325 = 30/10/2026 no calendario do Sheets.
    [["E0001", "0001", "Servo", 1, "Luiza", "", "2026-10-16T12:00:00.000Z", 46325, "", "", "Miguel", ""]],
  );
  const [e] = await listarEmprestimos(true);
  assert.equal(e.devolverAte, "2026-10-30");
});

/* ------------------------------------------------------------------ */

console.log("\nescrita (planilha falsa)\n");

for (const { nome, corpo } of pendentes) {
  try {
    await corpo();
    passou += 1;
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    console.error(`  FALHOU  ${nome}`);
    console.error(`         ${(erro as Error).message}`);
    process.exitCode = 1;
  }
}

definirClienteParaTeste(null);

console.log(
  `\n${passou} teste(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`,
);

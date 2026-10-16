/**
 * Testes das funcoes de conversao e geracao de codigo.
 *
 *   npx tsx scripts/testar-mapeamento.ts
 *
 * Sem dependencia de rede nem de credencial: so logica pura.
 */

import assert from "node:assert/strict";
import {
  CodigosEsgotados,
  emprestimoParaLinha,
  estaAtrasado,
  itemParaLinha,
  linhaParaEmprestimo,
  linhaParaItem,
  linhaParaLocal,
  localParaLinha,
  nomeDoLocal,
  proximoCodigo,
  proximoIdEmprestimo,
  quantidadeEmprestada,
  separarLocal,
  textoDeData,
} from "../src/lib/mapeamento";
import {
  CABECALHO,
  CABECALHO_EMPRESTIMO,
  COLUNAS,
  COLUNAS_EMPRESTIMO,
  type Emprestimo,
  type Item,
} from "../src/lib/types";

let passou = 0;

function teste(nome: string, corpo: () => void) {
  try {
    corpo();
    passou += 1;
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    console.error(`  FALHOU  ${nome}`);
    console.error(`         ${(erro as Error).message}`);
    process.exitCode = 1;
  }
}

console.log("\nmapeamento\n");

teste("COLUNAS e CABECALHO tem o mesmo tamanho", () => {
  assert.equal(
    COLUNAS.length,
    CABECALHO.length,
    "a planilha ficaria desalinhada do modelo",
  );
});

teste("le uma linha completa na ordem certa", () => {
  const item = linhaParaItem([
    "0042",
    "Multimetro Minipa ET-1002",
    "Ferramenta",
    "Geral / ADM",
    "Armario B / Gaveta 3",
    2,
    "un",
    "",
    "Funciona",
    "FEM-99812",
    "Ponta de prova vermelha folgada",
    "2026-10-16T12:00:00.000Z",
    "Miguel",
  ]);

  assert.equal(item.codigo, "0042");
  assert.equal(item.nome, "Multimetro Minipa ET-1002");
  assert.equal(item.local, "Armario B / Gaveta 3");
  assert.equal(item.quantidade, 2);
  assert.equal(item.estado, "Funciona");
  assert.equal(item.patrimonio, "FEM-99812");
  assert.equal(item.atualizadoPor, "Miguel");
});

teste("recompoe o zero a esquerda que o Sheets comeu", () => {
  // Se a coluna A for reformatada como numero, "0007" volta como 7.
  assert.equal(linhaParaItem([7, "Alicate"]).codigo, "0007");
  assert.equal(linhaParaItem(["42", "Chave"]).codigo, "0042");
});

teste("linha vazia nao vira codigo falso", () => {
  assert.equal(linhaParaItem([]).codigo, "");
  assert.equal(linhaParaItem(["", ""]).codigo, "");
});

teste("campos ausentes viram vazio, nao undefined", () => {
  const item = linhaParaItem(["0001", "Parafuso M3"]);
  assert.equal(item.local, "");
  assert.equal(item.observacoes, "");
  assert.equal(item.quantidade, 0);
  assert.equal(item.estado, "Nao testado", "estado precisa de um padrao");
});

teste("aceita quantidade com virgula decimal", () => {
  assert.equal(linhaParaItem(["0001", "Fio", "", "", "", "2,5"]).quantidade, 2.5);
});

teste("ida e volta preserva o item", () => {
  const original: Item = {
    codigo: "0123",
    nome: "Servo MG996R",
    categoria: "Componente eletronico",
    projeto: "Braco Robotico",
    local: "Gaveteiro 2 / Gaveta 7",
    quantidade: 4,
    unidade: "un",
    nivel: "",
    estado: "Funciona",
    patrimonio: "",
    observacoes: "Dois com folga no eixo",
    atualizadoEm: "2026-10-16T12:00:00.000Z",
    atualizadoPor: "Luiza",
  };

  const volta = linhaParaItem(itemParaLinha(original));
  assert.deepEqual(volta, original);
});

teste("a linha gerada tem exatamente uma celula por coluna", () => {
  const linha = itemParaLinha(linhaParaItem(["0001", "Teste"]));
  assert.equal(linha.length, COLUNAS.length);
});

console.log("\nproximoCodigo\n");

teste("comeca em 0001 na planilha vazia", () => {
  assert.equal(proximoCodigo([]), "0001");
});

teste("continua do maior codigo existente", () => {
  assert.equal(
    proximoCodigo([{ codigo: "0001" }, { codigo: "0009" }, { codigo: "0003" }]),
    "0010",
  );
});

teste("nao reaproveita codigo de buraco no meio", () => {
  // 0002 foi descartado e a linha removida na mao: o proximo ainda e 0004.
  assert.equal(proximoCodigo([{ codigo: "0001" }, { codigo: "0003" }]), "0004");
});

teste("ignora codigo corrompido sem travar o cadastro", () => {
  assert.equal(proximoCodigo([{ codigo: "0005" }, { codigo: "lixo" }]), "0006");
});

teste("avisa quando os 4 digitos acabam", () => {
  assert.throws(() => proximoCodigo([{ codigo: "9999" }]), CodigosEsgotados);
});

teste("9998 ainda cabe", () => {
  assert.equal(proximoCodigo([{ codigo: "9998" }]), "9999");
});

console.log("\nlocais\n");

teste("nome do local junta movel e zona", () => {
  assert.equal(nomeDoLocal("Armario B", "Gaveta 3"), "Armario B / Gaveta 3");
  assert.equal(nomeDoLocal(" Bancada 1 ", ""), "Bancada 1");
  assert.equal(nomeDoLocal("", "Gaveta 3"), "", "zona sem movel nao e local");
});

teste("separa o local no primeiro separador", () => {
  assert.deepEqual(separarLocal("Armario B / Gaveta 3"), {
    movel: "Armario B",
    zona: "Gaveta 3",
  });
  assert.deepEqual(separarLocal("Bancada 1"), { movel: "Bancada 1", zona: "" });
  assert.deepEqual(separarLocal("Armario B/Gaveta 3"), {
    movel: "Armario B",
    zona: "Gaveta 3",
  });
  assert.deepEqual(separarLocal("Estante / Nivel 2 / Caixa A"), {
    movel: "Estante",
    zona: "Nivel 2 / Caixa A",
  });
});

teste("ida e volta preserva o local", () => {
  const linha = localParaLinha({ movel: "Gaveteiro 2", zona: "Gaveta 7", observacoes: "Parafusos" });
  assert.deepEqual(linha, ["Gaveteiro 2", "Gaveta 7", "Parafusos", "Gaveteiro 2 / Gaveta 7"]);
  assert.deepEqual(linhaParaLocal(linha), {
    movel: "Gaveteiro 2",
    zona: "Gaveta 7",
    observacoes: "Parafusos",
    nome: "Gaveteiro 2 / Gaveta 7",
  });
});

teste("le o nome de movel e zona, nao da coluna Nome gravada", () => {
  // Alguem trocou a zona direto na planilha e a coluna D ficou velha.
  const local = linhaParaLocal(["Armario B", "Gaveta 4", "", "Armario B / Gaveta 3"]);
  assert.equal(local.nome, "Armario B / Gaveta 4");
});

console.log("\nemprestimos\n");

teste("COLUNAS_EMPRESTIMO e CABECALHO_EMPRESTIMO tem o mesmo tamanho", () => {
  assert.equal(COLUNAS_EMPRESTIMO.length, CABECALHO_EMPRESTIMO.length);
});

teste("ida e volta preserva o emprestimo", () => {
  const original: Emprestimo = {
    id: "E0007",
    codigo: "0042",
    item: "Multimetro",
    quantidade: 2,
    pessoa: "Luiza",
    contato: "ra 123456",
    retiradoEm: "2026-10-16T12:00:00.000Z",
    devolverAte: "2026-10-30",
    devolvidoEm: "",
    observacoes: "",
    registradoPor: "Miguel",
    devolucaoRegistradaPor: "",
  };
  assert.deepEqual(linhaParaEmprestimo(emprestimoParaLinha(original)), original);
});

teste("data em numero de serie do Sheets vira AAAA-MM-DD", () => {
  assert.equal(textoDeData(46325), "2026-10-30");
  assert.equal(textoDeData("2026-10-30"), "2026-10-30");
  assert.equal(textoDeData(""), "");
});

teste("proximo id de emprestimo continua do maior", () => {
  assert.equal(proximoIdEmprestimo([]), "E0001");
  assert.equal(proximoIdEmprestimo([{ id: "E0003" }, { id: "E0010" }]), "E0011");
});

teste("so emprestimos abertos contam como fora", () => {
  const lista = [
    { codigo: "0001", quantidade: 2, devolvidoEm: "" },
    { codigo: "0001", quantidade: 5, devolvidoEm: "2026-10-01T00:00:00Z" },
    { codigo: "0002", quantidade: 1, devolvidoEm: "" },
  ];
  assert.equal(quantidadeEmprestada("0001", lista), 2);
});

teste("atraso: so aberto, com prazo, e vencido", () => {
  assert.equal(estaAtrasado({ devolverAte: "2026-10-15", devolvidoEm: "" }, "2026-10-16"), true);
  assert.equal(estaAtrasado({ devolverAte: "2026-10-16", devolvidoEm: "" }, "2026-10-16"), false, "vence hoje nao e atraso");
  assert.equal(estaAtrasado({ devolverAte: "", devolvidoEm: "" }, "2026-10-16"), false);
  assert.equal(estaAtrasado({ devolverAte: "2026-10-01", devolvidoEm: "x" }, "2026-10-16"), false);
});

console.log(
  `\n${passou} teste(s) passaram${process.exitCode ? ", com falhas acima" : ""}.\n`,
);

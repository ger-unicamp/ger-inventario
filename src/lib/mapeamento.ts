/**
 * Conversao entre linha da planilha e objeto Item, e geracao de codigo.
 *
 * Separado de `sheets.ts` de proposito: este modulo e puro, nao toca a rede
 * e nao depende de `server-only`, entao da para testar direto com `tsx`.
 * E aqui que mora o risco de quebrar tudo em silencio — ordem das colunas e
 * zeros a esquerda.
 */

import {
  COLUNAS,
  COLUNAS_EMPRESTIMO,
  COLUNAS_LOCAL,
  type Emprestimo,
  type Estado,
  type Item,
  type Local,
  type Nivel,
  SEPARADOR_LOCAL,
} from "./types";

export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

export function linhaParaItem(linha: unknown[]): Item {
  const campo = (indice: number) => texto(linha[indice]);
  const bruta = campo(COLUNAS.indexOf("quantidade")).replace(",", ".");
  const quantidade = Number(bruta);
  const codigo = campo(COLUNAS.indexOf("codigo"));

  return {
    codigo: codigo ? codigo.padStart(4, "0") : "",
    nome: campo(COLUNAS.indexOf("nome")),
    categoria: campo(COLUNAS.indexOf("categoria")),
    projeto: campo(COLUNAS.indexOf("projeto")),
    local: campo(COLUNAS.indexOf("local")),
    quantidade: bruta !== "" && Number.isFinite(quantidade) ? quantidade : 0,
    unidade: campo(COLUNAS.indexOf("unidade")),
    nivel: campo(COLUNAS.indexOf("nivel")) as Nivel,
    estado: (campo(COLUNAS.indexOf("estado")) || "Nao testado") as Estado,
    patrimonio: campo(COLUNAS.indexOf("patrimonio")),
    observacoes: campo(COLUNAS.indexOf("observacoes")),
    atualizadoEm: campo(COLUNAS.indexOf("atualizadoEm")),
    atualizadoPor: campo(COLUNAS.indexOf("atualizadoPor")),
  };
}

export function itemParaLinha(item: Item): (string | number)[] {
  return COLUNAS.map((coluna) => {
    const valor = item[coluna];
    return typeof valor === "number" ? valor : texto(valor);
  });
}

export class CodigosEsgotados extends Error {
  constructor() {
    super(
      "Os codigos de 4 digitos acabaram (chegou em 9999). Amplie o formato antes de cadastrar mais itens.",
    );
    this.name = "CodigosEsgotados";
  }
}

/**
 * Proximo codigo livre: sempre maior que todos os existentes.
 *
 * Nunca reaproveita codigo de item descartado. Reaproveitar faria uma
 * etiqueta velha, ainda colada em algum objeto no fundo de um armario,
 * apontar para um item diferente.
 */
export function proximoCodigo(itens: Pick<Item, "codigo">[]): string {
  const maior = itens.reduce((max, item) => {
    const numero = Number.parseInt(item.codigo, 10);
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);

  const proximo = maior + 1;
  if (proximo > 9999) throw new CodigosEsgotados();
  return String(proximo).padStart(4, "0");
}

/* ------------------------------------------------------------------ *
 * Locais
 * ------------------------------------------------------------------ */

/** Nome do local como aparece no item: "Movel / Zona", ou so "Movel". */
export function nomeDoLocal(movel: string, zona: string): string {
  const m = texto(movel);
  const z = texto(zona);
  if (!m) return "";
  return z ? `${m}${SEPARADOR_LOCAL}${z}` : m;
}

/**
 * Divide um nome de local no primeiro separador. Usado para migrar os
 * locais em texto livre que ja estavam nos itens.
 */
export function separarLocal(nome: string): { movel: string; zona: string } {
  const limpo = texto(nome);
  const posicao = limpo.indexOf(SEPARADOR_LOCAL.trim());
  if (posicao === -1) return { movel: limpo, zona: "" };
  return {
    movel: limpo.slice(0, posicao).trim(),
    zona: limpo.slice(posicao + 1).trim(),
  };
}

export function linhaParaLocal(linha: unknown[]): Local {
  const campo = (chave: (typeof COLUNAS_LOCAL)[number]) =>
    texto(linha[COLUNAS_LOCAL.indexOf(chave)]);
  const movel = campo("movel");
  const zona = campo("zona");
  return {
    movel,
    zona,
    observacoes: campo("observacoes"),
    // Ignora a coluna Nome gravada: alguem pode ter editado movel ou zona
    // direto na planilha sem atualizar o nome.
    nome: nomeDoLocal(movel, zona),
  };
}

export function localParaLinha(
  local: Pick<Local, "movel" | "zona" | "observacoes">,
): string[] {
  const completo = { ...local, nome: nomeDoLocal(local.movel, local.zona) };
  return COLUNAS_LOCAL.map((coluna) => texto(completo[coluna]));
}

/* ------------------------------------------------------------------ *
 * Emprestimos
 * ------------------------------------------------------------------ */

/**
 * Data "AAAA-MM-DD". Se alguem digitou a data direto na planilha, o Sheets
 * guarda como numero de serie (dias desde 30/12/1899) e e isso que volta
 * com UNFORMATTED_VALUE.
 */
export function textoDeData(valor: unknown): string {
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return texto(valor);
}

export function linhaParaEmprestimo(linha: unknown[]): Emprestimo {
  const bruto = (chave: (typeof COLUNAS_EMPRESTIMO)[number]) =>
    linha[COLUNAS_EMPRESTIMO.indexOf(chave)];
  const campo = (chave: (typeof COLUNAS_EMPRESTIMO)[number]) => texto(bruto(chave));
  const quantidade = Number(campo("quantidade").replace(",", "."));
  const codigo = campo("codigo");

  return {
    id: campo("id"),
    codigo: codigo ? codigo.padStart(4, "0") : "",
    item: campo("item"),
    quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1,
    pessoa: campo("pessoa"),
    contato: campo("contato"),
    retiradoEm: campo("retiradoEm"),
    devolverAte: textoDeData(bruto("devolverAte")),
    devolvidoEm: campo("devolvidoEm"),
    observacoes: campo("observacoes"),
    registradoPor: campo("registradoPor"),
    devolucaoRegistradaPor: campo("devolucaoRegistradaPor"),
  };
}

export function emprestimoParaLinha(emprestimo: Emprestimo): (string | number)[] {
  return COLUNAS_EMPRESTIMO.map((coluna) => {
    const valor = emprestimo[coluna];
    return typeof valor === "number" ? valor : texto(valor);
  });
}

/** Proximo id "E0001": sempre maior que todos, como o codigo dos itens. */
export function proximoIdEmprestimo(emprestimos: Pick<Emprestimo, "id">[]): string {
  const maior = emprestimos.reduce((max, e) => {
    const numero = Number.parseInt(e.id.replace(/^E/i, ""), 10);
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);
  return `E${String(maior + 1).padStart(4, "0")}`;
}

/** Unidades do item que estao fora agora, somando emprestimos abertos. */
export function quantidadeEmprestada(
  codigo: string,
  emprestimos: Pick<Emprestimo, "codigo" | "quantidade" | "devolvidoEm">[],
): number {
  return emprestimos
    .filter((e) => e.codigo === codigo && !e.devolvidoEm)
    .reduce((soma, e) => soma + e.quantidade, 0);
}

/** Emprestimo aberto com prazo vencido. `hoje` em "AAAA-MM-DD". */
export function estaAtrasado(
  emprestimo: Pick<Emprestimo, "devolverAte" | "devolvidoEm">,
  hoje: string,
): boolean {
  return !emprestimo.devolvidoEm && !!emprestimo.devolverAte && emprestimo.devolverAte < hoje;
}

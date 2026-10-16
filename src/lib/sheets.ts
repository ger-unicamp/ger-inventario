import "server-only";

import { google, type sheets_v4 } from "googleapis";
import {
  emprestimoParaLinha,
  itemParaLinha,
  linhaParaEmprestimo,
  linhaParaItem,
  linhaParaLocal,
  localParaLinha,
  nomeDoLocal,
  proximoCodigo,
  proximoIdEmprestimo,
  quantidadeEmprestada,
} from "./mapeamento";
import {
  CABECALHO,
  type Emprestimo,
  type Item,
  type Local,
  type NovoEmprestimo,
  type NovoItem,
  type NovoLocal,
  podeEmprestar,
} from "./types";
import { normalizar } from "./utils";

/* ------------------------------------------------------------------ *
 * Configuracao
 * ------------------------------------------------------------------ */

const ESCOPO = ["https://www.googleapis.com/auth/spreadsheets"];

/** Segundos que a leitura fica em cache antes de bater na API de novo. */
const TTL_CACHE_MS = 20_000;

function env(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Variavel de ambiente ${nome} nao definida. Veja o .env.example e o README.`,
    );
  }
  return valor;
}

export function idPlanilha(): string {
  return env("GOOGLE_SHEETS_ID");
}

export function nomeAba(): string {
  return process.env.GOOGLE_SHEETS_ABA || "Inventario";
}

export function nomeAbaLocais(): string {
  return process.env.GOOGLE_SHEETS_ABA_LOCAIS || "Locais";
}

export function nomeAbaEmprestimos(): string {
  return process.env.GOOGLE_SHEETS_ABA_EMPRESTIMOS || "Emprestimos";
}

/* ------------------------------------------------------------------ *
 * Cliente autenticado
 * ------------------------------------------------------------------ */

let clienteCache: sheets_v4.Sheets | null = null;

export function cliente(): sheets_v4.Sheets {
  if (clienteCache) return clienteCache;

  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // A chave privada vem do JSON da service account. No .env ela fica em uma
  // linha so, com as quebras escapadas como \n — por isso o replace.
  const chave = env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: chave,
    scopes: ESCOPO,
  });

  clienteCache = google.sheets({ version: "v4", auth });
  return clienteCache;
}

/**
 * Troca o cliente do Sheets por um duble.
 *
 * Existe para os testes do caminho de escrita, que precisam rodar sem
 * credencial e sem rede. Nao use em producao.
 */
export function definirClienteParaTeste(duble: sheets_v4.Sheets | null): void {
  clienteCache = duble;
  invalidarCache();
}

/* ------------------------------------------------------------------ *
 * Leitura com cache
 * ------------------------------------------------------------------ */

interface Snapshot {
  itens: Item[];
  /** codigo -> numero da linha na planilha (1-based, cabecalho = 1). */
  linhaPorCodigo: Map<string, number>;
  locais: Local[];
  /** nome do local -> numero da linha na aba Locais. */
  linhaPorLocal: Map<string, number>;
  /** Primeira linha depois da ultima ocupada da aba Locais. */
  proximaLinhaLocal: number;
  emprestimos: Emprestimo[];
  /** id do emprestimo -> numero da linha na aba Emprestimos. */
  linhaPorEmprestimo: Map<string, number>;
  proximaLinhaEmprestimo: number;
  lidoEm: number;
}

let snapshot: Snapshot | null = null;

export function invalidarCache(): void {
  snapshot = null;
}

async function lerAba(range: string): Promise<unknown[][]> {
  const resposta = await cliente().spreadsheets.values.get({
    spreadsheetId: idPlanilha(),
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return resposta.data.values ?? [];
}

/**
 * Planilha antiga, antes do init-sheet criar a aba: segue com a aba vazia
 * em vez de derrubar a leitura dos itens. O /api/status avisa.
 */
function abaOpcional(range: string): Promise<unknown[][]> {
  return lerAba(range).catch((erro: Error) => {
    if (/Unable to parse range/i.test(erro.message)) return [];
    throw erro;
  });
}

async function carregar(): Promise<Snapshot> {
  const [linhas, linhasLocais, linhasEmprestimos] = await Promise.all([
    lerAba(`${nomeAba()}!A2:M`),
    abaOpcional(`${nomeAbaLocais()}!A2:D`),
    abaOpcional(`${nomeAbaEmprestimos()}!A2:L`),
  ]);

  const itens: Item[] = [];
  const linhaPorCodigo = new Map<string, number>();

  linhas.forEach((linha, indice) => {
    const item = linhaParaItem(linha);
    // Linha em branco no meio da planilha: ignora, mas nao desalinha o indice.
    if (!item.codigo && !item.nome) return;
    itens.push(item);
    linhaPorCodigo.set(item.codigo, indice + 2);
  });

  const locais: Local[] = [];
  const linhaPorLocal = new Map<string, number>();

  linhasLocais.forEach((linha, indice) => {
    const local = linhaParaLocal(linha);
    if (!local.nome || linhaPorLocal.has(local.nome)) return;
    locais.push(local);
    linhaPorLocal.set(local.nome, indice + 2);
  });

  const emprestimos: Emprestimo[] = [];
  const linhaPorEmprestimo = new Map<string, number>();

  linhasEmprestimos.forEach((linha, indice) => {
    const emprestimo = linhaParaEmprestimo(linha);
    if (!emprestimo.id || linhaPorEmprestimo.has(emprestimo.id)) return;
    emprestimos.push(emprestimo);
    linhaPorEmprestimo.set(emprestimo.id, indice + 2);
  });

  return {
    itens,
    linhaPorCodigo,
    locais,
    linhaPorLocal,
    proximaLinhaLocal: linhasLocais.length + 2,
    emprestimos,
    linhaPorEmprestimo,
    proximaLinhaEmprestimo: linhasEmprestimos.length + 2,
    lidoEm: Date.now(),
  };
}

async function snapshotEmCache(forcar: boolean): Promise<Snapshot> {
  if (!forcar && snapshot && Date.now() - snapshot.lidoEm < TTL_CACHE_MS) {
    return snapshot;
  }
  snapshot = await carregar();
  return snapshot;
}

export async function listarItens(forcar = false): Promise<Item[]> {
  return (await snapshotEmCache(forcar)).itens;
}

export async function listarLocais(forcar = false): Promise<Local[]> {
  return (await snapshotEmCache(forcar)).locais;
}

export async function listarEmprestimos(forcar = false): Promise<Emprestimo[]> {
  return (await snapshotEmCache(forcar)).emprestimos;
}

/** Tudo da mesma leitura, para a tela nao ver as abas fora de sincronia. */
export async function listarTudo(
  forcar = false,
): Promise<{ itens: Item[]; locais: Local[]; emprestimos: Emprestimo[] }> {
  const { itens, locais, emprestimos } = await snapshotEmCache(forcar);
  return { itens, locais, emprestimos };
}

async function snapshotAtual(): Promise<Snapshot> {
  snapshot = await carregar();
  return snapshot;
}

/* ------------------------------------------------------------------ *
 * Escrita
 *
 * Toda escrita passa por uma fila de um slot. Sem isso, dois cadastros
 * simultaneos podem gerar o mesmo codigo ou escrever na mesma linha.
 * ------------------------------------------------------------------ */

let fila: Promise<unknown> = Promise.resolve();

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarefa, tarefa);
  // A fila nunca rejeita, senao uma falha travaria todas as escritas seguintes.
  fila = resultado.catch(() => undefined);
  return resultado;
}

function agora(): string {
  return new Date().toISOString();
}

/** Item so pode apontar para local cadastrado (ou ficar sem local). */
function exigirLocal(local: string, locais: Local[]): void {
  if (local && !locais.some((l) => l.nome === local)) {
    throw new LocalInvalido(
      `O local "${local}" nao esta cadastrado. Cadastre-o na aba Locais primeiro.`,
    );
  }
}

export async function criarItem(
  dados: NovoItem,
  autor: string,
): Promise<Item> {
  return emFila(async () => {
    const { itens, locais } = await snapshotAtual();
    exigirLocal(dados.local, locais);
    const item: Item = {
      ...dados,
      codigo: proximoCodigo(itens),
      atualizadoEm: agora(),
      atualizadoPor: autor,
    };

    await cliente().spreadsheets.values.append({
      spreadsheetId: idPlanilha(),
      range: `${nomeAba()}!A:M`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [itemParaLinha(item)] },
    });

    invalidarCache();
    return item;
  });
}

export async function atualizarItem(
  codigo: string,
  dados: Partial<NovoItem>,
  autor: string,
): Promise<Item> {
  return emFila(async () => {
    const { itens, linhaPorCodigo, locais, emprestimos } = await snapshotAtual();
    const linha = linhaPorCodigo.get(codigo);
    const atual = itens.find((item) => item.codigo === codigo);

    if (!linha || !atual) {
      throw new ItemNaoEncontrado(codigo);
    }

    const fora = quantidadeEmprestada(codigo, emprestimos);
    if (fora > 0 && dados.estado === "Descartado" && atual.estado !== "Descartado") {
      throw new EmprestimoInvalido(
        `O item ${codigo} tem ${fora} ${fora === 1 ? "unidade emprestada" : "unidades emprestadas"}. Registre a devolucao antes de dar baixa.`,
      );
    }
    if (dados.quantidade !== undefined && dados.quantidade < fora) {
      throw new EmprestimoInvalido(
        `A quantidade nao pode ficar abaixo de ${fora}: e o que esta emprestado agora.`,
      );
    }
    // So valida se o local mudou: item antigo com local fora da tabela
    // continua editavel sem obrigar a corrigir o local junto.
    if (dados.local !== undefined && dados.local !== atual.local) {
      exigirLocal(dados.local, locais);
    }

    const item: Item = {
      ...atual,
      ...dados,
      codigo: atual.codigo, // o codigo esta colado no objeto: nunca muda
      atualizadoEm: agora(),
      atualizadoPor: autor,
    };

    await cliente().spreadsheets.values.update({
      spreadsheetId: idPlanilha(),
      range: `${nomeAba()}!A${linha}:M${linha}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [itemParaLinha(item)] },
    });

    invalidarCache();
    return item;
  });
}

/**
 * Baixa de item. Nao apaga a linha: marca como Descartado.
 *
 * Apagar a linha reaproveitaria o codigo e quebraria o rastro de itens com
 * plaqueta de patrimonio da Unicamp, que precisam de baixa formal. Para sumir
 * de vez com um registro, apague a linha na propria planilha.
 */
export async function darBaixa(codigo: string, autor: string): Promise<Item> {
  return atualizarItem(codigo, { estado: "Descartado" }, autor);
}

export class ItemNaoEncontrado extends Error {
  constructor(codigo: string) {
    super(`Item ${codigo} nao encontrado na planilha.`);
    this.name = "ItemNaoEncontrado";
  }
}

/* ------------------------------------------------------------------ *
 * Escrita de locais
 *
 * Cada linha da aba Locais e escrita inteira (A:D), com o nome ja
 * calculado em D. Ver COLUNAS_LOCAL em types.ts.
 * ------------------------------------------------------------------ */

/** Erro de regra (local duplicado, em uso, inexistente). Vira HTTP 400/409. */
export class LocalInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "LocalInvalido";
  }
}

export class LocalNaoEncontrado extends Error {
  constructor(nome: string) {
    super(`Local "${nome}" nao encontrado na aba Locais.`);
    this.name = "LocalNaoEncontrado";
  }
}

function limparLocal(dados: NovoLocal): NovoLocal {
  return {
    movel: dados.movel.trim(),
    zona: dados.zona.trim(),
    observacoes: dados.observacoes.trim(),
  };
}

function exigirNomeLivre(nome: string, locais: Local[], ignorar?: string): void {
  if (!nome) throw new LocalInvalido("O movel do local e obrigatorio.");
  const alvo = normalizar(nome);
  // Compara sem acento e sem caixa: "Armario B" e "armário b" sao o mesmo lugar.
  const repetido = locais.find(
    (l) => l.nome !== ignorar && normalizar(l.nome) === alvo,
  );
  if (repetido) {
    throw new LocalInvalido(`Ja existe o local "${repetido.nome}".`);
  }
}

export async function criarLocal(dados: NovoLocal): Promise<Local> {
  return emFila(async () => {
    const { locais, proximaLinhaLocal } = await snapshotAtual();
    const limpo = limparLocal(dados);
    const local: Local = { ...limpo, nome: nomeDoLocal(limpo.movel, limpo.zona) };
    exigirNomeLivre(local.nome, locais);

    // update numa linha calculada, e nao append: o append do Sheets procura
    // "a tabela" no range por heuristica, e linha limpa no meio a confunde.
    await cliente().spreadsheets.values.update({
      spreadsheetId: idPlanilha(),
      range: `${nomeAbaLocais()}!A${proximaLinhaLocal}:D${proximaLinhaLocal}`,
      valueInputOption: "RAW",
      requestBody: { values: [localParaLinha(local)] },
    });

    invalidarCache();
    return local;
  });
}

/**
 * Renomeia (ou edita) um local e reescreve, na mesma operacao, a coluna
 * Local de todos os itens que estavam nele — inclusive descartados, para
 * o rastro continuar apontando para um lugar que existe.
 */
export async function editarLocal(
  nomeAtual: string,
  dados: NovoLocal,
  autor: string,
): Promise<{ local: Local; itensAtualizados: number }> {
  return emFila(async () => {
    const { locais, linhaPorLocal, itens, linhaPorCodigo } = await snapshotAtual();
    const linha = linhaPorLocal.get(nomeAtual);
    if (!linha) throw new LocalNaoEncontrado(nomeAtual);

    const limpo = limparLocal(dados);
    const local: Local = { ...limpo, nome: nomeDoLocal(limpo.movel, limpo.zona) };
    exigirNomeLivre(local.nome, locais, nomeAtual);

    const dadosEscrita: sheets_v4.Schema$ValueRange[] = [
      {
        range: `${nomeAbaLocais()}!A${linha}:D${linha}`,
        values: [localParaLinha(local)],
      },
    ];

    let itensAtualizados = 0;
    if (local.nome !== nomeAtual) {
      const momento = agora();
      for (const item of itens) {
        if (item.local !== nomeAtual) continue;
        const linhaItem = linhaPorCodigo.get(item.codigo);
        if (!linhaItem) continue;
        dadosEscrita.push({
          range: `${nomeAba()}!A${linhaItem}:M${linhaItem}`,
          values: [
            itemParaLinha({
              ...item,
              local: local.nome,
              atualizadoEm: momento,
              atualizadoPor: autor,
            }),
          ],
        });
        itensAtualizados += 1;
      }
    }

    // Uma chamada so: ou tudo entra, ou nada entra.
    await cliente().spreadsheets.values.batchUpdate({
      spreadsheetId: idPlanilha(),
      requestBody: { valueInputOption: "USER_ENTERED", data: dadosEscrita },
    });

    invalidarCache();
    return { local, itensAtualizados };
  });
}

/**
 * Remove um local que nenhum item ativo usa. Limpa a linha em vez de
 * apaga-la: a leitura ignora linha vazia, e assim nao precisamos do id
 * interno da aba.
 */
export async function removerLocal(nome: string): Promise<void> {
  return emFila(async () => {
    const { linhaPorLocal, itens } = await snapshotAtual();
    const linha = linhaPorLocal.get(nome);
    if (!linha) throw new LocalNaoEncontrado(nome);

    const emUso = itens.filter(
      (item) => item.local === nome && item.estado !== "Descartado",
    ).length;
    if (emUso > 0) {
      throw new LocalInvalido(
        `${emUso} ${emUso === 1 ? "item ainda esta" : "itens ainda estao"} em ${nome}. Mova-os antes de remover o local.`,
      );
    }

    await cliente().spreadsheets.values.clear({
      spreadsheetId: idPlanilha(),
      range: `${nomeAbaLocais()}!A${linha}:D${linha}`,
    });

    invalidarCache();
  });
}

/* ------------------------------------------------------------------ *
 * Emprestimos
 *
 * A aba e um livro de registro: emprestar acrescenta uma linha, devolver
 * preenche "Devolvido em" nela. Nenhuma linha e apagada. Escrita RAW para
 * o Sheets nao converter "2026-10-20" em numero de serie de data.
 * ------------------------------------------------------------------ */

/** Regra de emprestimo violada (sem estoque, consumivel, ja devolvido). */
export class EmprestimoInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "EmprestimoInvalido";
  }
}

export class EmprestimoNaoEncontrado extends Error {
  constructor(id: string) {
    super(`Emprestimo ${id} nao encontrado na planilha.`);
    this.name = "EmprestimoNaoEncontrado";
  }
}

export async function emprestar(
  dados: NovoEmprestimo,
  autor: string,
): Promise<Emprestimo> {
  return emFila(async () => {
    const { itens, emprestimos, proximaLinhaEmprestimo } = await snapshotAtual();
    const item = itens.find((i) => i.codigo === dados.codigo);
    if (!item) throw new ItemNaoEncontrado(dados.codigo);

    if (!podeEmprestar(item)) {
      throw new EmprestimoInvalido(
        item.estado === "Descartado"
          ? `O item ${item.codigo} foi descartado.`
          : `${item.nome} e consumivel: consumivel e retirado, nao emprestado.`,
      );
    }
    if (!dados.pessoa.trim()) {
      throw new EmprestimoInvalido("Diga quem esta levando o item.");
    }
    if (!Number.isFinite(dados.quantidade) || dados.quantidade <= 0) {
      throw new EmprestimoInvalido("A quantidade precisa ser maior que zero.");
    }
    if (dados.devolverAte && !/^\d{4}-\d{2}-\d{2}$/.test(dados.devolverAte)) {
      throw new EmprestimoInvalido("Data de devolucao invalida. Use AAAA-MM-DD.");
    }

    const disponivel = item.quantidade - quantidadeEmprestada(item.codigo, emprestimos);
    if (dados.quantidade > disponivel) {
      throw new EmprestimoInvalido(
        disponivel <= 0
          ? `Nao ha unidade disponivel de ${item.nome}: tudo ja esta emprestado.`
          : `So ${disponivel} ${item.unidade || "un"} de ${item.nome} ${disponivel === 1 ? "esta disponivel" : "estao disponiveis"}.`,
      );
    }

    const emprestimo: Emprestimo = {
      id: proximoIdEmprestimo(emprestimos),
      codigo: item.codigo,
      item: item.nome,
      quantidade: dados.quantidade,
      pessoa: dados.pessoa.trim(),
      contato: dados.contato.trim(),
      retiradoEm: agora(),
      devolverAte: dados.devolverAte,
      devolvidoEm: "",
      observacoes: dados.observacoes.trim(),
      registradoPor: autor,
      devolucaoRegistradaPor: "",
    };

    const linha = proximaLinhaEmprestimo;
    await cliente().spreadsheets.values.update({
      spreadsheetId: idPlanilha(),
      range: `${nomeAbaEmprestimos()}!A${linha}:L${linha}`,
      valueInputOption: "RAW",
      requestBody: { values: [emprestimoParaLinha(emprestimo)] },
    });

    invalidarCache();
    return emprestimo;
  });
}

/** Registra a devolucao do emprestimo inteiro. */
export async function devolver(id: string, autor: string): Promise<Emprestimo> {
  return emFila(async () => {
    const { emprestimos, linhaPorEmprestimo } = await snapshotAtual();
    const linha = linhaPorEmprestimo.get(id);
    const atual = emprestimos.find((e) => e.id === id);
    if (!linha || !atual) throw new EmprestimoNaoEncontrado(id);
    if (atual.devolvidoEm) {
      throw new EmprestimoInvalido(`O emprestimo ${id} ja foi devolvido.`);
    }

    const emprestimo: Emprestimo = {
      ...atual,
      devolvidoEm: agora(),
      devolucaoRegistradaPor: autor,
    };

    await cliente().spreadsheets.values.update({
      spreadsheetId: idPlanilha(),
      range: `${nomeAbaEmprestimos()}!A${linha}:L${linha}`,
      valueInputOption: "RAW",
      requestBody: { values: [emprestimoParaLinha(emprestimo)] },
    });

    invalidarCache();
    return emprestimo;
  });
}

/* ------------------------------------------------------------------ *
 * Diagnostico
 * ------------------------------------------------------------------ */

export async function verificarPlanilha(): Promise<{
  ok: boolean;
  titulo?: string;
  erro?: string;
}> {
  try {
    const resposta = await cliente().spreadsheets.get({
      spreadsheetId: idPlanilha(),
      fields: "properties.title,sheets.properties.title",
    });
    const abas = (resposta.data.sheets ?? []).map(
      (aba) => aba.properties?.title,
    );
    for (const aba of [nomeAba(), nomeAbaLocais(), nomeAbaEmprestimos()]) {
      if (!abas.includes(aba)) {
        return {
          ok: false,
          erro: `A planilha nao tem a aba "${aba}". Rode: npm run init-sheet`,
        };
      }
    }
    return { ok: true, titulo: resposta.data.properties?.title ?? undefined };
  } catch (erro) {
    return { ok: false, erro: (erro as Error).message };
  }
}

export { CABECALHO };

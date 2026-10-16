/**
 * Modelo de dados do inventario do GER.
 *
 * A planilha do Google Sheets e a fonte da verdade. Cada linha e um item.
 * O campo `codigo` e sequencial de 4 digitos ("0001") e NUNCA muda depois de
 * impresso na etiqueta: projeto e local sao colunas editaveis justamente para
 * que o codigo colado no objeto continue valido quando a peca mudar de lugar.
 */

export const ESTADOS = [
  "Funciona",
  "Com defeito",
  "Nao testado",
  "Descartado",
] as const;
export type Estado = (typeof ESTADOS)[number];

/** Para consumiveis, em que contar unidade a unidade nao compensa. */
export const NIVEIS = ["", "Sobrando", "Pouco", "Acabou"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const CATEGORIAS = [
  "Ferramenta",
  "Componente eletronico",
  "Peca mecanica",
  "Consumivel",
  "Equipamento",
  "Material de escritorio",
  "Outro",
] as const;

export const PROJETOS = [
  "Futebol de Robos",
  "Braco Robotico",
  "Projeto Social",
  "Geral / ADM",
] as const;

/**
 * Os valores gravados na planilha ficam sem acento (validacao e busca mais
 * simples). Na tela, mostramos com acento.
 */
const ROTULOS: Record<string, string> = {
  "Nao testado": "Não testado",
  "Componente eletronico": "Componente eletrônico",
  "Peca mecanica": "Peça mecânica",
  Consumivel: "Consumível",
  "Material de escritorio": "Material de escritório",
  "Futebol de Robos": "Futebol de Robôs",
  "Braco Robotico": "Braço Robótico",
};

export function rotulo(valor: string): string {
  return ROTULOS[valor] ?? valor;
}

export interface Item {
  /** Sequencial de 4 digitos, imutavel. Igual ao que esta na etiqueta. */
  codigo: string;
  nome: string;
  categoria: string;
  projeto: string;
  /**
   * Nome de um local cadastrado na aba Locais. Ex.: "Armario B / Gaveta 3".
   * Guarda o nome legivel, nao um id: renomear o local reescreve os itens.
   */
  local: string;
  quantidade: number;
  /** un, m, kg, rolo, par... */
  unidade: string;
  /** Preenchido so para consumiveis; substitui a contagem exata. */
  nivel: Nivel;
  estado: Estado;
  /** Numero da plaqueta de patrimonio da Unicamp, quando houver. */
  patrimonio: string;
  observacoes: string;
  atualizadoEm: string;
  atualizadoPor: string;
}

export type NovoItem = Omit<Item, "codigo" | "atualizadoEm" | "atualizadoPor">;

/** Ordem das colunas na planilha. Mudar aqui exige mudar a planilha. */
export const COLUNAS = [
  "codigo",
  "nome",
  "categoria",
  "projeto",
  "local",
  "quantidade",
  "unidade",
  "nivel",
  "estado",
  "patrimonio",
  "observacoes",
  "atualizadoEm",
  "atualizadoPor",
] as const satisfies readonly (keyof Item)[];

export const CABECALHO: string[] = [
  "Codigo",
  "Nome",
  "Categoria",
  "Projeto",
  "Local",
  "Quantidade",
  "Unidade",
  "Nivel",
  "Estado",
  "Patrimonio",
  "Observacoes",
  "Atualizado em",
  "Atualizado por",
];

export const ITEM_VAZIO: NovoItem = {
  nome: "",
  categoria: "Outro",
  projeto: "Geral / ADM",
  local: "",
  quantidade: 1,
  unidade: "un",
  nivel: "",
  estado: "Nao testado",
  patrimonio: "",
  observacoes: "",
};

/* ------------------------------------------------------------------ *
 * Locais
 *
 * Aba propria na planilha. Um local e um movel (obrigatorio) e,
 * opcionalmente, uma zona dentro dele: prateleira, gaveta, painel.
 * ------------------------------------------------------------------ */

export interface Local {
  movel: string;
  /** Vazio quando o local e o movel inteiro. */
  zona: string;
  observacoes: string;
  /** "Movel / Zona", ou so "Movel". E o valor gravado na coluna Local do item. */
  nome: string;
}

export type NovoLocal = Omit<Local, "nome">;

/**
 * Colunas da aba Locais. A coluna D (Nome) e escrita pelo app como valor,
 * e nao por formula: formula pela API depende do locale da planilha
 * (pt_BR usa ";" entre argumentos) e quebrava. Ela existe para a lista
 * suspensa da coluna Local do inventario; o app sempre recalcula o nome a
 * partir de Movel e Zona, entao uma coluna D desatualizada nao o engana.
 */
export const COLUNAS_LOCAL = ["movel", "zona", "observacoes", "nome"] as const satisfies readonly (keyof Local)[];

export const CABECALHO_LOCAL: string[] = ["Movel", "Zona", "Observacoes", "Nome"];

/** Separador entre movel e zona no nome do local. */
export const SEPARADOR_LOCAL = " / ";

/* ------------------------------------------------------------------ *
 * Emprestimos
 *
 * Aba propria. Um emprestimo por linha; fica aberto enquanto
 * `devolvidoEm` estiver vazio. A linha nunca e apagada: e o historico.
 * ------------------------------------------------------------------ */

export interface Emprestimo {
  /** "E0001", sequencial. Prefixo para o Sheets nao tratar como numero. */
  id: string;
  /** Codigo do item emprestado. */
  codigo: string;
  /** Nome do item no momento do emprestimo, so para leitura na planilha. */
  item: string;
  quantidade: number;
  pessoa: string;
  /** Telefone, e-mail ou RA. */
  contato: string;
  retiradoEm: string;
  /** "AAAA-MM-DD", ou vazio quando nao ha prazo. */
  devolverAte: string;
  /** Vazio enquanto o emprestimo esta aberto. */
  devolvidoEm: string;
  observacoes: string;
  registradoPor: string;
  devolucaoRegistradaPor: string;
}

export type NovoEmprestimo = Pick<
  Emprestimo,
  "codigo" | "quantidade" | "pessoa" | "contato" | "devolverAte" | "observacoes"
>;

export const COLUNAS_EMPRESTIMO = [
  "id",
  "codigo",
  "item",
  "quantidade",
  "pessoa",
  "contato",
  "retiradoEm",
  "devolverAte",
  "devolvidoEm",
  "observacoes",
  "registradoPor",
  "devolucaoRegistradaPor",
] as const satisfies readonly (keyof Emprestimo)[];

export const CABECALHO_EMPRESTIMO: string[] = [
  "Id",
  "Codigo",
  "Item",
  "Quantidade",
  "Pessoa",
  "Contato",
  "Retirado em",
  "Devolver ate",
  "Devolvido em",
  "Observacoes",
  "Registrado por",
  "Devolucao registrada por",
];

/** Consumivel e gasto, nao devolvido: nao entra em emprestimo. */
export function podeEmprestar(item: Pick<Item, "categoria" | "estado">): boolean {
  return item.categoria !== "Consumivel" && item.estado !== "Descartado";
}

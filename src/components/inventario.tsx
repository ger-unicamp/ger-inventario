"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  HandHelping,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmprestimoFormDialog } from "@/components/emprestimo-form-dialog";
import { Emprestimos } from "@/components/emprestimos";
import { ItemFormDialog } from "@/components/item-form-dialog";
import { LocalFormDialog } from "@/components/local-form-dialog";
import { Locais } from "@/components/locais";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAutor } from "@/hooks/use-autor";
import {
  agruparPorMovel,
  casaFiltroDeLocal,
  descreverFiltroDeLocal,
  FILTRO_SEM_LOCAL,
  filtroDeLocal,
  filtroDeMovel,
} from "@/lib/locais";
import { estaAtrasado } from "@/lib/mapeamento";
import {
  type Emprestimo,
  ESTADOS,
  type Estado,
  type Item,
  type Local,
  type NovoEmprestimo,
  type NovoItem,
  type NovoLocal,
  podeEmprestar,
  rotulo,
} from "@/lib/types";
import { cn, hojeLocal, normalizar } from "@/lib/utils";

const TODOS = "__todos__";

type ChaveOrdenacao = "codigo" | "nome" | "projeto" | "local" | "estado";
type Aba = "itens" | "emprestimos" | "locais";

function corDoEstado(estado: Estado) {
  switch (estado) {
    case "Funciona":
      return "ok" as const;
    case "Com defeito":
      return "alerta" as const;
    case "Descartado":
      return "erro" as const;
    default:
      return "neutro" as const;
  }
}

function corDoNivel(nivel: string) {
  if (nivel === "Acabou") return "erro" as const;
  if (nivel === "Pouco") return "alerta" as const;
  if (nivel === "Sobrando") return "ok" as const;
  return "neutro" as const;
}

const acabando = (item: Item) => item.nivel === "Pouco" || item.nivel === "Acabou";

interface Status {
  ok: boolean;
  erro?: string;
  url?: string;
}

export function Inventario() {
  const { autor, salvarAutor, carregado } = useAutor();

  const [aba, definirAba] = useState<Aba>("itens");

  const [itens, definirItens] = useState<Item[]>([]);
  const [locais, definirLocais] = useState<Local[]>([]);
  const [emprestimos, definirEmprestimos] = useState<Emprestimo[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [status, definirStatus] = useState<Status | null>(null);

  const [busca, definirBusca] = useState("");
  const [projeto, definirProjeto] = useState(TODOS);
  const [categoria, definirCategoria] = useState(TODOS);
  const [local, definirLocal] = useState(TODOS);
  const [estado, definirEstado] = useState(TODOS);
  const [soAcabando, definirSoAcabando] = useState(false);
  const [soEmprestados, definirSoEmprestados] = useState(false);
  const [mostrarDescartados, definirMostrarDescartados] = useState(false);

  const [ordem, definirOrdem] = useState<ChaveOrdenacao>("codigo");
  const [ordemCrescente, definirOrdemCrescente] = useState(true);

  const [dialogoAberto, definirDialogoAberto] = useState(false);
  const [itemEditando, definirItemEditando] = useState<Item | null>(null);
  const [itemBaixa, definirItemBaixa] = useState<Item | null>(null);

  const [dialogoLocalAberto, definirDialogoLocalAberto] = useState(false);
  const [localEditando, definirLocalEditando] = useState<Local | null>(null);
  const [movelInicial, definirMovelInicial] = useState("");
  const [localRemovendo, definirLocalRemovendo] = useState<Local | null>(null);

  const [dialogoEmprestimoAberto, definirDialogoEmprestimoAberto] = useState(false);
  const [itemEmprestando, definirItemEmprestando] = useState<Item | null>(null);
  const [emprestimoDevolvendo, definirEmprestimoDevolvendo] = useState<Emprestimo | null>(null);

  /* ---------------- carregamento ---------------- */

  const carregar = useCallback(async (forcar = false) => {
    definirCarregando(true);
    try {
      const resposta = await fetch(
        `/api/items${forcar ? "?recarregar=1" : ""}`,
        { cache: "no-store" },
      );
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao ler a planilha");
      definirItens(dados.itens as Item[]);
      definirLocais((dados.locais ?? []) as Local[]);
      definirEmprestimos((dados.emprestimos ?? []) as Emprestimo[]);
    } catch (erro) {
      toast.error("Não consegui ler a planilha", {
        description: (erro as Error).message,
      });
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    // ?aba=emprestimos abre direto na aba: da para favoritar.
    const pedida = new URLSearchParams(window.location.search).get("aba");
    if (pedida === "emprestimos" || pedida === "locais") definirAba(pedida);
  }, []);

  useEffect(() => {
    void carregar();
    void fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => definirStatus(d as Status))
      .catch(() => definirStatus({ ok: false, erro: "Servidor indisponível" }));
  }, [carregar]);

  /* ---------------- derivados ---------------- */

  const unicos = (valores: string[]) =>
    [...new Set(valores.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

  const categorias = useMemo(() => unicos(itens.map((i) => i.categoria)), [itens]);
  const projetos = useMemo(() => unicos(itens.map((i) => i.projeto)), [itens]);
  const grupos = useMemo(() => agruparPorMovel(locais), [locais]);

  /** Unidades fora agora, por codigo. So emprestimos abertos. */
  const foraPorCodigo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const e of emprestimos) {
      if (e.devolvidoEm) continue;
      mapa.set(e.codigo, (mapa.get(e.codigo) ?? 0) + e.quantidade);
    }
    return mapa;
  }, [emprestimos]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);

    const filtrados = itens.filter((item) => {
      if (!mostrarDescartados && estado !== "Descartado" && item.estado === "Descartado")
        return false;
      if (projeto !== TODOS && item.projeto !== projeto) return false;
      if (categoria !== TODOS && item.categoria !== categoria) return false;
      if (local !== TODOS && !casaFiltroDeLocal(item.local, local)) return false;
      if (estado !== TODOS && item.estado !== estado) return false;
      if (soAcabando && !acabando(item)) return false;
      if (soEmprestados && !foraPorCodigo.has(item.codigo)) return false;
      if (!termo) return true;

      const alvo = normalizar(
        [
          item.codigo,
          item.nome,
          item.categoria,
          item.projeto,
          item.local,
          item.patrimonio,
          item.observacoes,
        ].join(" "),
      );
      // Cada palavra da busca precisa aparecer em algum lugar do item.
      return termo.split(/\s+/).every((palavra) => alvo.includes(palavra));
    });

    const sinal = ordemCrescente ? 1 : -1;
    return filtrados.sort(
      (a, b) => sinal * String(a[ordem]).localeCompare(String(b[ordem]), "pt-BR"),
    );
  }, [
    itens,
    busca,
    projeto,
    categoria,
    local,
    estado,
    soAcabando,
    soEmprestados,
    foraPorCodigo,
    mostrarDescartados,
    ordem,
    ordemCrescente,
  ]);

  const resumo = useMemo(() => {
    const ativos = itens.filter((i) => i.estado !== "Descartado");
    return {
      total: ativos.length,
      comDefeito: ativos.filter((i) => i.estado === "Com defeito").length,
      naoTestados: ativos.filter((i) => i.estado === "Nao testado").length,
      acabando: ativos.filter(acabando).length,
      emprestados: foraPorCodigo.size,
      atrasados: emprestimos.filter((e) => estaAtrasado(e, hojeLocal())).length,
    };
  }, [itens, foraPorCodigo, emprestimos]);

  const filtroAtivo =
    busca !== "" ||
    projeto !== TODOS ||
    categoria !== TODOS ||
    local !== TODOS ||
    estado !== TODOS ||
    soAcabando ||
    soEmprestados;

  /* ---------------- acoes ---------------- */

  function alternarOrdem(chave: ChaveOrdenacao) {
    if (ordem === chave) definirOrdemCrescente((v) => !v);
    else {
      definirOrdem(chave);
      definirOrdemCrescente(true);
    }
  }

  function limparFiltros() {
    definirBusca("");
    definirProjeto(TODOS);
    definirCategoria(TODOS);
    definirLocal(TODOS);
    definirEstado(TODOS);
    definirSoAcabando(false);
    definirSoEmprestados(false);
  }

  /** Contadores do topo: atalho para o filtro correspondente, e clicar de novo desfaz. */
  function alternarEstado(alvo: Estado) {
    definirSoAcabando(false);
    definirSoEmprestados(false);
    definirEstado((atual) => (atual === alvo ? TODOS : alvo));
  }

  function alternarAcabando() {
    definirEstado(TODOS);
    definirSoEmprestados(false);
    definirSoAcabando((v) => !v);
  }

  function alternarEmprestados() {
    definirEstado(TODOS);
    definirSoAcabando(false);
    definirSoEmprestados((v) => !v);
  }

  async function salvarItem(dados: NovoItem, codigo: string | null) {
    const resposta = await fetch(
      codigo ? `/api/items/${codigo}` : "/api/items",
      {
        method: codigo ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dados, autor: autor || "desconhecido" }),
      },
    );
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para salvar", { description: corpo.erro });
      throw new Error(corpo.erro);
    }

    const item = corpo.item as Item;
    toast.success(
      codigo ? `Item ${item.codigo} atualizado` : `Item cadastrado`,
      {
        description: codigo
          ? undefined
          : `Código ${item.codigo}: anote na etiqueta.`,
      },
    );
    await carregar(true);
  }

  async function confirmarBaixa() {
    if (!itemBaixa) return;
    const codigo = itemBaixa.codigo;
    definirItemBaixa(null);

    const resposta = await fetch(
      `/api/items/${codigo}?autor=${encodeURIComponent(autor || "desconhecido")}`,
      { method: "DELETE" },
    );
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para dar baixa", { description: corpo.erro });
      return;
    }
    toast.success(`Item ${codigo} marcado como descartado`);
    await carregar(true);
  }

  /** Cria (nomeAtual null) ou edita um local. Lanca erro para o dialogo ficar aberto. */
  async function salvarLocal(dados: NovoLocal, nomeAtual: string | null): Promise<Local> {
    const resposta = await fetch("/api/locais", {
      method: nomeAtual ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dados, nomeAtual, autor: autor || "desconhecido" }),
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para salvar o local", { description: corpo.erro });
      throw new Error(corpo.erro);
    }

    const salvo = corpo.local as Local;
    const atualizados = (corpo.itensAtualizados as number | undefined) ?? 0;
    toast.success(nomeAtual ? `Local ${salvo.nome} salvo` : `Local ${salvo.nome} cadastrado`, {
      description:
        atualizados > 0
          ? `${atualizados} ${atualizados === 1 ? "item foi atualizado" : "itens foram atualizados"}.`
          : undefined,
    });

    // Se o filtro apontava para o nome antigo, acompanha o rename.
    if (nomeAtual && local === filtroDeLocal(nomeAtual)) {
      definirLocal(filtroDeLocal(salvo.nome));
    }
    await carregar(true);
    return salvo;
  }

  async function confirmarRemocaoLocal() {
    if (!localRemovendo) return;
    const nome = localRemovendo.nome;
    definirLocalRemovendo(null);

    const resposta = await fetch(`/api/locais?nome=${encodeURIComponent(nome)}`, {
      method: "DELETE",
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para remover o local", { description: corpo.erro });
      return;
    }
    toast.success(`Local ${nome} removido`);
    if (local === filtroDeLocal(nome)) definirLocal(TODOS);
    await carregar(true);
  }

  function abrirEmprestimo(item: Item | null) {
    definirItemEmprestando(item);
    definirDialogoEmprestimoAberto(true);
  }

  async function registrarEmprestimo(dados: NovoEmprestimo) {
    const resposta = await fetch("/api/emprestimos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dados, autor: autor || "desconhecido" }),
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para registrar o empréstimo", { description: corpo.erro });
      throw new Error(corpo.erro);
    }
    const emprestimo = corpo.emprestimo as Emprestimo;
    toast.success(`${emprestimo.item} emprestado para ${emprestimo.pessoa}`);
    await carregar(true);
  }

  async function confirmarDevolucao() {
    if (!emprestimoDevolvendo) return;
    const { id, item, pessoa } = emprestimoDevolvendo;
    definirEmprestimoDevolvendo(null);

    const resposta = await fetch("/api/emprestimos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, autor: autor || "desconhecido" }),
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      toast.error("Não deu para registrar a devolução", { description: corpo.erro });
      return;
    }
    toast.success(`Devolução registrada: ${item}, de ${pessoa}`);
    await carregar(true);
  }

  function abrirNovoLocal(movel = "") {
    definirLocalEditando(null);
    definirMovelInicial(movel);
    definirDialogoLocalAberto(true);
  }

  function verItensDoLocal(filtro: string) {
    limparFiltros();
    definirLocal(filtro);
    definirAba("itens");
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-h-screen border-t-[6px] border-tinta">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-8 sm:py-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="flex items-center gap-3">
              <Image
                src="/brand/ger-wordmark.png"
                alt="GER, Grupo de Estudos em Robótica"
                width={522}
                height={189}
                priority
                className="h-9 w-auto"
              />
              <span className="font-display text-xl font-extrabold leading-none">
                Inventário
              </span>
            </h1>

            <nav
              aria-label="Seções"
              className="inline-flex rounded-md border bg-card p-0.5"
            >
              {(
                [
                  ["itens", "Itens"],
                  ["emprestimos", "Empréstimos"],
                  ["locais", "Locais"],
                ] as const
              ).map(([chave, texto]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => definirAba(chave)}
                  aria-current={aba === chave ? "page" : undefined}
                  className={cn(
                    "rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    aba === chave
                      ? "bg-tinta text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {texto}
                  {chave === "emprestimos" && resumo.atrasados > 0 && (
                    <span
                      className="ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground"
                      aria-label={`${resumo.atrasados} atrasados`}
                    >
                      {resumo.atrasados}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="autor" className="text-xs text-muted-foreground">
                Quem está mexendo
              </Label>
              <Input
                id="autor"
                value={autor}
                onChange={(e) => salvarAutor(e.target.value)}
                placeholder="seu nome"
                className="h-9 w-36 bg-card"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => carregar(true)}
              disabled={carregando}
              title="Recarregar da planilha"
              aria-label="Recarregar da planilha"
            >
              <RefreshCw className={cn(carregando && "animate-spin")} />
            </Button>
            {status?.url && (
              <Button
                variant="outline"
                size="icon"
                asChild
                title="Abrir planilha"
                aria-label="Abrir planilha"
              >
                <a href={status.url} target="_blank" rel="noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            )}
            <Button
              onClick={() => {
                definirItemEditando(null);
                definirDialogoAberto(true);
              }}
            >
              <Plus /> Novo item
            </Button>
          </div>
        </header>

        {status && !status.ok && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium">Problema de conexão com a planilha</p>
            <p className="mt-1 text-muted-foreground">{status.erro}</p>
          </div>
        )}

        {carregado && !autor && (
          <div className="rounded-md border border-amber-600/40 bg-amber-100 p-3 text-sm text-amber-950">
            Coloque seu nome no campo acima antes de cadastrar. Toda alteração
            grava quem fez, e é isso que permite voltar atrás quando algo some.
          </div>
        )}

        {aba === "emprestimos" ? (
          <Emprestimos
            emprestimos={emprestimos}
            itens={itens}
            carregando={carregando}
            aoNovo={() => abrirEmprestimo(null)}
            aoDevolver={definirEmprestimoDevolvendo}
          />
        ) : aba === "locais" ? (
          <Locais
            locais={locais}
            itens={itens}
            carregando={carregando}
            aoNovo={abrirNovoLocal}
            aoEditar={(l) => {
              definirLocalEditando(l);
              definirDialogoLocalAberto(true);
            }}
            aoRemover={definirLocalRemovendo}
            aoVerItens={verItensDoLocal}
          />
        ) : (
          <>
            {/* Contadores: cada um e um atalho de filtro. */}
            <div className="flex flex-wrap gap-2" aria-label="Resumo">
              <Contador
                valor={resumo.total}
                texto="ativos"
                ativo={!filtroAtivo}
                aoClicar={limparFiltros}
              />
              <Contador
                valor={resumo.comDefeito}
                texto="com defeito"
                ativo={estado === "Com defeito"}
                aoClicar={() => alternarEstado("Com defeito")}
              />
              <Contador
                valor={resumo.naoTestados}
                texto="não testados"
                ativo={estado === "Nao testado"}
                aoClicar={() => alternarEstado("Nao testado")}
              />
              <Contador
                valor={resumo.acabando}
                texto="consumíveis acabando"
                ativo={soAcabando}
                aoClicar={alternarAcabando}
              />
              <Contador
                valor={resumo.emprestados}
                texto="emprestados"
                ativo={soEmprestados}
                aoClicar={alternarEmprestados}
              />
              {resumo.atrasados > 0 && (
                <button
                  type="button"
                  onClick={() => definirAba("emprestimos")}
                  className="flex items-baseline gap-1.5 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="font-display text-lg font-extrabold leading-none tabular-nums">
                    {resumo.atrasados}
                  </span>
                  {resumo.atrasados === 1 ? "empréstimo atrasado" : "empréstimos atrasados"}
                </button>
              )}
            </div>

            {/* Filtros */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => definirBusca(e.target.value)}
                  placeholder="Buscar por código, nome, local, plaqueta ou observação"
                  aria-label="Buscar"
                  className="bg-card pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FiltroSelect
                  rotuloFiltro="Projeto"
                  valor={projeto}
                  aoMudar={definirProjeto}
                  opcoes={projetos}
                />
                <FiltroSelect
                  rotuloFiltro="Categoria"
                  valor={categoria}
                  aoMudar={definirCategoria}
                  opcoes={categorias}
                />

                <Select value={local} onValueChange={definirLocal}>
                  <SelectTrigger
                    className="h-9 w-auto min-w-[140px] max-w-[260px] gap-2 bg-card"
                    aria-label="Filtrar por local"
                  >
                    <SelectValue placeholder="Local">
                      {local === TODOS ? "Local: todos" : descreverFiltroDeLocal(local)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Local: todos</SelectItem>
                    <SelectItem value={FILTRO_SEM_LOCAL}>Sem local</SelectItem>
                    {grupos.map((grupo) => (
                      <SelectGroup key={grupo.movel}>
                        <SelectSeparator />
                        <SelectLabel>{grupo.movel}</SelectLabel>
                        <SelectItem value={filtroDeMovel(grupo.movel)}>
                          Tudo em {grupo.movel}
                        </SelectItem>
                        {grupo.zonas.map((l) => (
                          <SelectItem key={l.nome} value={filtroDeLocal(l.nome)}>
                            {l.zona}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                <FiltroSelect
                  rotuloFiltro="Estado"
                  valor={estado}
                  aoMudar={(v) => {
                    definirSoAcabando(false);
                    definirEstado(v);
                  }}
                  opcoes={[...ESTADOS]}
                />

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={mostrarDescartados}
                    onChange={(e) => definirMostrarDescartados(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Mostrar descartados
                </label>

                {filtroAtivo && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                )}

                <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                  {visiveis.length} de {itens.length}
                </span>
              </div>
            </div>

            {/* Tabela */}
            <div className="overflow-hidden rounded-md border bg-card">
              <Table>
                <TableHeader className="bg-secondary">
                  <TableRow className="hover:bg-transparent">
                    <ColunaOrdenavel
                      chave="codigo"
                      rotulo="Código"
                      ordem={ordem}
                      crescente={ordemCrescente}
                      aoClicar={alternarOrdem}
                      className="w-[96px]"
                    />
                    <ColunaOrdenavel
                      chave="nome"
                      rotulo="Nome"
                      ordem={ordem}
                      crescente={ordemCrescente}
                      aoClicar={alternarOrdem}
                    />
                    <ColunaOrdenavel
                      chave="projeto"
                      rotulo="Projeto"
                      ordem={ordem}
                      crescente={ordemCrescente}
                      aoClicar={alternarOrdem}
                      className="hidden md:table-cell"
                    />
                    <ColunaOrdenavel
                      chave="local"
                      rotulo="Local"
                      ordem={ordem}
                      crescente={ordemCrescente}
                      aoClicar={alternarOrdem}
                      className="hidden lg:table-cell"
                    />
                    <TableHead className="hidden w-[90px] sm:table-cell">Qtd.</TableHead>
                    <ColunaOrdenavel
                      chave="estado"
                      rotulo="Estado"
                      ordem={ordem}
                      crescente={ordemCrescente}
                      aoClicar={alternarOrdem}
                      className="w-[130px]"
                    />
                    <TableHead className="w-[130px] text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carregando && itens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Lendo a planilha...
                      </TableCell>
                    </TableRow>
                  )}

                  {!carregando && visiveis.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="py-10">
                        <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
                          <Image
                            src="/brand/ger-logo.png"
                            alt=""
                            width={556}
                            height={691}
                            className="h-16 w-auto opacity-30"
                          />
                          {itens.length === 0 ? (
                            <>
                              <p>A planilha está vazia.</p>
                              <Button
                                size="sm"
                                onClick={() => {
                                  definirItemEditando(null);
                                  definirDialogoAberto(true);
                                }}
                              >
                                <Plus /> Cadastrar o primeiro item
                              </Button>
                            </>
                          ) : (
                            <>
                              <p>Nenhum item bate com esses filtros.</p>
                              <Button size="sm" variant="outline" onClick={limparFiltros}>
                                Limpar filtros
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {visiveis.map((item) => (
                    <TableRow
                      key={item.codigo}
                      className={cn(item.estado === "Descartado" && "opacity-50")}
                    >
                      <TableCell>
                        <span className="fita">{item.codigo}</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.nome}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{rotulo(item.categoria)}</span>
                          {item.patrimonio && (
                            <Badge variant="outline" className="font-mono">
                              pat. {item.patrimonio}
                            </Badge>
                          )}
                          <span className="md:hidden">{rotulo(item.projeto)}</span>
                          {foraPorCodigo.has(item.codigo) && (
                            <span className="font-medium text-primary sm:hidden">
                              {foraPorCodigo.get(item.codigo)} emprestado
                            </span>
                          )}
                          {item.local && <span className="lg:hidden">{item.local}</span>}
                        </div>
                        {item.observacoes && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.observacoes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {rotulo(item.projeto)}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {item.local || (
                          <span className="text-muted-foreground">sem local</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm tabular-nums sm:table-cell">
                        {item.nivel ? (
                          <Badge variant={corDoNivel(item.nivel)}>{item.nivel}</Badge>
                        ) : (
                          `${item.quantidade} ${item.unidade}`.trim()
                        )}
                        {foraPorCodigo.has(item.codigo) && (
                          <div className="text-xs text-primary">
                            {foraPorCodigo.get(item.codigo)} emprestado
                            {(foraPorCodigo.get(item.codigo) ?? 0) > 1 ? "s" : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={corDoEstado(item.estado)}>
                          {rotulo(item.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {podeEmprestar(item) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Emprestar"
                              aria-label={`Emprestar ${item.codigo}`}
                              disabled={item.quantidade - (foraPorCodigo.get(item.codigo) ?? 0) <= 0}
                              onClick={() => abrirEmprestimo(item)}
                            >
                              <HandHelping />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            aria-label={`Editar ${item.codigo}`}
                            onClick={() => {
                              definirItemEditando(item);
                              definirDialogoAberto(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={
                              foraPorCodigo.has(item.codigo)
                                ? "Registre a devolução antes de dar baixa"
                                : "Dar baixa"
                            }
                            aria-label={`Dar baixa em ${item.codigo}`}
                            disabled={item.estado === "Descartado" || foraPorCodigo.has(item.codigo)}
                            onClick={() => definirItemBaixa(item)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <ItemFormDialog
        aberto={dialogoAberto}
        aoFechar={() => definirDialogoAberto(false)}
        item={itemEditando}
        locais={locais}
        aoSalvar={salvarItem}
        aoCriarLocal={(dados) => salvarLocal(dados, null)}
      />

      <LocalFormDialog
        aberto={dialogoLocalAberto}
        aoFechar={() => definirDialogoLocalAberto(false)}
        local={localEditando}
        locais={locais}
        movelInicial={movelInicial}
        itensNoLocal={
          localEditando ? itens.filter((i) => i.local === localEditando.nome).length : 0
        }
        aoSalvar={async (dados, nomeAtual) => {
          await salvarLocal(dados, nomeAtual);
        }}
      />

      <AlertDialog
        open={itemBaixa !== null}
        onOpenChange={(v) => !v && definirItemBaixa(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Dar baixa no item {itemBaixa?.codigo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemBaixa?.nome} será marcado como Descartado. A linha continua
              na planilha e o código não é reaproveitado, para preservar o
              rastro
              {itemBaixa?.patrimonio
                ? ". Este item tem plaqueta de patrimônio, que exige baixa formal junto à FEM."
                : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBaixa}>
              Dar baixa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmprestimoFormDialog
        aberto={dialogoEmprestimoAberto}
        aoFechar={() => definirDialogoEmprestimoAberto(false)}
        item={itemEmprestando}
        itens={itens}
        emprestimos={emprestimos}
        aoSalvar={registrarEmprestimo}
      />

      <AlertDialog
        open={emprestimoDevolvendo !== null}
        onOpenChange={(v) => !v && definirEmprestimoDevolvendo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar devolução?</AlertDialogTitle>
            <AlertDialogDescription>
              {emprestimoDevolvendo?.quantidade} {emprestimoDevolvendo?.quantidade === 1 ? "unidade" : "unidades"} de{" "}
              {emprestimoDevolvendo?.item}, com {emprestimoDevolvendo?.pessoa}. Confira
              se tudo voltou antes de confirmar: a devolução é do empréstimo inteiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDevolucao}>
              Registrar devolução
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={localRemovendo !== null}
        onOpenChange={(v) => !v && definirLocalRemovendo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {localRemovendo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O local sai da lista e não poderá mais ser escolhido nos itens.
              Itens descartados que estavam nele continuam com o nome antigo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocaoLocal}>
              Remover local
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Contador({
  valor,
  texto,
  ativo,
  aoClicar,
}: {
  valor: number;
  texto: string;
  ativo: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className={cn(
        "flex items-baseline gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ativo
          ? "border-tinta bg-tinta text-white"
          : "bg-card text-muted-foreground hover:border-tinta/40 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "font-display text-lg font-extrabold leading-none tabular-nums",
          !ativo && "text-foreground",
        )}
      >
        {valor}
      </span>
      {texto}
    </button>
  );
}

function FiltroSelect({
  rotuloFiltro,
  valor,
  aoMudar,
  opcoes,
}: {
  rotuloFiltro: string;
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: string[];
}) {
  return (
    <Select value={valor} onValueChange={aoMudar}>
      <SelectTrigger
        className="h-9 w-auto min-w-[140px] gap-2 bg-card"
        aria-label={`Filtrar por ${rotuloFiltro.toLowerCase()}`}
      >
        <SelectValue placeholder={rotuloFiltro} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{rotuloFiltro}: todos</SelectItem>
        {opcoes.map((o) => (
          <SelectItem key={o} value={o}>
            {rotulo(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColunaOrdenavel({
  chave,
  rotulo: texto,
  ordem,
  crescente,
  aoClicar,
  className,
}: {
  chave: ChaveOrdenacao;
  rotulo: string;
  ordem: ChaveOrdenacao;
  crescente: boolean;
  aoClicar: (chave: ChaveOrdenacao) => void;
  className?: string;
}) {
  const ativa = ordem === chave;
  return (
    <TableHead
      className={className}
      aria-sort={ativa ? (crescente ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => aoClicar(chave)}
        className="flex items-center gap-1 rounded font-semibold text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {texto}
        {ativa &&
          (crescente ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </TableHead>
  );
}

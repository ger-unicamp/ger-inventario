"use client";

import { useMemo, useState } from "react";
import { HandHelping, Search, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estaAtrasado } from "@/lib/mapeamento";
import type { Emprestimo, Item } from "@/lib/types";
import { cn, formatarData, hojeLocal, normalizar } from "@/lib/utils";

type Visao = "abertos" | "devolvidos" | "todos";

interface Props {
  emprestimos: Emprestimo[];
  itens: Item[];
  carregando: boolean;
  aoNovo: () => void;
  aoDevolver: (emprestimo: Emprestimo) => void;
}

export function Emprestimos({
  emprestimos,
  itens,
  carregando,
  aoNovo,
  aoDevolver,
}: Props) {
  const [visao, definirVisao] = useState<Visao>("abertos");
  const [busca, definirBusca] = useState("");
  const hoje = hojeLocal();

  const nomePorCodigo = useMemo(
    () => new Map(itens.map((i) => [i.codigo, i])),
    [itens],
  );

  const abertos = emprestimos.filter((e) => !e.devolvidoEm).length;
  const atrasados = emprestimos.filter((e) => estaAtrasado(e, hoje)).length;

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    const lista = emprestimos.filter((e) => {
      if (visao === "abertos" && e.devolvidoEm) return false;
      if (visao === "devolvidos" && !e.devolvidoEm) return false;
      if (!termo) return true;
      const alvo = normalizar(
        [e.id, e.codigo, nomePorCodigo.get(e.codigo)?.nome ?? e.item, e.pessoa, e.contato, e.observacoes].join(" "),
      );
      return termo.split(/\s+/).every((p) => alvo.includes(p));
    });

    // Abertos: atrasados primeiro, depois pelo prazo mais proximo, e sem
    // prazo por ultimo. Historico: o mais recente primeiro.
    return lista.sort((a, b) => {
      if (!a.devolvidoEm && !b.devolvidoEm) {
        const prazoA = a.devolverAte || "9999";
        const prazoB = b.devolverAte || "9999";
        return prazoA.localeCompare(prazoB) || a.retiradoEm.localeCompare(b.retiradoEm);
      }
      if (!a.devolvidoEm) return -1;
      if (!b.devolvidoEm) return 1;
      return b.devolvidoEm.localeCompare(a.devolvidoEm);
    });
  }, [emprestimos, visao, busca, nomePorCodigo]);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-emprestimos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-emprestimos" className="font-display text-xl font-extrabold">
            Empréstimos
          </h2>
          <p className="text-sm text-muted-foreground">
            {abertos === 0
              ? "Nada emprestado agora."
              : `${abertos} ${abertos === 1 ? "empréstimo aberto" : "empréstimos abertos"}${
                  atrasados > 0 ? `, ${atrasados} ${atrasados === 1 ? "atrasado" : "atrasados"}` : ""
                }.`}
          </p>
        </div>
        <Button onClick={aoNovo}>
          <HandHelping /> Novo empréstimo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Quais empréstimos mostrar"
          className="inline-flex rounded-md border bg-card p-0.5"
        >
          {(
            [
              ["abertos", "Abertos"],
              ["devolvidos", "Devolvidos"],
              ["todos", "Todos"],
            ] as const
          ).map(([chave, texto]) => (
            <button
              key={chave}
              type="button"
              onClick={() => definirVisao(chave)}
              aria-pressed={visao === chave}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                visao === chave
                  ? "bg-tinta text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
            placeholder="Buscar por pessoa, item ou código"
            aria-label="Buscar empréstimos"
            className="h-9 bg-card pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[96px]">Código</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Com quem</TableHead>
              <TableHead className="hidden md:table-cell">Saiu em</TableHead>
              <TableHead className="w-[150px]">Devolver até</TableHead>
              <TableHead className="w-[130px] text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!carregando && visiveis.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {emprestimos.length === 0
                    ? "Nenhum empréstimo registrado ainda."
                    : visao === "abertos" && !busca
                      ? "Tudo devolvido."
                      : "Nenhum empréstimo bate com a busca."}
                </TableCell>
              </TableRow>
            )}

            {visiveis.map((e) => {
              const atrasado = estaAtrasado(e, hoje);
              const item = nomePorCodigo.get(e.codigo);
              return (
                <TableRow key={e.id} className={cn(e.devolvidoEm && "text-muted-foreground")}>
                  <TableCell>
                    <span className={cn("fita", e.devolvidoEm && "opacity-50")}>{e.codigo}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{item?.nome ?? e.item}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.quantidade} {item?.unidade || "un"}
                      {e.observacoes ? `, ${e.observacoes}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground">{e.pessoa}</div>
                    {e.contato && (
                      <div className="text-xs text-muted-foreground">{e.contato}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">
                    {formatarData(e.retiradoEm)}
                    <div className="text-xs text-muted-foreground">por {e.registradoPor}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.devolvidoEm ? (
                      <span>Devolvido em {formatarData(e.devolvidoEm)}</span>
                    ) : atrasado ? (
                      <Badge variant="erro">Atrasado desde {formatarData(e.devolverAte)}</Badge>
                    ) : e.devolverAte ? (
                      formatarData(e.devolverAte)
                    ) : (
                      <span className="text-muted-foreground">sem prazo</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!e.devolvidoEm && (
                      <Button variant="outline" size="sm" onClick={() => aoDevolver(e)}>
                        <Undo2 /> Devolver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

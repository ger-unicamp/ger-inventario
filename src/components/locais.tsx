"use client";

import { useMemo } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  agruparPorMovel,
  casaFiltroDeLocal,
  FILTRO_SEM_LOCAL,
  filtroDeLocal,
  filtroDeMovel,
} from "@/lib/locais";
import type { Item, Local } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  locais: Local[];
  itens: Item[];
  carregando: boolean;
  aoNovo: (movel?: string) => void;
  aoEditar: (local: Local) => void;
  aoRemover: (local: Local) => void;
  /** Volta para a lista de itens com este filtro de local aplicado. */
  aoVerItens: (filtro: string) => void;
}

export function Locais({
  locais,
  itens,
  carregando,
  aoNovo,
  aoEditar,
  aoRemover,
  aoVerItens,
}: Props) {
  const grupos = useMemo(() => agruparPorMovel(locais), [locais]);

  // Contagem so de itens ativos: e o que importa para quem procura algo.
  const ativos = useMemo(
    () => itens.filter((i) => i.estado !== "Descartado"),
    [itens],
  );
  const contar = (filtro: string) =>
    ativos.filter((i) => casaFiltroDeLocal(i.local, filtro)).length;

  const semLocal = ativos.filter((i) => !i.local).length;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-locais">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-locais" className="font-display text-xl font-extrabold">
            Locais
          </h2>
          <p className="text-sm text-muted-foreground">
            Todo item aponta para um destes lugares. Renomear um local atualiza
            os itens dele.
          </p>
        </div>
        <Button onClick={() => aoNovo()}>
          <Plus /> Novo local
        </Button>
      </div>

      {!carregando && grupos.length === 0 && (
        <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum local cadastrado. Comece pelos móveis do laboratório: cada
          armário, bancada e estante.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grupos.map((grupo) => {
          const totalMovel = contar(filtroDeMovel(grupo.movel));
          return (
            <article
              key={grupo.movel}
              className="flex flex-col overflow-hidden rounded-md border bg-card"
            >
              <header className="flex items-center gap-2 border-b bg-secondary px-4 py-3">
                <h3 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">
                  {grupo.movel}
                </h3>
                <ContagemDeItens
                  total={totalMovel}
                  aoClicar={() => aoVerItens(filtroDeMovel(grupo.movel))}
                  rotulo={`Ver os itens de ${grupo.movel}`}
                />
                {grupo.inteiro && (
                  <AcoesDoLocal
                    local={grupo.inteiro}
                    emUso={contar(filtroDeLocal(grupo.inteiro.nome))}
                    aoEditar={aoEditar}
                    aoRemover={aoRemover}
                  />
                )}
              </header>

              {grupo.inteiro?.observacoes && (
                <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                  {grupo.inteiro.observacoes}
                </p>
              )}

              <ul className="flex-1 divide-y">
                {grupo.zonas.map((local) => {
                  const total = contar(filtroDeLocal(local.nome));
                  return (
                    <li key={local.nome} className="flex items-center gap-2 px-4 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{local.zona}</div>
                        {local.observacoes && (
                          <div className="truncate text-xs text-muted-foreground">
                            {local.observacoes}
                          </div>
                        )}
                      </div>
                      <ContagemDeItens
                        total={total}
                        aoClicar={() => aoVerItens(filtroDeLocal(local.nome))}
                        rotulo={`Ver os itens de ${local.nome}`}
                      />
                      <AcoesDoLocal
                        local={local}
                        emUso={total}
                        aoEditar={aoEditar}
                        aoRemover={aoRemover}
                      />
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => aoNovo(grupo.movel)}
                className="flex items-center gap-1 border-t px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Plus className="h-3 w-3" /> Zona em {grupo.movel}
              </button>
            </article>
          );
        })}
      </div>

      {semLocal > 0 && (
        <p className="text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => aoVerItens(FILTRO_SEM_LOCAL)}
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            {semLocal} {semLocal === 1 ? "item está" : "itens estão"} sem local
          </button>
          .
        </p>
      )}
    </section>
  );
}

function ContagemDeItens({
  total,
  aoClicar,
  rotulo,
}: {
  total: number;
  aoClicar: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={total === 0}
      title={rotulo}
      aria-label={`${rotulo} (${total})`}
      className={cn(
        "shrink-0 rounded px-1.5 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        total > 0
          ? "font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
          : "text-muted-foreground",
      )}
    >
      {total} {total === 1 ? "item" : "itens"}
    </button>
  );
}

function AcoesDoLocal({
  local,
  emUso,
  aoEditar,
  aoRemover,
}: {
  local: Local;
  emUso: number;
  aoEditar: (local: Local) => void;
  aoRemover: (local: Local) => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title={`Editar ${local.nome}`}
        onClick={() => aoEditar(local)}
      >
        <Pencil />
      </Button>
      {/* O title fica no span: botao desabilitado nao recebe hover. */}
      <span
        title={
          emUso > 0
            ? `Mova ${emUso === 1 ? "o item" : `os ${emUso} itens`} antes de remover`
            : undefined
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Remover ${local.nome}`}
          disabled={emUso > 0}
          onClick={() => aoRemover(local)}
        >
          <Trash2 />
        </Button>
      </span>
    </div>
  );
}

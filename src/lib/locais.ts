/**
 * Regras de exibicao e filtro de locais, compartilhadas pelas telas.
 * Puro: sem rede, roda no cliente.
 */

import { SEPARADOR_LOCAL, type Local } from "./types";

export interface GrupoDeMovel {
  movel: string;
  /** O local "movel inteiro" (zona vazia), se estiver cadastrado. */
  inteiro: Local | null;
  /** Zonas do movel, em ordem alfabetica. */
  zonas: Local[];
}

const comparar = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { numeric: true });

export function agruparPorMovel(locais: Local[]): GrupoDeMovel[] {
  const grupos = new Map<string, GrupoDeMovel>();
  for (const local of locais) {
    const grupo = grupos.get(local.movel) ?? {
      movel: local.movel,
      inteiro: null,
      zonas: [],
    };
    if (local.zona) grupo.zonas.push(local);
    else grupo.inteiro = local;
    grupos.set(local.movel, grupo);
  }
  const lista = [...grupos.values()].sort((a, b) => comparar(a.movel, b.movel));
  for (const grupo of lista) grupo.zonas.sort((a, b) => comparar(a.zona, b.zona));
  return lista;
}

/*
 * Valor do filtro de local. Prefixado porque o mesmo texto pode ser um
 * movel inteiro ("Armario B" e tudo dentro dele) ou um local exato.
 */
export const FILTRO_SEM_LOCAL = "sem:";

export function filtroDeMovel(movel: string): string {
  return `movel:${movel}`;
}

export function filtroDeLocal(nome: string): string {
  return `local:${nome}`;
}

/** O item com local `local` passa no filtro `filtro`? */
export function casaFiltroDeLocal(local: string, filtro: string): boolean {
  if (filtro === FILTRO_SEM_LOCAL) return local === "";
  if (filtro.startsWith("local:")) return local === filtro.slice(6);
  if (filtro.startsWith("movel:")) {
    const movel = filtro.slice(6);
    return local === movel || local.startsWith(movel + SEPARADOR_LOCAL);
  }
  return true;
}

/** Texto curto para mostrar o filtro ativo. */
export function descreverFiltroDeLocal(filtro: string): string {
  if (filtro === FILTRO_SEM_LOCAL) return "Sem local";
  if (filtro.startsWith("local:")) return filtro.slice(6);
  if (filtro.startsWith("movel:")) return `${filtro.slice(6)} (inteiro)`;
  return filtro;
}

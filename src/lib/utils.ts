import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Remove acentos e baixa a caixa, para busca tolerante a acentuacao. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Data de hoje no fuso do navegador, em "AAAA-MM-DD". */
export function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * "AAAA-MM-DD" ou ISO completo para "16/10/2026". Data pura e lida sem
 * fuso: new Date("2026-10-16") seria meia-noite UTC, que no Brasil ainda
 * e dia 15.
 */
export function formatarData(valor: string): string {
  if (!valor) return "";
  const pura = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (pura) return `${pura[3]}/${pura[2]}/${pura[1]}`;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

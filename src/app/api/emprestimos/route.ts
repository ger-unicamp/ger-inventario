import { NextResponse } from "next/server";
import {
  devolver,
  emprestar,
  EmprestimoInvalido,
  EmprestimoNaoEncontrado,
  ItemNaoEncontrado,
  listarEmprestimos,
} from "@/lib/sheets";
import type { NovoEmprestimo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function lerAutor(corpo: Record<string, unknown>): string {
  return typeof corpo.autor === "string" && corpo.autor.trim()
    ? corpo.autor.trim()
    : "desconhecido";
}

function lerEmprestimo(corpo: Record<string, unknown>): NovoEmprestimo {
  const str = (chave: keyof NovoEmprestimo) => {
    const valor = corpo[chave];
    return typeof valor === "string" ? valor.trim() : "";
  };
  const quantidade = Number(corpo.quantidade);
  return {
    codigo: str("codigo"),
    quantidade: Number.isFinite(quantidade) ? quantidade : 1,
    pessoa: str("pessoa"),
    contato: str("contato"),
    devolverAte: str("devolverAte"),
    observacoes: str("observacoes"),
  };
}

function erroHttp(erro: unknown) {
  if (erro instanceof ItemNaoEncontrado || erro instanceof EmprestimoNaoEncontrado) {
    return NextResponse.json({ erro: erro.message }, { status: 404 });
  }
  if (erro instanceof EmprestimoInvalido) {
    return NextResponse.json({ erro: erro.message }, { status: 409 });
  }
  return NextResponse.json({ erro: (erro as Error).message }, { status: 500 });
}

export async function GET(requisicao: Request) {
  const forcar = new URL(requisicao.url).searchParams.get("recarregar") === "1";
  try {
    return NextResponse.json({ emprestimos: await listarEmprestimos(forcar) });
  } catch (erro) {
    return erroHttp(erro);
  }
}

/** Registra um emprestimo novo. */
export async function POST(requisicao: Request) {
  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const emprestimo = await emprestar(lerEmprestimo(corpo), lerAutor(corpo));
    return NextResponse.json({ emprestimo }, { status: 201 });
  } catch (erro) {
    return erroHttp(erro);
  }
}

/** Registra a devolucao do emprestimo `id`. */
export async function PATCH(requisicao: Request) {
  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const id = typeof corpo.id === "string" ? corpo.id : "";
    const emprestimo = await devolver(id, lerAutor(corpo));
    return NextResponse.json({ emprestimo });
  } catch (erro) {
    return erroHttp(erro);
  }
}

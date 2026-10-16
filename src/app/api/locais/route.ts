import { NextResponse } from "next/server";
import {
  criarLocal,
  editarLocal,
  listarLocais,
  LocalInvalido,
  LocalNaoEncontrado,
  removerLocal,
} from "@/lib/sheets";
import type { NovoLocal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
 * O local e identificado pelo nome ("Armario B / Gaveta 3"), que tem barra.
 * Por isso vai no corpo ou na query, e nao como segmento da URL.
 */

function lerLocal(corpo: Record<string, unknown>): NovoLocal {
  const str = (chave: keyof NovoLocal) => {
    const valor = corpo[chave];
    return typeof valor === "string" ? valor.trim() : "";
  };
  return { movel: str("movel"), zona: str("zona"), observacoes: str("observacoes") };
}

function erroHttp(erro: unknown) {
  if (erro instanceof LocalNaoEncontrado) {
    return NextResponse.json({ erro: erro.message }, { status: 404 });
  }
  if (erro instanceof LocalInvalido) {
    return NextResponse.json({ erro: erro.message }, { status: 409 });
  }
  return NextResponse.json({ erro: (erro as Error).message }, { status: 500 });
}

export async function GET(requisicao: Request) {
  const forcar = new URL(requisicao.url).searchParams.get("recarregar") === "1";
  try {
    return NextResponse.json({ locais: await listarLocais(forcar) });
  } catch (erro) {
    return erroHttp(erro);
  }
}

export async function POST(requisicao: Request) {
  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const local = await criarLocal(lerLocal(corpo));
    return NextResponse.json({ local }, { status: 201 });
  } catch (erro) {
    return erroHttp(erro);
  }
}

/** Edita o local `nomeAtual`. Se o nome mudar, os itens dele sao reescritos. */
export async function PATCH(requisicao: Request) {
  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const nomeAtual = typeof corpo.nomeAtual === "string" ? corpo.nomeAtual : "";
    const autor =
      typeof corpo.autor === "string" && corpo.autor.trim()
        ? corpo.autor.trim()
        : "desconhecido";

    const resultado = await editarLocal(nomeAtual, lerLocal(corpo), autor);
    return NextResponse.json(resultado);
  } catch (erro) {
    return erroHttp(erro);
  }
}

export async function DELETE(requisicao: Request) {
  const nome = new URL(requisicao.url).searchParams.get("nome") ?? "";
  try {
    await removerLocal(nome);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return erroHttp(erro);
  }
}

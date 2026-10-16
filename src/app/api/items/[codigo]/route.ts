import { NextResponse } from "next/server";
import {
  atualizarItem,
  darBaixa,
  EmprestimoInvalido,
  ItemNaoEncontrado,
  LocalInvalido,
} from "@/lib/sheets";
import type { NovoItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Contexto = { params: Promise<{ codigo: string }> };

const CAMPOS_EDITAVEIS: (keyof NovoItem)[] = [
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
];

function erroHttp(erro: unknown) {
  if (erro instanceof ItemNaoEncontrado) {
    return NextResponse.json({ erro: erro.message }, { status: 404 });
  }
  if (erro instanceof LocalInvalido) {
    return NextResponse.json({ erro: erro.message }, { status: 400 });
  }
  if (erro instanceof EmprestimoInvalido) {
    return NextResponse.json({ erro: erro.message }, { status: 409 });
  }
  return NextResponse.json({ erro: (erro as Error).message }, { status: 500 });
}

export async function PATCH(requisicao: Request, contexto: Contexto) {
  const { codigo } = await contexto.params;

  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const autor =
      typeof corpo.autor === "string" && corpo.autor.trim()
        ? corpo.autor.trim()
        : "desconhecido";

    const alteracoes: Partial<NovoItem> = {};
    for (const campo of CAMPOS_EDITAVEIS) {
      if (!(campo in corpo)) continue;
      const valor = corpo[campo];
      if (campo === "quantidade") {
        const numero = Number(valor);
        if (Number.isFinite(numero)) alteracoes.quantidade = numero;
      } else if (typeof valor === "string") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (alteracoes as any)[campo] = valor.trim();
      }
    }

    if (alteracoes.nome === "") {
      return NextResponse.json(
        { erro: "O nome do item nao pode ficar vazio." },
        { status: 400 },
      );
    }

    const item = await atualizarItem(codigo, alteracoes, autor);
    return NextResponse.json({ item });
  } catch (erro) {
    return erroHttp(erro);
  }
}

/** Baixa: marca como Descartado, mantendo a linha e o historico na planilha. */
export async function DELETE(requisicao: Request, contexto: Contexto) {
  const { codigo } = await contexto.params;
  const autor = new URL(requisicao.url).searchParams.get("autor") || "desconhecido";

  try {
    const item = await darBaixa(codigo, autor);
    return NextResponse.json({ item });
  } catch (erro) {
    return erroHttp(erro);
  }
}

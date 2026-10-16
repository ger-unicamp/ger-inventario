import { NextResponse } from "next/server";
import { criarItem, listarTudo, LocalInvalido } from "@/lib/sheets";
import { ITEM_VAZIO, type NovoItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Normaliza o corpo recebido para o formato de NovoItem, campo a campo. */
function lerCorpo(corpo: Record<string, unknown>): NovoItem {
  const str = (chave: keyof NovoItem, padrao: string) => {
    const valor = corpo[chave];
    return typeof valor === "string" ? valor.trim() : padrao;
  };

  const quantidadeBruta = Number(corpo.quantidade);

  return {
    nome: str("nome", ""),
    categoria: str("categoria", ITEM_VAZIO.categoria),
    projeto: str("projeto", ITEM_VAZIO.projeto),
    local: str("local", ""),
    quantidade: Number.isFinite(quantidadeBruta) ? quantidadeBruta : 1,
    unidade: str("unidade", ITEM_VAZIO.unidade),
    nivel: str("nivel", "") as NovoItem["nivel"],
    estado: str("estado", ITEM_VAZIO.estado) as NovoItem["estado"],
    patrimonio: str("patrimonio", ""),
    observacoes: str("observacoes", ""),
  };
}

export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url);
  const forcar = url.searchParams.get("recarregar") === "1";

  try {
    const { itens, locais, emprestimos } = await listarTudo(forcar);
    return NextResponse.json({ itens, locais, emprestimos });
  } catch (erro) {
    return NextResponse.json(
      { erro: (erro as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(requisicao: Request) {
  try {
    const corpo = (await requisicao.json()) as Record<string, unknown>;
    const autor =
      typeof corpo.autor === "string" && corpo.autor.trim()
        ? corpo.autor.trim()
        : "desconhecido";

    const dados = lerCorpo(corpo);
    if (!dados.nome) {
      return NextResponse.json(
        { erro: "O nome do item e obrigatorio." },
        { status: 400 },
      );
    }

    const item = await criarItem(dados, autor);
    return NextResponse.json({ item }, { status: 201 });
  } catch (erro) {
    if (erro instanceof LocalInvalido) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    return NextResponse.json(
      { erro: (erro as Error).message },
      { status: 500 },
    );
  }
}

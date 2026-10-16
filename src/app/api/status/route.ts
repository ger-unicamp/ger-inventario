import { NextResponse } from "next/server";
import { idPlanilha, nomeAba, verificarPlanilha } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Usado pela tela inicial para avisar cedo quando a credencial esta errada. */
export async function GET() {
  try {
    const resultado = await verificarPlanilha();
    return NextResponse.json({
      ...resultado,
      planilha: idPlanilha(),
      aba: nomeAba(),
      url: `https://docs.google.com/spreadsheets/d/${idPlanilha()}`,
    });
  } catch (erro) {
    return NextResponse.json(
      { ok: false, erro: (erro as Error).message },
      { status: 500 },
    );
  }
}

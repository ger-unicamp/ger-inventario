/**
 * Gera uma folha A4 de etiquetas para imprimir, lendo os itens da planilha.
 *
 *   npm run etiquetas                      # todos os itens ativos
 *   npm run etiquetas -- --de 0001 --ate 0120
 *   npm run etiquetas -- --projeto "Braco Robotico"
 *   npm run etiquetas -- --saida /caminho/etiquetas.html
 *
 * Abra o HTML gerado no navegador e mande imprimir (Ctrl+P), com margens
 * "padrao" e a escala em 100%. Imprimir fora de 100% desalinha a grade.
 *
 * A etiqueta e deliberadamente minima: o codigo grande, para ser lido de
 * longe dentro da gaveta, e o nome pequeno so para conferencia. Nome, local
 * e projeto mudam; o codigo nao. Tudo o mais se consulta no sistema.
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { google } from "googleapis";

interface Linha {
  codigo: string;
  nome: string;
  estado: string;
}

function argumento(nome: string): string | undefined {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`\nFalta a variavel ${nome} no .env. Veja o README.\n`);
    process.exit(1);
  }
  return valor;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function montarHtml(itens: Linha[]): string {
  const etiquetas = itens
    .map(
      (item) => `    <div class="etiqueta">
      <span class="codigo">${escapar(item.codigo)}</span>
      <span class="nome">${escapar(item.nome)}</span>
    </div>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Etiquetas — Inventario GER (${itens.length})</title>
<style>
  /* Grade pensada para folha A4 de etiquetas 3 x 8 (aprox. 63,5 x 33,9 mm),
     formato comum no Brasil (Pimaco 6180 / Avery 3474). Se a sua folha for
     outra, ajuste --colunas, --largura e --altura abaixo. */
  :root {
    --colunas: 3;
    --largura: 63.5mm;
    --altura: 33.9mm;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 8mm 5mm;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif;
    background: #fff;
    color: #000;
  }
  .aviso {
    margin: 0 0 6mm;
    padding: 3mm;
    border: 1px dashed #999;
    font-size: 10pt;
    color: #444;
  }
  .folha {
    display: grid;
    grid-template-columns: repeat(var(--colunas), var(--largura));
    gap: 0;
  }
  .etiqueta {
    width: var(--largura);
    height: var(--altura);
    padding: 2mm 3mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1mm;
    overflow: hidden;
    border: 0.2mm dotted #ccc; /* guia de corte; some na impressao */
  }
  .codigo {
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 26pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
  }
  .nome {
    font-size: 7pt;
    line-height: 1.15;
    text-align: center;
    max-height: 2.6em;
    overflow: hidden;
  }
  @media print {
    body { padding: 8mm 5mm; }
    .aviso { display: none; }
    .etiqueta { border: none; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
  <p class="aviso">
    ${itens.length} etiquetas. Imprima em A4 com escala 100% (nao use
    "ajustar a pagina", senao a grade desalinha). Faca um teste em papel comum
    antes de gastar a folha adesiva. Esta caixa nao sai na impressao.
  </p>
  <div class="folha">
${etiquetas}
  </div>
</body>
</html>
`;
}

async function main() {
  const idPlanilha = exigir("GOOGLE_SHEETS_ID");
  const aba = process.env.GOOGLE_SHEETS_ABA || "Inventario";
  const email = exigir("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const chave = exigir("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: chave,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: idPlanilha,
    range: `${aba}!A2:M`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const de = argumento("de");
  const ate = argumento("ate");
  const projetoFiltro = argumento("projeto");
  const saida = argumento("saida") ?? path.resolve("etiquetas.html");

  const itens: Linha[] = (resposta.data.values ?? [])
    .map((linha) => ({
      codigo: String(linha[0] ?? "").trim().padStart(4, "0"),
      nome: String(linha[1] ?? "").trim(),
      projeto: String(linha[3] ?? "").trim(),
      estado: String(linha[8] ?? "").trim(),
    }))
    .filter((item) => item.codigo && item.codigo !== "0000")
    .filter((item) => item.estado !== "Descartado")
    .filter((item) => (de ? item.codigo >= de.padStart(4, "0") : true))
    .filter((item) => (ate ? item.codigo <= ate.padStart(4, "0") : true))
    .filter((item) => (projetoFiltro ? item.projeto === projetoFiltro : true))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  if (itens.length === 0) {
    console.error("Nenhum item bate com esse filtro. Nada foi gerado.");
    process.exit(1);
  }

  writeFileSync(saida, montarHtml(itens), "utf8");
  console.log(`${itens.length} etiquetas geradas em:\n  ${saida}\n`);
  console.log("Abra no navegador e imprima com escala 100%.");
}

main().catch((erro: Error) => {
  console.error("\nFalhou:", erro.message);
  process.exit(1);
});

/**
 * Prepara a planilha: cria as abas do inventario e de locais, escreve os
 * cabecalhos, congela a primeira linha e aplica validacao nas colunas de
 * lista.
 *
 * Rode uma vez, depois de compartilhar a planilha com a service account:
 *   npm run init-sheet
 *
 * E idempotente: rodar de novo nao apaga dados nem duplica abas. Tambem
 * migra os locais em texto livre que ja estiverem nos itens para a aba
 * Locais, sem mexer nos itens, e recalcula a coluna Nome da aba Locais.
 */

import "dotenv/config";
import { google, type sheets_v4 } from "googleapis";

import {
  linhaParaItem,
  linhaParaLocal,
  localParaLinha,
  nomeDoLocal,
  separarLocal,
} from "../src/lib/mapeamento";
import {
  CABECALHO,
  CABECALHO_EMPRESTIMO,
  CABECALHO_LOCAL,
  CATEGORIAS,
  ESTADOS,
  NIVEIS,
  PROJETOS,
} from "../src/lib/types";

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`\nFalta a variavel ${nome} no .env. Veja o README.\n`);
    process.exit(1);
  }
  return valor;
}

function validacaoDeLista(
  idAba: number,
  coluna: number,
  valores: readonly string[],
): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: {
        sheetId: idAba,
        startRowIndex: 1,
        startColumnIndex: coluna,
        endColumnIndex: coluna + 1,
      },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: valores.filter(Boolean).map((v) => ({ userEnteredValue: v })),
        },
        showCustomUi: true,
        // Aviso em vez de bloqueio: alguem editando direto na planilha nao
        // pode ficar travado por causa de um valor novo.
        strict: false,
      },
    },
  };
}

function validacaoDeIntervalo(
  idAba: number,
  coluna: number,
  intervalo: string,
): sheets_v4.Schema$Request {
  return {
    setDataValidation: {
      range: {
        sheetId: idAba,
        startRowIndex: 1,
        startColumnIndex: coluna,
        endColumnIndex: coluna + 1,
      },
      rule: {
        condition: {
          type: "ONE_OF_RANGE",
          values: [{ userEnteredValue: `=${intervalo}` }],
        },
        showCustomUi: true,
        strict: false,
      },
    },
  };
}

function congelarECabecalhoEmNegrito(idAba: number): sheets_v4.Schema$Request[] {
  return [
    {
      updateSheetProperties: {
        properties: { sheetId: idAba, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId: idAba, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: "userEnteredFormat.textFormat.bold",
      },
    },
  ];
}

/** Devolve o id da aba, criando-a se nao existir. */
async function garantirAba(
  sheets: sheets_v4.Sheets,
  idPlanilha: string,
  existentes: sheets_v4.Schema$Sheet[],
  titulo: string,
  colunas: number,
): Promise<number> {
  const id = existentes.find((s) => s.properties?.title === titulo)?.properties
    ?.sheetId;
  if (id !== undefined && id !== null) {
    console.log(`Aba "${titulo}" ja existe. Mantendo os dados.`);
    return id;
  }

  console.log(`Aba "${titulo}" nao existe. Criando...`);
  const criada = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: idPlanilha,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: titulo,
              gridProperties: { rowCount: 2000, columnCount: colunas },
            },
          },
        },
      ],
    },
  });
  const novo = criada.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (novo === undefined || novo === null) {
    throw new Error(`Nao consegui criar a aba "${titulo}".`);
  }
  return novo;
}

async function main() {
  const idPlanilha = exigir("GOOGLE_SHEETS_ID");
  const aba = process.env.GOOGLE_SHEETS_ABA || "Inventario";
  const abaLocais = process.env.GOOGLE_SHEETS_ABA_LOCAIS || "Locais";
  const abaEmprestimos = process.env.GOOGLE_SHEETS_ABA_EMPRESTIMOS || "Emprestimos";
  const email = exigir("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const chave = exigir("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: chave,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`Planilha: ${idPlanilha}`);
  console.log(`Abas:     ${aba}, ${abaLocais}, ${abaEmprestimos}\n`);

  const planilha = await sheets.spreadsheets.get({ spreadsheetId: idPlanilha });
  console.log(`Conectado em "${planilha.data.properties?.title}".`);
  const existentes = planilha.data.sheets ?? [];

  const idAba = await garantirAba(sheets, idPlanilha, existentes, aba, 13);
  const idAbaLocais = await garantirAba(sheets, idPlanilha, existentes, abaLocais, 4);
  const idAbaEmprestimos = await garantirAba(
    sheets,
    idPlanilha,
    existentes,
    abaEmprestimos,
    CABECALHO_EMPRESTIMO.length,
  );

  /* ---------------- cabecalhos ---------------- */

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: idPlanilha,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${aba}!A1:M1`, values: [CABECALHO] },
        // RAW: texto puro. Tambem sobrescreve a formula que versoes antigas
        // deste script punham em D1 (dava #ERROR! em planilha pt_BR).
        { range: `${abaLocais}!A1:D1`, values: [CABECALHO_LOCAL] },
        { range: `${abaEmprestimos}!A1:L1`, values: [CABECALHO_EMPRESTIMO] },
      ],
    },
  });
  console.log("Cabecalhos escritos.");

  /* ---------------- migracao dos locais ---------------- */

  const [leituraItens, leituraLocais] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: idPlanilha,
      range: `${aba}!A2:M`,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: idPlanilha,
      range: `${abaLocais}!A2:D`,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  ]);

  const linhasLocais = leituraLocais.data.values ?? [];
  const jaCadastrados = new Set(linhasLocais.map((l) => linhaParaLocal(l).nome));

  const novos = new Map<string, { movel: string; zona: string }>();
  for (const linha of leituraItens.data.values ?? []) {
    const local = linhaParaItem(linha).local;
    if (!local || jaCadastrados.has(local) || novos.has(local)) continue;
    const partes = separarLocal(local);
    // So migra se o nome remontado for igual ao original. Senao (ex.:
    // espacos estranhos em volta da barra) o item ficaria apontando para
    // um local que nao casa, e e melhor corrigir a mao.
    if (nomeDoLocal(partes.movel, partes.zona) !== local) {
      console.log(`  Pulando "${local}": grafia fora do padrao "Movel / Zona".`);
      continue;
    }
    novos.set(local, partes);
  }

  // Coluna Nome das linhas existentes, recalculada de Movel e Zona: corrige
  // quem editou na mao. So a coluna D; A:C sao dados de gente e ficam como estao.
  const escrita: sheets_v4.Schema$ValueRange[] = [];
  if (linhasLocais.length > 0) {
    escrita.push({
      range: `${abaLocais}!D2:D${linhasLocais.length + 1}`,
      values: linhasLocais.map((l) => [linhaParaLocal(l).nome]),
    });
  }

  if (novos.size > 0) {
    const primeira = linhasLocais.length + 2;
    const ultima = primeira + novos.size - 1;
    escrita.push({
      range: `${abaLocais}!A${primeira}:D${ultima}`,
      values: [...novos.values()].map((l) => localParaLinha({ ...l, observacoes: "" })),
    });
  }

  if (escrita.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: idPlanilha,
      requestBody: { valueInputOption: "RAW", data: escrita },
    });
  }
  console.log(
    novos.size > 0
      ? `${novos.size} local(is) migrado(s) dos itens para "${abaLocais}".`
      : "Nenhum local novo para migrar.",
  );
  console.log(`Coluna Nome de "${abaLocais}" recalculada.`);

  /* ---------------- formatacao e validacoes ---------------- */

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: idPlanilha,
    requestBody: {
      requests: [
        ...congelarECabecalhoEmNegrito(idAba),
        ...congelarECabecalhoEmNegrito(idAbaLocais),
        ...congelarECabecalhoEmNegrito(idAbaEmprestimos),
        // Id e codigo do item como texto, pelo mesmo motivo do codigo abaixo.
        {
          repeatCell: {
            range: {
              sheetId: idAbaEmprestimos,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 2,
            },
            cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        // Codigo como texto, senao o Sheets come os zeros a esquerda de "0001".
        {
          repeatCell: {
            range: {
              sheetId: idAba,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "TEXT" },
                horizontalAlignment: "LEFT",
              },
            },
            fields:
              "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
          },
        },
        validacaoDeLista(idAba, 2, CATEGORIAS),
        validacaoDeLista(idAba, 3, PROJETOS),
        validacaoDeIntervalo(idAba, 4, `'${abaLocais}'!D2:D`),
        validacaoDeLista(idAba, 7, NIVEIS),
        validacaoDeLista(idAba, 8, ESTADOS),
      ],
    },
  });

  console.log("Formatacao e validacoes aplicadas.");
  console.log(
    `\nPronto. Abra: https://docs.google.com/spreadsheets/d/${idPlanilha}\n`,
  );
}

main().catch((erro: Error) => {
  console.error("\nFalhou:", erro.message);
  if (erro.message.includes("not found") || erro.message.includes("403")) {
    console.error(
      "\nVerifique se a planilha foi compartilhada como Editor com o e-mail da service account.\n",
    );
  }
  process.exit(1);
});

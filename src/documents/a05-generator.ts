import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  AlignmentType,
  VerticalAlign,
  PageOrientation,
  WidthType,
} from "docx";
import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { clients, monthlyRecords, users, facilities } from "../db/schema.js";
import { formatRocDate } from "../utils/roc-year.js";
import { VISIT_TYPE_LABELS } from "../utils/constants.js";
import { cell, para, textRun, checkbox } from "./docx-engine.js";

export async function generateA05Document(
  clientId: string,
  rocYear: number
): Promise<Buffer> {
  // Fetch data
  const [clientResult] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const [facilityResult] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, clientResult.facilityId))
    .limit(1);

  const records = await db
    .select()
    .from(monthlyRecords)
    .leftJoin(users, eq(monthlyRecords.socialWorkerId, users.id))
    .where(
      and(
        eq(monthlyRecords.clientId, clientId),
        eq(monthlyRecords.rocYear, rocYear)
      )
    )
    .orderBy(monthlyRecords.month);

  // Build record map by month
  const recordMap = new Map<number, (typeof records)[0]>();
  for (const r of records) {
    recordMap.set(r.monthly_records.month, r);
  }

  // Build document
  const headerRows: TableRow[] = [
    // Row 1: Facility name + title
    new TableRow({
      children: [
        cell([para("")], { width: 2000 }),
        cell(
          [
            para(`${rocYear}年度個案動態記錄表`, {
              alignment: AlignmentType.CENTER,
              bold: true,
              size: 40,
            }),
          ],
          { width: 5500 }
        ),
        cell([para("")], { width: 2500 }),
      ],
    }),
    // Row 2: Case number + creation date
    new TableRow({
      children: [
        cell(
          [para(`案號：${clientResult.caseNumber}`)],
          { width: 2000 }
        ),
        cell([para("")], { width: 5500 }),
        cell(
          [
            para(
              `制訂日期：${formatRocDate(new Date(clientResult.creationDate))}`,
              { alignment: AlignmentType.RIGHT }
            ),
            para(`（${clientResult.revisionLabel || "初版"}）`, {
              alignment: AlignmentType.RIGHT,
            }),
          ],
          { width: 2500 }
        ),
      ],
    }),
    // Row 3: Name + case open date
    new TableRow({
      children: [
        cell(
          [para(`姓名：${clientResult.name}`)],
          { width: 2000 }
        ),
        cell([para("")], { width: 5500 }),
        cell(
          [
            para(
              `開案日期：${formatRocDate(new Date(clientResult.caseOpenDate))}`
            ),
          ],
          { width: 2500 }
        ),
      ],
    }),
  ];

  // Column header row
  const columnHeaderRow = new TableRow({
    children: [
      cell([para("日期")], { width: 2000 }),
      cell([para("訪視內容")], { width: 8000 }),
    ],
  });

  // Monthly rows
  const monthlyRows: TableRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const record = recordMap.get(month);
    const visitTypes = (record?.monthly_records.visitTypes || []) as string[];
    const otherDesc = record?.monthly_records.otherDescription || "";
    const content = record?.monthly_records.visitContent || "";
    const workerName = record?.users?.displayName || "";

    // Visit type checkboxes
    const checkboxRuns = Object.entries(VISIT_TYPE_LABELS).flatMap(
      ([key, label]) => {
        const checked = visitTypes.includes(key);
        if (key === "other" && otherDesc) {
          return [
            ...checkbox(checked, label),
            textRun(`：${otherDesc}`),
          ];
        }
        return checkbox(checked, label);
      }
    );

    // Content row (date + visit content)
    monthlyRows.push(
      new TableRow({
        children: [
          cell(
            [
              para(`${rocYear}年${String(month).padStart(2, "0")}月日`, {
                alignment: AlignmentType.CENTER,
              }),
            ],
            { width: 2000, verticalAlign: VerticalAlign.TOP }
          ),
          cell(
            [
              para(checkboxRuns),
              ...(content
                ? content.split("\n").map((line) => para(line.trim()))
                : [para("")]),
            ],
            { width: 8000, verticalAlign: VerticalAlign.TOP }
          ),
        ],
      })
    );

    // Social worker row
    monthlyRows.push(
      new TableRow({
        children: [
          cell(
            [para(`社工員：${workerName}`)],
            { width: 2000, verticalAlign: VerticalAlign.CENTER }
          ),
          cell([para("")], { width: 8000 }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          para(facilityResult.name, {
            alignment: AlignmentType.CENTER,
            bold: true,
            size: 40,
          }),
          new Table({
            rows: [...headerRows],
            width: { size: 10000, type: WidthType.DXA },
          }),
          new Table({
            rows: [columnHeaderRow, ...monthlyRows],
            width: { size: 10000, type: WidthType.DXA },
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

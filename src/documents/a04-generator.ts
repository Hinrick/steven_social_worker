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
import {
  clients,
  facilities,
  users,
  clientAssessments,
  clientFamilyMembers,
  quarterlyFollowups,
  familyDiscussions,
} from "../db/schema.js";
import { formatRocDate, calculateAge } from "../utils/roc-year.js";
import { FAMILY_MEMBER_LABELS } from "../utils/constants.js";
import { cell, para, textRun, checkbox } from "./docx-engine.js";

export async function generateA04Document(
  clientId: string,
  rocYear: number
): Promise<Buffer> {
  // Fetch all data
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

  const assessments = await db
    .select()
    .from(clientAssessments)
    .where(
      and(
        eq(clientAssessments.clientId, clientId),
        eq(clientAssessments.rocYear, rocYear)
      )
    )
    .limit(1);
  const assessment = assessments[0] || null;

  const familyMembers = await db
    .select()
    .from(clientFamilyMembers)
    .where(eq(clientFamilyMembers.clientId, clientId));

  const quarterlies = await db
    .select()
    .from(quarterlyFollowups)
    .where(
      and(
        eq(quarterlyFollowups.clientId, clientId),
        eq(quarterlyFollowups.rocYear, rocYear)
      )
    )
    .orderBy(quarterlyFollowups.quarter);

  const familyDisc = await db
    .select()
    .from(familyDiscussions)
    .where(
      and(
        eq(familyDiscussions.clientId, clientId),
        eq(familyDiscussions.rocYear, rocYear)
      )
    )
    .orderBy(familyDiscussions.half);

  // Assigned worker
  let workerName = "";
  if (clientResult.assignedWorkerId) {
    const [worker] = await db
      .select()
      .from(users)
      .where(eq(users.id, clientResult.assignedWorkerId))
      .limit(1);
    if (worker) workerName = worker.displayName;
  }

  const dob = new Date(clientResult.dateOfBirth);
  const age = calculateAge(dob);

  // Build family member checkbox display
  const familyMemberMap = new Map(
    familyMembers.map((fm) => [fm.memberType, fm])
  );

  const familyCheckboxRuns = Object.entries(FAMILY_MEMBER_LABELS).flatMap(
    ([key, label]) => {
      const member = familyMemberMap.get(key as any);
      const checked = !!member;
      const countStr = member && member.count > 0 ? ` ${member.count} ` : "   ";
      if (key === "other" && member?.description) {
        return [
          ...checkbox(checked, label),
          textRun(`：${member.description}  `),
        ];
      }
      return [...checkbox(checked, `${label} ${countStr}人  `)];
    }
  );

  // Treatment plan rendering
  const treatmentPlanParagraphs: Paragraph[] = [];
  if (assessment?.treatmentPlan) {
    const plan = assessment.treatmentPlan as {
      sections: { title: string; items: string[] }[];
    };
    for (const section of plan.sections) {
      treatmentPlanParagraphs.push(para(section.title));
      for (const item of section.items) {
        treatmentPlanParagraphs.push(para(item));
      }
    }
  }

  // Quarterly followup rows
  const quarterlyMap = new Map(quarterlies.map((q) => [q.quarter, q]));
  const q1 = quarterlyMap.get(1);
  const q2 = quarterlyMap.get(2);
  const q3 = quarterlyMap.get(3);
  const q4 = quarterlyMap.get(4);

  const formatTrackingDate = (q: typeof q1) => {
    if (!q?.trackingDate) return `${rocYear}年月日`;
    return formatRocDate(new Date(q.trackingDate));
  };

  // Family discussion rows
  const familyDiscMap = new Map(familyDisc.map((f) => [f.half, f]));
  const fd1 = familyDiscMap.get(1);
  const fd2 = familyDiscMap.get(2);

  const formatDiscDate = (fd: typeof fd1) => {
    if (!fd?.discussionDate) return `${rocYear}年月日`;
    return formatRocDate(new Date(fd.discussionDate));
  };

  // Case problems text
  const caseProblemsText: Paragraph[] = [];
  if (assessment) {
    caseProblemsText.push(para("ㄧ、生理能力："));
    if (assessment.languageAbility) {
      caseProblemsText.push(para(`  (一)語言能力：`));
      for (const line of assessment.languageAbility.split("\n")) {
        caseProblemsText.push(para(`    ${line.trim()}`));
      }
    }
    if (assessment.selfCareAbility) {
      caseProblemsText.push(para(`  (二)自理能力：`));
      for (const line of assessment.selfCareAbility.split("\n")) {
        caseProblemsText.push(para(`    ${line.trim()}`));
      }
    }
    if (assessment.intelligenceAbility) {
      caseProblemsText.push(para(`  (三)智力能力：`));
      for (const line of assessment.intelligenceAbility.split("\n")) {
        caseProblemsText.push(para(`    ${line.trim()}`));
      }
    }
    if (assessment.psychologicalAssessment) {
      caseProblemsText.push(para("二、心理能力："));
      for (const line of assessment.psychologicalAssessment.split("\n")) {
        caseProblemsText.push(para(`  ${line.trim()}`));
      }
    }
    if (assessment.familyVisitPattern) {
      caseProblemsText.push(para(`三、家屬方面：${assessment.familyVisitPattern}`));
    }
    if (assessment.socialBehavior) {
      caseProblemsText.push(para("四、社會行為方面："));
      for (const line of assessment.socialBehavior.split("\n")) {
        caseProblemsText.push(para(`  ${line.trim()}`));
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: [
          // Title
          para(facilityResult.name, {
            alignment: AlignmentType.CENTER,
            bold: true,
            size: 40,
          }),

          // Header table
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para("")], { width: 2000 }),
                  cell(
                    [
                      para(`${rocYear}年個案服務計畫記錄表`, {
                        alignment: AlignmentType.CENTER,
                        bold: true,
                        size: 40,
                      }),
                    ],
                    { width: 5500 }
                  ),
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
              new TableRow({
                children: [
                  cell([para(`案號：${clientResult.caseNumber}`)], { width: 2000 }),
                  cell([para("")], { width: 5500 }),
                  cell([para("")], { width: 2500 }),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    [
                      para(
                        `開案日期：${formatRocDate(new Date(clientResult.caseOpenDate))}`
                      ),
                    ],
                    { width: 4000 }
                  ),
                  cell([para("")], { width: 6000 }),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 1: Basic info
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell(
                    [para("一、個案基本（背景）資料：")],
                    { columnSpan: 6 }
                  ),
                ],
              }),
              new TableRow({
                children: [
                  cell([para("姓名")], { width: 1000 }),
                  cell([para(clientResult.name)], { width: 2200 }),
                  cell([para("性別")], { width: 1000 }),
                  cell(
                    [
                      para([
                        ...checkbox(clientResult.gender === "male", "男"),
                        textRun("\n"),
                        ...checkbox(clientResult.gender === "female", "女"),
                      ]),
                    ],
                    { width: 1000 }
                  ),
                  cell([para("出生\n年月日")], { width: 1000 }),
                  cell(
                    [
                      para(
                        `民國${formatRocDate(dob).replace("年", "年")}，${age}實足歲`
                      ),
                    ],
                    { width: 3800 }
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 2: Case problems
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para("二、個案問題： ")], { columnSpan: 1 }),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    caseProblemsText.length > 0
                      ? caseProblemsText
                      : [para("（尚未填寫）")]
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 3: Family status
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para("三、家庭狀況描述：")], { columnSpan: 2 }),
                ],
              }),
              new TableRow({
                children: [
                  cell([para("家庭成員\n現況")], { width: 1600 }),
                  cell([para(familyCheckboxRuns)], { width: 8400 }),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 4: Assessment analysis
          new Table({
            rows: [
              new TableRow({
                children: [cell([para("四、評估分析：")])],
              }),
              new TableRow({
                children: [
                  cell(
                    assessment?.assessmentAnalysis
                      ? assessment.assessmentAnalysis
                          .split("\n")
                          .map((line) => para(line.trim()))
                      : [para("（尚未填寫）")]
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 5: Treatment plan
          new Table({
            rows: [
              new TableRow({
                children: [cell([para("五、處遇計畫： ")])],
              }),
              new TableRow({
                children: [
                  cell(
                    treatmentPlanParagraphs.length > 0
                      ? treatmentPlanParagraphs
                      : [para("（尚未填寫）")]
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 6: Quarterly tracking
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para("六、輔導追蹤記錄：")], { columnSpan: 2 }),
                ],
              }),
              // Q1 & Q2 dates
              new TableRow({
                children: [
                  cell(
                    [para(`追蹤日期：${formatTrackingDate(q1)}`)],
                    { width: 5000 }
                  ),
                  cell(
                    [para(`追蹤日期：${formatTrackingDate(q2)}`)],
                    { width: 5000 }
                  ),
                ],
              }),
              // Q1 & Q2 content
              new TableRow({
                children: [
                  cell(
                    q1?.narrative
                      ? q1.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                  cell(
                    q2?.narrative
                      ? q2.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                ],
              }),
              // Q3 & Q4 dates
              new TableRow({
                children: [
                  cell(
                    [para(`追蹤日期：${formatTrackingDate(q3)}`)],
                    { width: 5000 }
                  ),
                  cell(
                    [para(`追蹤日期：${formatTrackingDate(q4)}`)],
                    { width: 5000 }
                  ),
                ],
              }),
              // Q3 & Q4 content
              new TableRow({
                children: [
                  cell(
                    q3?.narrative
                      ? q3.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                  cell(
                    q4?.narrative
                      ? q4.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Section 7: Family discussion
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para("七、家屬意見討論：")], { columnSpan: 2 }),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    [para(`討論日期：${formatDiscDate(fd1)}`)],
                    { width: 5000 }
                  ),
                  cell(
                    [para(`討論日期：${formatDiscDate(fd2)}`)],
                    { width: 5000 }
                  ),
                ],
              }),
              new TableRow({
                children: [
                  cell(
                    fd1?.narrative
                      ? fd1.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                  cell(
                    fd2?.narrative
                      ? fd2.narrative.split("\n").map((l) => para(l.trim()))
                      : [para("")],
                    { width: 5000 }
                  ),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),

          // Footer
          new Table({
            rows: [
              new TableRow({
                children: [
                  cell([para(`社工員： ${workerName} `)], { width: 5000 }),
                  cell([para("")], { width: 2000 }),
                  cell([para("中心主任：             ")], { width: 3000 }),
                ],
              }),
            ],
            width: { size: 10000, type: WidthType.DXA },
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

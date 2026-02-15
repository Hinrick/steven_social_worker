import { Router } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  facilities,
  users,
  clients,
  monthlyRecords,
  clientAssessments,
  clientFamilyMembers,
  quarterlyFollowups,
  familyDiscussions,
} from "../db/schema.js";
import { generateMonthlyNarrative, generateQuarterlyNarrative, generateFamilyDiscussionNarrative, generateAssessmentAnalysis, generateTreatmentPlan } from "../ai/generate.js";
import { generateA05Document } from "../documents/a05-generator.js";
import { generateA04Document } from "../documents/a04-generator.js";
import { formatRocDate, calculateAge, toAdYear } from "../utils/roc-year.js";
import { VISIT_TYPE_LABELS } from "../utils/constants.js";

export const router = Router();

// ============================================================
// CLIENTS
// ============================================================

// List / search clients
router.get("/clients", async (req, res) => {
  const { q, facility_id } = req.query;
  const facilityId = facility_id as string;

  if (!facilityId) {
    // Get first facility as default
    const [f] = await db.select().from(facilities).limit(1);
    if (!f) return res.json([]);
    const result = await db.select().from(clients).where(eq(clients.facilityId, f.id));
    return res.json(result);
  }

  if (q) {
    const result = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.facilityId, facilityId),
          eq(clients.isActive, true),
          or(
            ilike(clients.name, `%${q}%`),
            ilike(clients.caseNumber, `%${q}%`)
          )
        )
      );
    return res.json(result);
  }

  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.facilityId, facilityId), eq(clients.isActive, true)));
  res.json(result);
});

// Get single client
router.get("/clients/:id", async (req, res) => {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, req.params.id))
    .limit(1);

  if (!client) return res.status(404).json({ error: "Client not found" });

  const dob = new Date(client.dateOfBirth);
  res.json({
    ...client,
    age: calculateAge(dob),
    dobFormatted: formatRocDate(dob),
    caseOpenDateFormatted: formatRocDate(new Date(client.caseOpenDate)),
  });
});

// Create client
router.post("/clients", async (req, res) => {
  const { facility_id, case_number, name, gender, date_of_birth, case_open_date } = req.body;

  // Accept ROC dates (YYY/MM/DD) or ISO dates
  const parseDate = (s: string) => {
    if (s.includes("/")) {
      const parts = s.split("/");
      const year = toAdYear(parseInt(parts[0]));
      return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(s);
  };

  // Get default facility if not provided
  let facilityId = facility_id;
  if (!facilityId) {
    const [f] = await db.select().from(facilities).limit(1);
    if (f) facilityId = f.id;
  }

  const dob = parseDate(date_of_birth);
  const openDate = parseDate(case_open_date);

  const [result] = await db
    .insert(clients)
    .values({
      facilityId,
      caseNumber: case_number,
      name,
      gender: gender === "男" ? "male" : gender === "female" ? "female" : gender,
      dateOfBirth: dob.toISOString().split("T")[0],
      caseOpenDate: openDate.toISOString().split("T")[0],
      creationDate: new Date().toISOString().split("T")[0],
    })
    .returning();

  res.status(201).json(result);
});

// ============================================================
// MONTHLY RECORDS (A05)
// ============================================================

// List monthly records for a client/year
router.get("/clients/:clientId/monthly/:year", async (req, res) => {
  const records = await db
    .select()
    .from(monthlyRecords)
    .where(
      and(
        eq(monthlyRecords.clientId, req.params.clientId),
        eq(monthlyRecords.rocYear, parseInt(req.params.year))
      )
    )
    .orderBy(monthlyRecords.month);
  res.json(records);
});

// Create/update a monthly record with AI narrative generation
router.post("/clients/:clientId/monthly/:year/:month", async (req, res) => {
  const { visit_types, other_description, notes, social_worker_id } = req.body;
  const clientId = req.params.clientId;
  const rocYear = parseInt(req.params.year);
  const month = parseInt(req.params.month);

  // Get client info
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return res.status(404).json({ error: "Client not found" });

  // Get previous month narrative for context
  const prevMonth = month > 1 ? month - 1 : 12;
  const prevYear = month > 1 ? rocYear : rocYear - 1;
  const [prevRecord] = await db
    .select()
    .from(monthlyRecords)
    .where(
      and(
        eq(monthlyRecords.clientId, clientId),
        eq(monthlyRecords.rocYear, prevYear),
        eq(monthlyRecords.month, prevMonth)
      )
    )
    .limit(1);

  // Generate narrative via Claude
  const visitTypeLabels = (visit_types || []).map((vt: string) => VISIT_TYPE_LABELS[vt] || vt);
  const narrative = await generateMonthlyNarrative({
    clientName: client.name,
    caseNumber: client.caseNumber,
    visitTypes: visitTypeLabels,
    workerNotes: notes,
    previousMonthNarrative: prevRecord?.visitContent || undefined,
    userId: social_worker_id || "system",
  });

  // Upsert
  const [result] = await db
    .insert(monthlyRecords)
    .values({
      clientId,
      rocYear,
      month,
      visitTypes: visit_types || [],
      otherDescription: other_description,
      visitContent: narrative,
      aiPromptNotes: notes,
      socialWorkerId: social_worker_id,
      status: "draft",
    })
    .onConflictDoUpdate({
      target: [monthlyRecords.clientId, monthlyRecords.rocYear, monthlyRecords.month],
      set: {
        visitTypes: visit_types || [],
        otherDescription: other_description,
        visitContent: narrative,
        aiPromptNotes: notes,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json({ ...result, narrative });
});

// ============================================================
// QUARTERLY FOLLOWUPS (A04 Section 6)
// ============================================================

router.get("/clients/:clientId/quarterly/:year", async (req, res) => {
  const records = await db
    .select()
    .from(quarterlyFollowups)
    .where(
      and(
        eq(quarterlyFollowups.clientId, req.params.clientId),
        eq(quarterlyFollowups.rocYear, parseInt(req.params.year))
      )
    )
    .orderBy(quarterlyFollowups.quarter);
  res.json(records);
});

router.post("/clients/:clientId/quarterly/:year/:quarter", async (req, res) => {
  const { tracking_date, notes } = req.body;
  const clientId = req.params.clientId;
  const rocYear = parseInt(req.params.year);
  const quarter = parseInt(req.params.quarter);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const narrative = await generateQuarterlyNarrative({
    clientName: client.name,
    caseNumber: client.caseNumber,
    notes,
    rocYear,
    quarter,
    userId: "system",
  });

  const [result] = await db
    .insert(quarterlyFollowups)
    .values({
      clientId,
      rocYear,
      quarter,
      trackingDate: tracking_date,
      narrative,
      aiPromptNotes: notes,
    })
    .onConflictDoUpdate({
      target: [quarterlyFollowups.clientId, quarterlyFollowups.rocYear, quarterlyFollowups.quarter],
      set: { trackingDate: tracking_date, narrative, aiPromptNotes: notes, updatedAt: new Date() },
    })
    .returning();

  res.json({ ...result, narrative });
});

// ============================================================
// FAMILY DISCUSSIONS (A04 Section 7)
// ============================================================

router.get("/clients/:clientId/family/:year", async (req, res) => {
  const records = await db
    .select()
    .from(familyDiscussions)
    .where(
      and(
        eq(familyDiscussions.clientId, req.params.clientId),
        eq(familyDiscussions.rocYear, parseInt(req.params.year))
      )
    )
    .orderBy(familyDiscussions.half);
  res.json(records);
});

router.post("/clients/:clientId/family/:year/:half", async (req, res) => {
  const { discussion_date, notes } = req.body;
  const clientId = req.params.clientId;
  const rocYear = parseInt(req.params.year);
  const half = parseInt(req.params.half);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const narrative = await generateFamilyDiscussionNarrative({
    clientName: client.name,
    caseNumber: client.caseNumber,
    notes,
    rocYear,
    half,
    userId: "system",
  });

  const [result] = await db
    .insert(familyDiscussions)
    .values({
      clientId,
      rocYear,
      half,
      discussionDate: discussion_date,
      narrative,
      aiPromptNotes: notes,
    })
    .onConflictDoUpdate({
      target: [familyDiscussions.clientId, familyDiscussions.rocYear, familyDiscussions.half],
      set: { discussionDate: discussion_date, narrative, aiPromptNotes: notes, updatedAt: new Date() },
    })
    .returning();

  res.json({ ...result, narrative });
});

// ============================================================
// ASSESSMENTS (A04 Sections 2-5)
// ============================================================

router.get("/clients/:clientId/assessment/:year", async (req, res) => {
  const [result] = await db
    .select()
    .from(clientAssessments)
    .where(
      and(
        eq(clientAssessments.clientId, req.params.clientId),
        eq(clientAssessments.rocYear, parseInt(req.params.year))
      )
    )
    .limit(1);
  if (!result) return res.status(404).json({ error: "Assessment not found" });
  res.json(result);
});

router.post("/clients/:clientId/assessment/:year", async (req, res) => {
  const {
    language_ability, self_care_ability, intelligence_ability,
    psychological_assessment, family_visit_pattern, social_behavior,
  } = req.body;
  const clientId = req.params.clientId;
  const rocYear = parseInt(req.params.year);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return res.status(404).json({ error: "Client not found" });

  // Generate AI assessment analysis
  const analysisNarrative = await generateAssessmentAnalysis({
    clientName: client.name,
    caseNumber: client.caseNumber,
    dateOfBirth: formatRocDate(new Date(client.dateOfBirth)),
    gender: client.gender === "male" ? "男" : "女",
    caseOpenDate: formatRocDate(new Date(client.caseOpenDate)),
    languageAbility: language_ability || "",
    selfCareAbility: self_care_ability || "",
    intelligenceAbility: intelligence_ability || "",
    psychologicalAssessment: psychological_assessment || "",
    familyVisitPattern: family_visit_pattern || "",
    socialBehavior: social_behavior || "",
    userId: "system",
  });

  // Generate treatment plan
  const treatmentPlan = await generateTreatmentPlan({
    clientName: client.name,
    caseNumber: client.caseNumber,
    assessmentAnalysis: analysisNarrative,
    userId: "system",
  });

  const [result] = await db
    .insert(clientAssessments)
    .values({
      clientId,
      rocYear,
      languageAbility: language_ability,
      selfCareAbility: self_care_ability,
      intelligenceAbility: intelligence_ability,
      psychologicalAssessment: psychological_assessment,
      familyVisitPattern: family_visit_pattern,
      socialBehavior: social_behavior,
      assessmentAnalysis: analysisNarrative,
      treatmentPlan,
    })
    .onConflictDoNothing()
    .returning();

  res.json(result || { message: "Assessment already exists for this year" });
});

// ============================================================
// DOCUMENT GENERATION
// ============================================================

router.get("/clients/:clientId/generate/a05/:year", async (req, res) => {
  try {
    const buffer = await generateA05Document(req.params.clientId, parseInt(req.params.year));
    const [client] = await db.select().from(clients).where(eq(clients.id, req.params.clientId)).limit(1);
    const fileName = `A05個案動態記錄表-${req.params.year}年${client?.name || ""}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Document generation failed" });
  }
});

router.get("/clients/:clientId/generate/a04/:year", async (req, res) => {
  try {
    const buffer = await generateA04Document(req.params.clientId, parseInt(req.params.year));
    const [client] = await db.select().from(clients).where(eq(clients.id, req.params.clientId)).limit(1);
    const fileName = `A04個案服務計畫記錄表-${req.params.year}年${client?.name || ""}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Document generation failed" });
  }
});

// ============================================================
// STATUS
// ============================================================

router.get("/clients/:clientId/status/:year", async (req, res) => {
  const clientId = req.params.clientId;
  const rocYear = parseInt(req.params.year);

  const [monthly, quarterly, family] = await Promise.all([
    db.select({ month: monthlyRecords.month, status: monthlyRecords.status })
      .from(monthlyRecords)
      .where(and(eq(monthlyRecords.clientId, clientId), eq(monthlyRecords.rocYear, rocYear))),
    db.select({ quarter: quarterlyFollowups.quarter })
      .from(quarterlyFollowups)
      .where(and(eq(quarterlyFollowups.clientId, clientId), eq(quarterlyFollowups.rocYear, rocYear))),
    db.select({ half: familyDiscussions.half })
      .from(familyDiscussions)
      .where(and(eq(familyDiscussions.clientId, clientId), eq(familyDiscussions.rocYear, rocYear))),
  ]);

  res.json({
    monthly: Array.from({ length: 12 }, (_, i) => {
      const record = monthly.find((r) => r.month === i + 1);
      return { month: i + 1, status: record?.status || "empty" };
    }),
    quarterly: [1, 2, 3, 4].map((q) => ({
      quarter: q,
      filled: quarterly.some((r) => r.quarter === q),
    })),
    family: [1, 2].map((h) => ({
      half: h,
      filled: family.some((r) => r.half === h),
    })),
  });
});

// ============================================================
// FACILITIES
// ============================================================

router.get("/facilities", async (_req, res) => {
  const result = await db.select().from(facilities);
  res.json(result);
});

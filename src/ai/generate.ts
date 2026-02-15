import { generateText } from "./claude-client.js";
import {
  MONTHLY_SYSTEM_PROMPT,
  buildMonthlyPrompt,
  type MonthlyNarrativeContext,
} from "./prompts/monthly-narrative.js";
import {
  QUARTERLY_SYSTEM_PROMPT,
  buildQuarterlyPrompt,
} from "./prompts/quarterly-tracking.js";
import {
  FAMILY_DISCUSSION_SYSTEM_PROMPT,
  buildFamilyDiscussionPrompt,
} from "./prompts/family-discussion.js";
import {
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentAnalysisPrompt,
  type AssessmentAnalysisContext,
} from "./prompts/assessment-analysis.js";
import {
  TREATMENT_PLAN_SYSTEM_PROMPT,
  buildTreatmentPlanPrompt,
  type TreatmentPlanContext,
} from "./prompts/treatment-plan.js";
import { db } from "../db/connection.js";
import { aiGenerationLog } from "../db/schema.js";
import { logger } from "../utils/logger.js";

async function logGeneration(
  targetTable: string,
  targetId: string,
  prompt: string,
  response: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  triggeredBy: string
) {
  await db.insert(aiGenerationLog).values({
    targetTable,
    targetId,
    promptText: prompt,
    responseText: response,
    modelUsed: model,
    inputTokens,
    outputTokens,
    latencyMs,
    triggeredBy,
  });
}

export async function generateMonthlyNarrative(
  context: MonthlyNarrativeContext & { userId: string; recordId?: string }
): Promise<string> {
  const prompt = buildMonthlyPrompt(context);
  const start = Date.now();

  const result = await generateText(prompt, MONTHLY_SYSTEM_PROMPT);
  const latency = Date.now() - start;

  logger.info(
    {
      tokens: { input: result.inputTokens, output: result.outputTokens },
      latencyMs: latency,
    },
    "Monthly narrative generated"
  );

  if (context.recordId) {
    await logGeneration(
      "monthly_records",
      context.recordId,
      prompt,
      result.text,
      "claude-sonnet-4-20250514",
      result.inputTokens,
      result.outputTokens,
      latency,
      context.userId
    );
  }

  return result.text;
}

export async function generateQuarterlyNarrative(params: {
  clientName: string;
  caseNumber: string;
  notes: string;
  rocYear: number;
  quarter: number;
  userId: string;
  assessmentSummary?: string;
  previousQuarterNarrative?: string;
}): Promise<string> {
  const prompt = buildQuarterlyPrompt({
    clientName: params.clientName,
    caseNumber: params.caseNumber,
    notes: params.notes,
    rocYear: params.rocYear,
    quarter: params.quarter,
    assessmentSummary: params.assessmentSummary,
    previousQuarterNarrative: params.previousQuarterNarrative,
  });

  const start = Date.now();
  const result = await generateText(prompt, QUARTERLY_SYSTEM_PROMPT);
  const latency = Date.now() - start;

  logger.info(
    {
      tokens: { input: result.inputTokens, output: result.outputTokens },
      latencyMs: latency,
    },
    "Quarterly narrative generated"
  );

  return result.text;
}

export async function generateFamilyDiscussionNarrative(params: {
  clientName: string;
  caseNumber: string;
  notes: string;
  rocYear: number;
  half: number;
  userId: string;
  previousNarrative?: string;
}): Promise<string> {
  const prompt = buildFamilyDiscussionPrompt({
    clientName: params.clientName,
    caseNumber: params.caseNumber,
    notes: params.notes,
    rocYear: params.rocYear,
    half: params.half,
    previousNarrative: params.previousNarrative,
  });

  const start = Date.now();
  const result = await generateText(prompt, FAMILY_DISCUSSION_SYSTEM_PROMPT);
  const latency = Date.now() - start;

  logger.info(
    {
      tokens: { input: result.inputTokens, output: result.outputTokens },
      latencyMs: latency,
    },
    "Family discussion narrative generated"
  );

  return result.text;
}

export async function generateAssessmentAnalysis(
  context: AssessmentAnalysisContext & { userId: string }
): Promise<string> {
  const prompt = buildAssessmentAnalysisPrompt(context);
  const start = Date.now();
  const result = await generateText(prompt, ASSESSMENT_SYSTEM_PROMPT);
  const latency = Date.now() - start;

  logger.info(
    {
      tokens: { input: result.inputTokens, output: result.outputTokens },
      latencyMs: latency,
    },
    "Assessment analysis generated"
  );

  return result.text;
}

export async function generateTreatmentPlan(
  context: TreatmentPlanContext & { userId: string }
): Promise<{ sections: { title: string; items: string[] }[] }> {
  const prompt = buildTreatmentPlanPrompt(context);
  const start = Date.now();
  const result = await generateText(prompt, TREATMENT_PLAN_SYSTEM_PROMPT);
  const latency = Date.now() - start;

  logger.info(
    {
      tokens: { input: result.inputTokens, output: result.outputTokens },
      latencyMs: latency,
    },
    "Treatment plan generated"
  );

  return JSON.parse(result.text);
}

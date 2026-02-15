export interface QuarterlyTrackingContext {
  clientName: string;
  caseNumber: string;
  assessmentSummary?: string;
  notes: string;
  rocYear: number;
  quarter: number;
  previousQuarterNarrative?: string;
}

export const QUARTERLY_SYSTEM_PROMPT = `你是一位台灣長照機構的資深社工，專門撰寫個案服務計畫記錄表中的輔導追蹤記錄。
你的文字風格應該：
- 使用正式社工專業用語
- 使用繁體中文
- 以季度為單位總結案主狀況
- 涵蓋身心功能、生活適應、情緒穩定度、團隊合作等面向`;

export function buildQuarterlyPrompt(
  context: QuarterlyTrackingContext
): string {
  return `請根據以下資訊，撰寫個案服務計畫記錄表中的季度輔導追蹤記錄。

## 個案資料
- 姓名：${context.clientName}
- 案號：${context.caseNumber}
${context.assessmentSummary ? `- 主要狀況：${context.assessmentSummary}` : ""}

## 追蹤期間
${context.rocYear}年第${context.quarter}季

## 社工提供的本季重點筆記
${context.notes}

${context.previousQuarterNarrative ? `## 前季記錄（供參考語氣與用詞，請勿重複）\n${context.previousQuarterNarrative}` : ""}

## 要求
1. 撰寫3段的追蹤記錄
2. 第一段描述整體生活狀況與適應情形
3. 第二段描述生活自理與照護配合
4. 第三段總結本季成效與後續計畫
5. 全文使用繁體中文
6. 不要加標題或編號，直接輸出段落文字`;
}

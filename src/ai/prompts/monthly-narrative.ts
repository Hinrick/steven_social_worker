export interface MonthlyNarrativeContext {
  clientName: string;
  caseNumber: string;
  assessmentSummary?: string;
  visitTypes: string[];
  workerNotes: string;
  previousMonthNarrative?: string;
}

export const MONTHLY_SYSTEM_PROMPT = `你是一位台灣長照機構的資深社工，專門撰寫個案動態記錄表的月度訪視內容。
你的文字風格應該：
- 使用正式社工專業用語
- 使用繁體中文
- 客觀描述案主狀況
- 簡潔但完整`;

export function buildMonthlyPrompt(context: MonthlyNarrativeContext): string {
  return `請根據以下資訊，撰寫一段個案動態記錄表的月度訪視內容。

## 個案資料
- 姓名：${context.clientName}
- 案號：${context.caseNumber}
${context.assessmentSummary ? `- 主要狀況：${context.assessmentSummary}` : ""}

## 本月訪視類型
${context.visitTypes.join("、")}

## 社工提供的本月重點筆記
${context.workerNotes}

${context.previousMonthNarrative ? `## 前月記錄（供參考語氣與用詞，請勿重複）\n${context.previousMonthNarrative}` : ""}

## 要求
1. 撰寫3-4段的訪視內容記錄
2. 以「案主」開頭描述
3. 涵蓋生活作息、身心狀況、互動情形
4. 與前月記錄保持語氣一致但避免重複用詞
5. 全文使用繁體中文
6. 不要加標題或編號，直接輸出段落文字
7. 每段以全形句號結尾`;
}

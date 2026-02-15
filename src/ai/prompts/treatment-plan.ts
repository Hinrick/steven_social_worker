export interface TreatmentPlanContext {
  clientName: string;
  caseNumber: string;
  assessmentAnalysis: string;
}

export const TREATMENT_PLAN_SYSTEM_PROMPT = `你是一位台灣長照機構的資深社工，專門撰寫個案服務計畫記錄表中的處遇計畫。
你的文字風格應該：
- 使用正式社工專業用語
- 使用繁體中文
- 結構化呈現，分為五大面向
- 每個面向包含具體可執行的策略`;

export function buildTreatmentPlanPrompt(
  context: TreatmentPlanContext
): string {
  return `請根據以下評估分析，撰寫個案的處遇計畫。

## 個案資料
- 姓名：${context.clientName}
- 案號：${context.caseNumber}

## 評估分析
${context.assessmentAnalysis}

## 要求
請撰寫處遇計畫，分為以下五個面向，每個面向3項具體策略：

（一）身心功能支持
（二）心理情緒支持
（三）生活適應輔導
（四）家庭支持與溝通
（五）安全與風險管理

## 輸出格式
請以 JSON 格式輸出：
{
  "sections": [
    {
      "title": "（一）身心功能支持",
      "items": ["策略1", "策略2", "策略3"]
    },
    ...
  ]
}

只輸出 JSON，不要其他文字。`;
}

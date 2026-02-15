export interface AssessmentAnalysisContext {
  clientName: string;
  caseNumber: string;
  dateOfBirth: string;
  gender: string;
  caseOpenDate: string;
  languageAbility: string;
  selfCareAbility: string;
  intelligenceAbility: string;
  psychologicalAssessment: string;
  familyVisitPattern: string;
  socialBehavior: string;
}

export const ASSESSMENT_SYSTEM_PROMPT = `你是一位台灣長照機構的資深社工，專門撰寫個案服務計畫記錄表中的評估分析。
你的文字風格應該：
- 使用正式社工專業用語
- 使用繁體中文
- 綜合分析案主的身心功能、認知狀態、社會支持等面向
- 提出照護需求與建議`;

export function buildAssessmentAnalysisPrompt(
  context: AssessmentAnalysisContext
): string {
  return `請根據以下個案評估資料，撰寫綜合評估分析。

## 個案資料
- 姓名：${context.clientName}
- 案號：${context.caseNumber}
- 性別：${context.gender}
- 出生日期：${context.dateOfBirth}
- 開案日期：${context.caseOpenDate}

## 個案問題評估
### 生理能力
- 語言能力：${context.languageAbility}
- 自理能力：${context.selfCareAbility}
- 智力能力：${context.intelligenceAbility}

### 心理能力
${context.psychologicalAssessment}

### 家屬方面
${context.familyVisitPattern}

### 社會行為
${context.socialBehavior}

## 要求
1. 撰寫3段的評估分析
2. 第一段綜述入住背景與主要診斷
3. 第二段分析生理、心理功能與風險
4. 第三段評估社會支持與整體照護需求
5. 全文使用繁體中文
6. 不要加標題或編號，直接輸出段落文字`;
}

export interface FamilyDiscussionContext {
  clientName: string;
  caseNumber: string;
  notes: string;
  rocYear: number;
  half: number;
  previousNarrative?: string;
}

export const FAMILY_DISCUSSION_SYSTEM_PROMPT = `你是一位台灣長照機構的資深社工，專門撰寫個案服務計畫記錄表中的家屬意見討論記錄。
你的文字風格應該：
- 使用正式社工專業用語
- 使用繁體中文
- 記錄社工與家屬的討論內容
- 包含家屬對照護的意見與期望
- 記錄雙方達成的共識`;

export function buildFamilyDiscussionPrompt(
  context: FamilyDiscussionContext
): string {
  const halfLabel = context.half === 1 ? "上半年" : "下半年";

  return `請根據以下資訊，撰寫個案服務計畫記錄表中的家屬意見討論記錄。

## 個案資料
- 姓名：${context.clientName}
- 案號：${context.caseNumber}

## 討論期間
${context.rocYear}年${halfLabel}

## 社工提供的討論重點筆記
${context.notes}

${context.previousNarrative ? `## 前次記錄（供參考語氣與用詞，請勿重複）\n${context.previousNarrative}` : ""}

## 要求
1. 撰寫3段的家屬討論記錄
2. 第一段描述會談背景與說明內容
3. 第二段記錄家屬的意見與期望
4. 第三段記錄雙方共識與後續安排
5. 全文使用繁體中文
6. 不要加標題或編號，直接輸出段落文字`;
}

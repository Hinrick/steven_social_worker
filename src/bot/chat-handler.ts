import type { Message } from "discord.js";
import { ChannelType } from "discord.js";
import { generateText } from "../ai/claude-client.js";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPT = `你是「蛋蛋小助理」，一個友善且專業的 AI 助理，服務於長照機構的社工人員。

你的特點：
- 使用繁體中文回覆
- 語氣親切、專業
- 可以回答關於長照、社工、個案管理等相關問題
- 可以幫忙撰寫或修改社工記錄的文字
- 也可以聊天、回答一般問題

如果使用者問到關於個案管理的操作，提醒他們可以使用以下斜線指令：
- /client-manage add — 新增個案
- /client <名字> — 搜尋並選擇個案
- /monthly — 填寫月度動態記錄
- /quarterly — 填寫季度追蹤記錄
- /family — 填寫家屬討論記錄
- /generate — 產生 Word 文件
- /status — 查看填寫進度`;

// Keep conversation history per user (last 20 messages)
const conversationHistory = new Map<
  string,
  { role: "user" | "assistant"; content: string }[]
>();

const MAX_HISTORY = 20;

export async function handleChatMessage(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned =
    message.mentions.has(message.client.user!) && !message.mentions.everyone;

  // Only respond to DMs or @mentions
  if (!isDM && !isMentioned) return;

  // Strip the bot mention from the message content
  let content = message.content;
  if (isMentioned && message.client.user) {
    content = content.replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "").trim();
  }

  if (!content) {
    await message.reply("你好！我是蛋蛋小助理 🥚 有什麼可以幫你的嗎？");
    return;
  }

  // Show typing indicator
  const channel = message.channel;
  if (channel.isTextBased() && !channel.isVoiceBased() && "send" in channel) {
    await (channel as any).sendTyping();
  }

  try {
    // Get/create conversation history
    const userId = message.author.id;
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }
    const history = conversationHistory.get(userId)!;

    // Add user message
    history.push({ role: "user", content });

    // Trim history if too long
    while (history.length > MAX_HISTORY) {
      history.shift();
    }

    // Call Claude with conversation history
    const result = await generateText(
      history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n") +
        "\n\nAssistant:",
      SYSTEM_PROMPT
    );

    const reply = result.text.trim();

    // Add assistant response to history
    history.push({ role: "assistant", content: reply });

    // Discord has 2000 char limit, split if needed
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = splitMessage(reply, 2000);
      for (const chunk of chunks) {
        await (message.channel as any).send(chunk);
      }
    }

    logger.info(
      {
        userId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
      "Chat response sent"
    );
  } catch (error) {
    logger.error(error, "Chat handler error");
    await message.reply("抱歉，我暫時無法回應，請稍後再試。");
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }
    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }
  return chunks;
}

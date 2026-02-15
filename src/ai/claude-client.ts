import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  model: string = DEFAULT_MODEL
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt || "",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

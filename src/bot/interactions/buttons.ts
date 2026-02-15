import type { ButtonInteraction } from "discord.js";
import { logger } from "../../utils/logger.js";

export async function handleButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("approve_")) {
    await interaction.update({
      content: "✅ 已確認儲存。",
      embeds: interaction.message.embeds,
      components: [],
    });
  } else if (customId.startsWith("regenerate_")) {
    await interaction.update({
      content: "🔄 重新生成功能開發中...",
      components: [],
    });
    logger.info({ customId }, "Regenerate requested");
  }
}

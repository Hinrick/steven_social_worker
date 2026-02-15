import {
  SlashCommandBuilder,
  AttachmentBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { authenticateUser } from "../middleware/auth.js";
import { getSelectedClient } from "../session.js";
import { currentRocYear } from "../../utils/roc-year.js";
import { generateA05Document } from "../../documents/a05-generator.js";
import { generateA04Document } from "../../documents/a04-generator.js";
import { logger } from "../../utils/logger.js";
import type { BotCommand } from "../client.js";

export const generate: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("generate")
    .setDescription("產生 Word 文件")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("文件類型")
        .setRequired(true)
        .addChoices(
          { name: "A05 個案動態記錄表 (月度)", value: "a05" },
          { name: "A04 個案服務計畫記錄表 (季度)", value: "a04" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("year")
        .setDescription("民國年 (例：115)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await authenticateUser(interaction);
    if (!user) return;

    const session = getSelectedClient(interaction.user.id);
    if (!session) {
      await interaction.reply({
        content: "請先使用 `/client` 選擇一位個案。",
        ephemeral: true,
      });
      return;
    }

    const docType = interaction.options.get("type", true).value as string;
    const rocYear =
      (interaction.options.get("year")?.value as number) || currentRocYear();

    await interaction.deferReply({ ephemeral: true });

    try {
      let buffer: Buffer;
      let fileName: string;

      if (docType === "a05") {
        buffer = await generateA05Document(session.clientId, rocYear);
        fileName = `A05個案動態記錄表-${rocYear}年${session.clientName}.docx`;
      } else {
        buffer = await generateA04Document(session.clientId, rocYear);
        fileName = `A04個案服務計畫記錄表-${rocYear}年${session.clientName}.docx`;
      }

      const attachment = new AttachmentBuilder(buffer, { name: fileName });

      await interaction.editReply({
        content: `✅ 已產生 **${fileName}**`,
        files: [attachment],
      });

      logger.info(
        { docType, rocYear, clientId: session.clientId, userId: user.id },
        "Document generated"
      );
    } catch (error) {
      logger.error(error, "Document generation failed");
      await interaction.editReply({
        content: "文件產生失敗，請稍後再試或聯繫管理員。",
      });
    }
  },
};

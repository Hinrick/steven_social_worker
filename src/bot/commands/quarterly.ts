import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { authenticateUser } from "../middleware/auth.js";
import { getSelectedClient } from "../session.js";
import { currentRocYear } from "../../utils/roc-year.js";
import type { BotCommand } from "../client.js";

export const quarterly: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("quarterly")
    .setDescription("填寫個案季度追蹤記錄 (A04 Section 6)")
    .addIntegerOption((option) =>
      option
        .setName("year")
        .setDescription("民國年 (例：115)")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("quarter")
        .setDescription("季度 (1-4)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(4)
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

    const rocYear =
      (interaction.options.get("year")?.value as number) || currentRocYear();
    const quarter =
      (interaction.options.get("quarter")?.value as number) ||
      Math.ceil((new Date().getMonth() + 1) / 3);

    const modal = new ModalBuilder()
      .setCustomId(
        `quarterly_notes:${session.clientId}:${rocYear}:${quarter}`
      )
      .setTitle(
        `${session.clientName} - ${rocYear}年Q${quarter}追蹤`
      );

    const dateInput = new TextInputBuilder()
      .setCustomId("tracking_date")
      .setLabel("追蹤日期 (民國年/月/日)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：115/01/12");

    const notesInput = new TextInputBuilder()
      .setCustomId("notes")
      .setLabel("本季重點筆記（AI將據此生成正式記錄）")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder(
        "請輸入本季觀察重點，例：\n- 情緒穩定，偶有焦慮\n- 認知退化，溝通困難\n- 家屬每月探望一次"
      );

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput)
    );

    await interaction.showModal(modal);
  },
};

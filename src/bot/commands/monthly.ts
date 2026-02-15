import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { authenticateUser } from "../middleware/auth.js";
import { getSelectedClient } from "../session.js";
import { currentRocYear } from "../../utils/roc-year.js";
import { VISIT_TYPE_LABELS } from "../../utils/constants.js";
import type { BotCommand } from "../client.js";

export const monthly: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("monthly")
    .setDescription("填寫個案月度動態記錄 (A05)")
    .addIntegerOption((option) =>
      option
        .setName("year")
        .setDescription("民國年 (例：115)")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("month")
        .setDescription("月份 (1-12)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(12)
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
    const month =
      (interaction.options.get("month")?.value as number) ||
      new Date().getMonth() + 1;

    // Step 1: Show visit type selection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`monthly_visit_types:${session.clientId}:${rocYear}:${month}`)
      .setPlaceholder("選擇訪視類型（可多選）")
      .setMinValues(1)
      .setMaxValues(Object.keys(VISIT_TYPE_LABELS).length)
      .addOptions(
        Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => ({
          label,
          value,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.reply({
      content: `📋 **${session.caseNumber} - ${session.clientName}** | ${rocYear}年${month}月\n請選擇本月訪視類型：`,
      components: [row],
      ephemeral: true,
    });
  },
};

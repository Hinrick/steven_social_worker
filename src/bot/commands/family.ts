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

export const family: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("family")
    .setDescription("填寫家屬意見討論記錄 (A04 Section 7)")
    .addIntegerOption((option) =>
      option
        .setName("year")
        .setDescription("民國年 (例：115)")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("half")
        .setDescription("上半年(1) 或 下半年(2)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(2)
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
    const half =
      (interaction.options.get("half")?.value as number) ||
      (new Date().getMonth() < 6 ? 1 : 2);

    const halfLabel = half === 1 ? "上半年" : "下半年";

    const modal = new ModalBuilder()
      .setCustomId(
        `family_notes:${session.clientId}:${rocYear}:${half}`
      )
      .setTitle(
        `${session.clientName} - ${rocYear}年${halfLabel}家屬討論`
      );

    const dateInput = new TextInputBuilder()
      .setCustomId("discussion_date")
      .setLabel("討論日期 (民國年/月/日)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：115/01/22");

    const notesInput = new TextInputBuilder()
      .setCustomId("notes")
      .setLabel("家屬討論重點筆記（AI將據此生成正式記錄）")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder(
        "請輸入討論重點，例：\n- 家屬肯定照護品質\n- 討論胃造口保留問題\n- 家屬希望持續關懷陪伴"
      );

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput)
    );

    await interaction.showModal(modal);
  },
};

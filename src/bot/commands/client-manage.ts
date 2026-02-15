import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { authenticateUser } from "../middleware/auth.js";
import type { BotCommand } from "../client.js";

export const clientManage: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("client-manage")
    .setDescription("管理個案資料")
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("新增個案")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await authenticateUser(interaction);
    if (!user) return;

    if (user.role !== "admin" && user.role !== "social_worker") {
      await interaction.reply({
        content: "您沒有權限執行此操作。",
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("client_add_modal")
      .setTitle("新增個案");

    const nameInput = new TextInputBuilder()
      .setCustomId("client_name")
      .setLabel("姓名")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：林春明");

    const caseNumberInput = new TextInputBuilder()
      .setCustomId("case_number")
      .setLabel("案號")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：A1");

    const dobInput = new TextInputBuilder()
      .setCustomId("date_of_birth")
      .setLabel("出生日期 (民國年/月/日)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：44/09/10");

    const genderInput = new TextInputBuilder()
      .setCustomId("gender")
      .setLabel("性別 (男/女)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("男 或 女");

    const caseOpenDateInput = new TextInputBuilder()
      .setCustomId("case_open_date")
      .setLabel("開案日期 (民國年/月/日)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("例：113/08/06");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(caseNumberInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(dobInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(genderInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(caseOpenDateInput)
    );

    await interaction.showModal(modal);
  },
};

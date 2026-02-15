import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { clients } from "../../db/schema.js";
import { setSelectedClient } from "../session.js";
import { logger } from "../../utils/logger.js";

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction
) {
  const customId = interaction.customId;

  if (customId === "client_select") {
    await handleClientSelect(interaction);
  } else if (customId.startsWith("monthly_visit_types:")) {
    await handleMonthlyVisitTypes(interaction);
  }
}

async function handleClientSelect(interaction: StringSelectMenuInteraction) {
  const clientId = interaction.values[0];

  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (result.length === 0) {
    await interaction.reply({
      content: "找不到該個案。",
      ephemeral: true,
    });
    return;
  }

  const client = result[0];
  setSelectedClient(
    interaction.user.id,
    client.id,
    client.name,
    client.caseNumber
  );

  await interaction.update({
    content: `✅ 已選擇個案 **${client.caseNumber} - ${client.name}**`,
    components: [],
  });
}

async function handleMonthlyVisitTypes(
  interaction: StringSelectMenuInteraction
) {
  const parts = interaction.customId.split(":");
  const clientId = parts[1];
  const rocYear = parts[2];
  const month = parts[3];
  const visitTypes = interaction.values;

  // Store visit types in custom ID and show notes modal
  const modal = new ModalBuilder()
    .setCustomId(
      `monthly_notes:${clientId}:${rocYear}:${month}:${visitTypes.join(",")}`
    )
    .setTitle(`${rocYear}年${month}月 訪視記錄`);

  const notesInput = new TextInputBuilder()
    .setCustomId("notes")
    .setLabel("本月重點筆記（AI將據此生成正式記錄）")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder(
      "請輸入本月觀察重點，例：\n- 生活作息穩定\n- 精神狀況尚可\n- 配合日常照護"
    );

  const otherDescInput = new TextInputBuilder()
    .setCustomId("other_description")
    .setLabel("「其他」項目說明（如無則留空）")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("例：感官刺激及下床坐輪椅");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(otherDescInput)
  );

  await interaction.showModal(modal);
}

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { clients } from "../../db/schema.js";
import { authenticateUser } from "../middleware/auth.js";
import { setSelectedClient } from "../session.js";
import { formatRocDate, calculateAge } from "../../utils/roc-year.js";
import type { BotCommand } from "../client.js";

export const clientSearch: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("client")
    .setDescription("搜尋並選擇個案")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("輸入姓名或案號搜尋")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await authenticateUser(interaction);
    if (!user) return;

    const query = interaction.options.get("query", true).value as string;

    const results = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.facilityId, user.facilityId),
          eq(clients.isActive, true),
          or(
            ilike(clients.name, `%${query}%`),
            ilike(clients.caseNumber, `%${query}%`)
          )
        )
      )
      .limit(10);

    if (results.length === 0) {
      await interaction.reply({
        content: `找不到符合「${query}」的個案。`,
        ephemeral: true,
      });
      return;
    }

    if (results.length === 1) {
      const c = results[0];
      setSelectedClient(interaction.user.id, c.id, c.name, c.caseNumber);

      const dob = new Date(c.dateOfBirth);
      const embed = new EmbedBuilder()
        .setTitle(`${c.caseNumber} - ${c.name}`)
        .setColor(0x2b82d9)
        .addFields(
          { name: "案號", value: c.caseNumber, inline: true },
          { name: "性別", value: c.gender === "male" ? "男" : "女", inline: true },
          { name: "出生日期", value: formatRocDate(dob), inline: true },
          { name: "年齡", value: `${calculateAge(dob)}歲`, inline: true },
          { name: "開案日期", value: formatRocDate(new Date(c.caseOpenDate)), inline: true }
        )
        .setFooter({ text: "已選擇此個案，可直接使用其他指令" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Multiple results — show select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("client_select")
      .setPlaceholder("選擇一位個案")
      .addOptions(
        results.map((c) => ({
          label: `${c.caseNumber} - ${c.name}`,
          value: c.id,
          description: `開案日期：${formatRocDate(new Date(c.caseOpenDate))}`,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectMenu
    );

    await interaction.reply({
      content: `找到 ${results.length} 位符合的個案，請選擇：`,
      components: [row],
      ephemeral: true,
    });
  },
};

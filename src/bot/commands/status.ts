import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { monthlyRecords, quarterlyFollowups, familyDiscussions } from "../../db/schema.js";
import { authenticateUser } from "../middleware/auth.js";
import { getSelectedClient } from "../session.js";
import { currentRocYear } from "../../utils/roc-year.js";
import type { BotCommand } from "../client.js";

export const status: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("查看個案填寫進度")
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

    const rocYear =
      (interaction.options.get("year")?.value as number) || currentRocYear();

    // Fetch all records
    const [monthlyData, quarterlyData, familyData] = await Promise.all([
      db
        .select({ month: monthlyRecords.month, status: monthlyRecords.status })
        .from(monthlyRecords)
        .where(
          and(
            eq(monthlyRecords.clientId, session.clientId),
            eq(monthlyRecords.rocYear, rocYear)
          )
        ),
      db
        .select({ quarter: quarterlyFollowups.quarter })
        .from(quarterlyFollowups)
        .where(
          and(
            eq(quarterlyFollowups.clientId, session.clientId),
            eq(quarterlyFollowups.rocYear, rocYear)
          )
        ),
      db
        .select({ half: familyDiscussions.half })
        .from(familyDiscussions)
        .where(
          and(
            eq(familyDiscussions.clientId, session.clientId),
            eq(familyDiscussions.rocYear, rocYear)
          )
        ),
    ]);

    const filledMonths = new Set(monthlyData.map((r) => r.month));
    const filledQuarters = new Set(quarterlyData.map((r) => r.quarter));
    const filledHalves = new Set(familyData.map((r) => r.half));

    // Build status display
    const monthStatus = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const record = monthlyData.find((r) => r.month === m);
      if (!record) return `${String(m).padStart(2, " ")}月 ⬜`;
      return `${String(m).padStart(2, " ")}月 ${record.status === "draft" ? "📝" : "✅"}`;
    }).join("\n");

    const quarterStatus = [1, 2, 3, 4]
      .map((q) => `Q${q} ${filledQuarters.has(q) ? "✅" : "⬜"}`)
      .join("  ");

    const familyStatus = [1, 2]
      .map((h) => `${h === 1 ? "上半年" : "下半年"} ${filledHalves.has(h) ? "✅" : "⬜"}`)
      .join("  ");

    const embed = new EmbedBuilder()
      .setTitle(`${session.caseNumber} - ${session.clientName} | ${rocYear}年進度`)
      .setColor(0x2b82d9)
      .addFields(
        {
          name: "A05 月度動態記錄",
          value: `\`\`\`\n${monthStatus}\n\`\`\``,
        },
        {
          name: "A04 季度追蹤",
          value: quarterStatus,
          inline: true,
        },
        {
          name: "A04 家屬討論",
          value: familyStatus,
          inline: true,
        }
      )
      .setFooter({
        text: `✅ 已完成  📝 草稿  ⬜ 未填寫`,
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

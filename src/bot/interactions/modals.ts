import type { ModalSubmitInteraction } from "discord.js";
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { clients, quarterlyFollowups, familyDiscussions } from "../../db/schema.js";
import { authenticateUser } from "../middleware/auth.js";
import { generateQuarterlyNarrative } from "../../ai/generate.js";
import { generateFamilyDiscussionNarrative } from "../../ai/generate.js";
import { toAdYear } from "../../utils/roc-year.js";
import { logger } from "../../utils/logger.js";

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith("client_add_modal")) {
    await handleClientAddModal(interaction);
  } else if (customId.startsWith("monthly_notes:")) {
    await handleMonthlyNotesModal(interaction);
  } else if (customId.startsWith("quarterly_notes:")) {
    await handleQuarterlyNotesModal(interaction);
  } else if (customId.startsWith("family_notes:")) {
    await handleFamilyNotesModal(interaction);
  }
}

async function handleClientAddModal(interaction: ModalSubmitInteraction) {
  const user = await authenticateUser(interaction as any);
  if (!user) return;

  const name = interaction.fields.getTextInputValue("client_name");
  const caseNumber = interaction.fields.getTextInputValue("case_number");
  const dobStr = interaction.fields.getTextInputValue("date_of_birth");
  const genderStr = interaction.fields.getTextInputValue("gender");
  const caseOpenStr = interaction.fields.getTextInputValue("case_open_date");

  // Parse ROC date (YYY/MM/DD)
  const parseDateStr = (s: string) => {
    const parts = s.split("/");
    if (parts.length !== 3) return null;
    const year = toAdYear(parseInt(parts[0]));
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    return new Date(year, month, day);
  };

  const dob = parseDateStr(dobStr);
  const caseOpenDate = parseDateStr(caseOpenStr);

  if (!dob || !caseOpenDate) {
    await interaction.reply({
      content: "日期格式錯誤，請使用 民國年/月/日 格式（例：44/09/10）",
      ephemeral: true,
    });
    return;
  }

  const gender = genderStr.trim() === "男" ? "male" as const : "female" as const;

  try {
    await db.insert(clients).values({
      facilityId: user.facilityId,
      caseNumber,
      name,
      gender,
      dateOfBirth: dob.toISOString().split("T")[0],
      caseOpenDate: caseOpenDate.toISOString().split("T")[0],
      creationDate: new Date().toISOString().split("T")[0],
      assignedWorkerId: user.id,
    });

    await interaction.reply({
      content: `✅ 已新增個案 **${caseNumber} - ${name}**`,
      ephemeral: true,
    });
  } catch (error: any) {
    if (error.code === "23505") {
      await interaction.reply({
        content: `案號 ${caseNumber} 已存在，請使用其他案號。`,
        ephemeral: true,
      });
    } else {
      throw error;
    }
  }
}

async function handleMonthlyNotesModal(interaction: ModalSubmitInteraction) {
  // Will be handled in the select menu flow (visit types first, then modal)
  // This is a placeholder for the notes input after visit type selection
  await interaction.reply({
    content: "處理中...",
    ephemeral: true,
  });
}

async function handleQuarterlyNotesModal(interaction: ModalSubmitInteraction) {
  const user = await authenticateUser(interaction as any);
  if (!user) return;

  const parts = interaction.customId.split(":");
  const clientId = parts[1];
  const rocYear = parseInt(parts[2]);
  const quarter = parseInt(parts[3]);

  const dateStr = interaction.fields.getTextInputValue("tracking_date");
  const notes = interaction.fields.getTextInputValue("notes");

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get client info for AI context
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      await interaction.editReply({ content: "找不到該個案。" });
      return;
    }

    // Generate narrative via Claude
    const narrative = await generateQuarterlyNarrative({
      clientName: client[0].name,
      caseNumber: client[0].caseNumber,
      notes,
      rocYear,
      quarter,
      userId: user.id,
    });

    // Save to DB
    const parseDateStr = (s: string) => {
      const dateParts = s.split("/");
      if (dateParts.length !== 3) return null;
      const year = toAdYear(parseInt(dateParts[0]));
      return new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    };
    const trackingDate = parseDateStr(dateStr);

    await db
      .insert(quarterlyFollowups)
      .values({
        clientId,
        rocYear,
        quarter,
        trackingDate: trackingDate?.toISOString().split("T")[0],
        narrative,
        aiPromptNotes: notes,
        createdBy: user.id,
      })
      .onConflictDoUpdate({
        target: [
          quarterlyFollowups.clientId,
          quarterlyFollowups.rocYear,
          quarterlyFollowups.quarter,
        ],
        set: {
          trackingDate: trackingDate?.toISOString().split("T")[0],
          narrative,
          aiPromptNotes: notes,
          updatedAt: new Date(),
        },
      });

    // Show preview with approve/regenerate buttons
    const embed = new EmbedBuilder()
      .setTitle(`${client[0].caseNumber} - ${client[0].name} | ${rocYear}年Q${quarter}追蹤`)
      .setDescription(narrative)
      .setColor(0x2b82d9)
      .setFooter({ text: "AI 生成預覽" });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_quarterly:${clientId}:${rocYear}:${quarter}`)
        .setLabel("確認")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`regenerate_quarterly:${clientId}:${rocYear}:${quarter}`)
        .setLabel("重新生成")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });
  } catch (error) {
    logger.error(error, "Quarterly notes processing failed");
    await interaction.editReply({
      content: "處理失敗，請稍後再試。",
    });
  }
}

async function handleFamilyNotesModal(interaction: ModalSubmitInteraction) {
  const user = await authenticateUser(interaction as any);
  if (!user) return;

  const parts = interaction.customId.split(":");
  const clientId = parts[1];
  const rocYear = parseInt(parts[2]);
  const half = parseInt(parts[3]);

  const dateStr = interaction.fields.getTextInputValue("discussion_date");
  const notes = interaction.fields.getTextInputValue("notes");

  await interaction.deferReply({ ephemeral: true });

  try {
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      await interaction.editReply({ content: "找不到該個案。" });
      return;
    }

    const narrative = await generateFamilyDiscussionNarrative({
      clientName: client[0].name,
      caseNumber: client[0].caseNumber,
      notes,
      rocYear,
      half,
      userId: user.id,
    });

    const parseDateStr = (s: string) => {
      const dateParts = s.split("/");
      if (dateParts.length !== 3) return null;
      const year = toAdYear(parseInt(dateParts[0]));
      return new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    };
    const discussionDate = parseDateStr(dateStr);

    await db
      .insert(familyDiscussions)
      .values({
        clientId,
        rocYear,
        half,
        discussionDate: discussionDate?.toISOString().split("T")[0],
        narrative,
        aiPromptNotes: notes,
        createdBy: user.id,
      })
      .onConflictDoUpdate({
        target: [
          familyDiscussions.clientId,
          familyDiscussions.rocYear,
          familyDiscussions.half,
        ],
        set: {
          discussionDate: discussionDate?.toISOString().split("T")[0],
          narrative,
          aiPromptNotes: notes,
          updatedAt: new Date(),
        },
      });

    const halfLabel = half === 1 ? "上半年" : "下半年";
    const embed = new EmbedBuilder()
      .setTitle(
        `${client[0].caseNumber} - ${client[0].name} | ${rocYear}年${halfLabel}家屬討論`
      )
      .setDescription(narrative)
      .setColor(0x2b82d9)
      .setFooter({ text: "AI 生成預覽" });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_family:${clientId}:${rocYear}:${half}`)
        .setLabel("確認")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`regenerate_family:${clientId}:${rocYear}:${half}`)
        .setLabel("重新生成")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });
  } catch (error) {
    logger.error(error, "Family discussion processing failed");
    await interaction.editReply({
      content: "處理失敗，請稍後再試。",
    });
  }
}

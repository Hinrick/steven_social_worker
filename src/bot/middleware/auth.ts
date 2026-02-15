import type { CommandInteraction } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/connection.js";
import { users } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";

export type AuthenticatedUser = {
  id: string;
  discordUserId: string;
  displayName: string;
  role: "social_worker" | "center_director" | "admin";
  facilityId: string;
};

export async function authenticateUser(
  interaction: CommandInteraction
): Promise<AuthenticatedUser | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, interaction.user.id))
    .limit(1);

  if (result.length === 0) {
    logger.info(
      { discordUserId: interaction.user.id, username: interaction.user.username },
      "Unregistered user attempted command"
    );
    await interaction.reply({
      content: `您尚未註冊為系統使用者，請聯繫管理員。\n您的 Discord ID: \`${interaction.user.id}\``,
      ephemeral: true,
    });
    return null;
  }

  const user = result[0];
  if (!user.isActive) {
    await interaction.reply({
      content: "您的帳號已停用，請聯繫管理員。",
      ephemeral: true,
    });
    return null;
  }

  return {
    id: user.id,
    discordUserId: user.discordUserId,
    displayName: user.displayName,
    role: user.role,
    facilityId: user.facilityId,
  };
}

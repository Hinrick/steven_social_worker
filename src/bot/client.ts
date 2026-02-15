import { Client, GatewayIntentBits, Collection, Events, Partials } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { env } from "../env.js";
import { logger } from "../utils/logger.js";

export interface BotCommand {
  data: { name: string; toJSON(): unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, BotCommand>();

export function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info(`Bot logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(error, `Error executing command: ${interaction.commandName}`);
      const reply = {
        content: "執行指令時發生錯誤，請稍後再試。",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  return client;
}

export async function startBot(client: Client) {
  await client.login(env.DISCORD_TOKEN);
}

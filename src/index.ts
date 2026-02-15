import { Events } from "discord.js";
import { createClient, commands, startBot } from "./bot/client.js";
import { allCommands } from "./bot/commands/index.js";
import { handleModalSubmit } from "./bot/interactions/modals.js";
import { handleSelectMenu } from "./bot/interactions/select-menus.js";
import { handleButton } from "./bot/interactions/buttons.js";
import { handleChatMessage } from "./bot/chat-handler.js";
import { closeDb } from "./db/connection.js";
import { logger } from "./utils/logger.js";

// Register all commands
for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}

const client = createClient();

// Handle non-command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  } catch (error) {
    logger.error(error, "Interaction handler error");
  }
});

// Handle direct messages and @mentions
client.on(Events.MessageCreate, async (message) => {
  try {
    await handleChatMessage(message);
  } catch (error) {
    logger.error(error, "Message handler error");
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  client.destroy();
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  client.destroy();
  await closeDb();
  process.exit(0);
});

// Start
startBot(client).catch((error) => {
  logger.error(error, "Failed to start bot");
  process.exit(1);
});

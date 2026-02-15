import { REST, Routes } from "discord.js";
import { env } from "../env.js";
import { allCommands } from "./commands/index.js";
import { logger } from "../utils/logger.js";

const rest = new REST().setToken(env.DISCORD_TOKEN!);

async function deployCommands() {
  try {
    logger.info(`Refreshing ${allCommands.length} application commands...`);

    const commandData = allCommands.map((cmd) => cmd.data.toJSON());

    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID!), {
      body: commandData,
    });

    logger.info("Successfully registered application commands.");
  } catch (error) {
    logger.error(error, "Failed to register commands");
    process.exit(1);
  }
}

deployCommands();

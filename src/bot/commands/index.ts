import type { BotCommand } from "../client.js";
import { clientSearch } from "./client-search.js";
import { clientManage } from "./client-manage.js";
import { monthly } from "./monthly.js";
import { quarterly } from "./quarterly.js";
import { family } from "./family.js";
import { generate } from "./generate.js";
import { status } from "./status.js";

export const allCommands: BotCommand[] = [
  clientSearch,
  clientManage,
  monthly,
  quarterly,
  family,
  generate,
  status,
];

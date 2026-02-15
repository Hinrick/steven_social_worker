import { SESSION_TIMEOUT_MS } from "../utils/constants.js";

interface UserSession {
  clientId: string;
  clientName: string;
  caseNumber: string;
  expiresAt: Date;
}

const sessions = new Map<string, UserSession>();

export function setSelectedClient(
  discordUserId: string,
  clientId: string,
  clientName: string,
  caseNumber: string
) {
  sessions.set(discordUserId, {
    clientId,
    clientName,
    caseNumber,
    expiresAt: new Date(Date.now() + SESSION_TIMEOUT_MS),
  });
}

export function getSelectedClient(
  discordUserId: string
): UserSession | null {
  const session = sessions.get(discordUserId);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    sessions.delete(discordUserId);
    return null;
  }
  // Refresh expiry
  session.expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS);
  return session;
}

export function clearSelectedClient(discordUserId: string) {
  sessions.delete(discordUserId);
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "@multica/utils";

const AUTH_FILE_PATH = join(DATA_DIR, "auth.json");

export type LocalAuthData = { sid: string; deviceId: string };

/**
 * Read sid and deviceId from ~/.super-multica/auth.json.
 * Returns null if the file is missing, unreadable, or incomplete.
 */
export function getLocalAuth(): LocalAuthData | null {
  try {
    const raw = readFileSync(AUTH_FILE_PATH, "utf8").trim();
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (
      typeof data !== "object" ||
      data === null ||
      typeof data.sid !== "string" ||
      !data.sid ||
      typeof data.deviceId !== "string" ||
      !data.deviceId
    ) {
      return null;
    }

    return { sid: data.sid, deviceId: data.deviceId };
  } catch {
    return null;
  }
}

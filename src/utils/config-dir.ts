import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigDir(): string {
  return process.env.GEMINI_CONFIG_DIR || join(homedir(), ".gemini");
}

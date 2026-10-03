import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { SUBAGENT_META_TYPE } from "./subagents";
import { sessionPathKey } from "./session-path";

function parseRecord(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

/** Read every candidate before applying changes; filesystem failures must stop deletion. */
export function reparentSessionChildren(
  filePath: string,
  parentSessionPath: string | undefined,
  parentSessionId: string | undefined,
  io = { readdir: readdirSync, read: readFileSync, write: writePrivateFileAtomicSync },
): void {
  const dir = dirname(filePath);
  const target = sessionPathKey(filePath);
  const changes: { path: string; contents: string }[] = [];
  let files: string[];
  try { files = io.readdir(dir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const file of files) {
    const childPath = join(dir, file);
    if (!file.endsWith(".jsonl") || sessionPathKey(childPath) === target) continue;
    let contents: string;
    try { contents = io.read(childPath, "utf8"); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const lines = contents.split("\n");
    const header = parseRecord(lines[0]);
    if (header?.type !== "session" || typeof header.parentSession !== "string"
      || sessionPathKey(header.parentSession) !== target) continue;
    header.parentSession = parentSessionPath;
    lines[0] = JSON.stringify(header);
    if (parentSessionPath && parentSessionId) {
      for (let index = 1; index < lines.length; index += 1) {
        const entry = parseRecord(lines[index]);
        if (entry?.type !== "custom" || entry.customType !== SUBAGENT_META_TYPE
          || typeof entry.data !== "object" || entry.data === null || Array.isArray(entry.data)) continue;
        entry.data = { ...entry.data, parentSessionId, parentSessionPath };
        lines[index] = JSON.stringify(entry);
        break;
      }
    }
    changes.push({ path: childPath, contents: lines.join("\n") });
  }
  for (const change of changes) io.write(change.path, change.contents);
}

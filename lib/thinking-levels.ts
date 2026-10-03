import type { ThinkingLevel as SdkThinkingLevel } from "@earendil-works/pi-agent-core";

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const satisfies readonly SdkThinkingLevel[];
export type ThinkingLevel = typeof THINKING_LEVELS[number];
export type ThinkingLevelOption = "auto" | ThinkingLevel;

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && THINKING_LEVELS.some((level) => level === value);
}

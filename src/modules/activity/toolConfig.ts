import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { DEFAULT_TOOL_KEYS } from "./tools";

/**
 * เครื่องมือที่บริษัทเปิดใช้ — แยกต่อ "context" (customer, QT, SO ...) เก็บที่ backend (tenant_setting)
 */
const key = (ctx: string) => `tools.${ctx}`;

export function getEnabledTools(ctx: string): string[] {
  return settingsGet<string[]>(key(ctx), [...DEFAULT_TOOL_KEYS]);
}

export function setEnabledTools(ctx: string, keys: string[]): void {
  settingsSet(key(ctx), keys);
}

export function isToolEnabled(ctx: string, toolKey: string): boolean {
  return getEnabledTools(ctx).includes(toolKey);
}

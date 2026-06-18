import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { CORE_KEYS, DEFAULT_KEYS } from "./employeeFields";

/** ฟิลด์พนักงานที่บริษัทเลือกใช้ — เก็บที่ backend (tenant_setting) · core เปิดเสมอ */
const KEY = "hr.fields";

export function getEnabledFields(): string[] {
  const set = new Set<string>(settingsGet<string[]>(KEY, [...DEFAULT_KEYS]));
  CORE_KEYS.forEach((k) => set.add(k));
  return [...set];
}

export function setEnabledFields(keys: string[]): void {
  const set = new Set(keys);
  CORE_KEYS.forEach((k) => set.add(k));
  settingsSet(KEY, [...set]);
}

export function isFieldEnabled(k: string): boolean {
  return getEnabledFields().includes(k);
}

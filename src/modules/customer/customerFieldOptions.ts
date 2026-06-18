import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { CUST_FIELDS } from "./customerFields";

/** ตัวเลือกของฟิลด์แบบ select — เก็บที่ backend (tenant_setting) ต่อฟิลด์ */
const defaults = (fieldKey: string): string[] => CUST_FIELDS.find((f) => f.key === fieldKey)?.opts ?? [];
const key = (fieldKey: string) => `crm.fieldopts.${fieldKey}`;

export function getFieldOptions(fieldKey: string): string[] {
  return settingsGet<string[]>(key(fieldKey), defaults(fieldKey));
}

export function setFieldOptions(fieldKey: string, opts: string[]): void {
  settingsSet(key(fieldKey), opts);
}

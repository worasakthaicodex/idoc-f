import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { fieldsOf } from "./salesFields";

/** ตัวเลือกของฟิลด์แบบ select ในเอกสารงานขาย — เก็บที่ backend (tenant_setting) ต่อเอกสาร/ฟิลด์ */
const defaults = (doc: string, fieldKey: string): string[] => fieldsOf(doc).find((f) => f.key === fieldKey)?.opts ?? [];
const key = (doc: string, fieldKey: string) => `sales.fieldopts.${doc}.${fieldKey}`;

export function getFieldOptions(doc: string, fieldKey: string): string[] {
  return settingsGet<string[]>(key(doc, fieldKey), defaults(doc, fieldKey));
}

export function setFieldOptions(doc: string, fieldKey: string, opts: string[]): void {
  settingsSet(key(doc, fieldKey), opts);
}

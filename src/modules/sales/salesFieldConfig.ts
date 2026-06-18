import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { coreKeysOf, defaultKeysOf, fieldsOf } from "./salesFields";

/** ฟิลด์เอกสารงานขายที่บริษัทเลือกใช้ (ต่อชนิดเอกสาร) — เก็บที่ backend (tenant_setting) · core เปิดเสมอ */
const KEY = (doc: string) => `sales.fields.${doc}`;
const GKEY = (doc: string) => `sales.fieldgrp.${doc}`; // override: ฟิลด์ไหนอยู่กลุ่มไหน (ลากย้ายได้)

export function getEnabledFields(doc: string): string[] {
  const set = new Set<string>(settingsGet<string[]>(KEY(doc), [...defaultKeysOf(doc)]));
  coreKeysOf(doc).forEach((k) => set.add(k));
  return [...set];
}

export function setEnabledFields(doc: string, keys: string[]): void {
  const set = new Set(keys);
  coreKeysOf(doc).forEach((k) => set.add(k));
  settingsSet(KEY(doc), [...set]);
}

/** override กลุ่มของฟิลด์ (key → group) — ที่ลากจัดไว้ */
export function getGroupOverrides(doc: string): Record<string, string> {
  return settingsGet<Record<string, string>>(GKEY(doc), {});
}
export function setGroupOverrides(doc: string, map: Record<string, string>): void {
  settingsSet(GKEY(doc), map);
}

/** กลุ่มของฟิลด์ = override ถ้ามี ไม่งั้นใช้กลุ่มจากแคตตาล็อก */
export function groupOf(doc: string, key: string, ov?: Record<string, string>): string {
  const o = ov ?? getGroupOverrides(doc);
  return o[key] ?? (fieldsOf(doc).find((f) => f.key === key)?.group ?? "general");
}

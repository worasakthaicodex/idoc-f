import { getSession } from "./session";

/**
 * เส้นทางชั่วคราวชุดเดียว (global) เพื่อสลับโมดูลเร็ว:
 *   ทางหลัก = CL ที่เปิดอยู่ · ทางรอง = ใบที่กดข้ามไป (ขอแก้ไข/FO)
 * เปิด CL ใหม่ (ทางหลักเปลี่ยน) → ล้างทางรองเก่าทิ้งทั้งหมด
 */
export type JumpKind = "edit" | "fo";
export type Jump = { path: string; label: string; kind: JumpKind };
export type CrossNav = { mainPath?: string; mainLabel?: string; jumps: Jump[] };

export const CROSSNAV_EVT = "idoc:crossnav";
const MAX = 6;
const tenant = () => getSession()?.companyId ?? "";
const key = () => `idoc.crossnav.${tenant()}`;

export function loadNav(): CrossNav {
  try {
    const raw = localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as CrossNav) : { jumps: [] };
  } catch {
    return { jumps: [] };
  }
}

function save(n: CrossNav): void {
  try { localStorage.setItem(key(), JSON.stringify(n)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CROSSNAV_EVT));
}

/** ตั้งทางหลัก (CL) — ถ้าเป็นคนละ CL กับเดิม ล้างทางรองทั้งหมด */
export function setMain(path: string, label: string): void {
  const n = loadNav();
  if (n.mainPath === path) {
    if (n.mainLabel !== label) save({ ...n, mainLabel: label });
    return;
  }
  save({ mainPath: path, mainLabel: label, jumps: [] });
}

/** จำทางรอง (กดปุ่มขอแก้ไข/เปิด FO) — กันซ้ำด้วย path */
export function recordJump(jump: Jump): void {
  if (!jump.path) return;
  const n = loadNav();
  const jumps = [...n.jumps.filter((j) => j.path !== jump.path), jump].slice(-MAX);
  save({ ...n, jumps });
}

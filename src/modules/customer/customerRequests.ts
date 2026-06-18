import { getSession } from "../../shared/session";
import { pingNotifs } from "../../shared/notifications";

/**
 * ใบคำขอดำเนินการ (CRM) — เก็บจริงต่อบริษัทใน localStorage ไปก่อน → ต่อ backend ภายหลัง
 * phase: รอรับ(คนอื่นส่งมา) → รอดำเนินการ(กดรับแล้ว) → ส่งออก(ส่งให้งานร่วม ยังไม่จบ) → เสร็จสิ้น
 */
export type ReqPhase = "RECEIVE" | "PROCESS" | "EXPORT" | "DONE";
export const REQ_PHASES: ReqPhase[] = ["RECEIVE", "PROCESS", "EXPORT", "DONE"];

export type CustomerRequest = {
  code: string;
  topic: string;        // "ADD" | "EDIT" | "STATUS"
  customer: string;
  requester: string;
  status: string;
  phase: ReqPhase;
  savedAt: number;      // epoch ms (ใช้เรียงวันที่)
  values?: Record<string, string>;
  origValues?: Record<string, string>; // ค่าเดิมตอนเริ่มแก้ (EDIT) — ไว้เทียบว่าแก้อะไรไป
  picked?: { id: string; code: string; name: string; status?: string }; // ลูกค้าที่เลือก (EDIT/STATUS) — ไว้โหลดกลับ
  origin?: { type: string; code: string }; // ที่มาของคำขอ (สืบย้อนได้) เช่น มาจาก CL ใด (type:"CL", code:"CL202606-1")
  received?: { by: string; at: number };                    // มีคนกดรับเรื่องแล้ว (ใคร/เมื่อไร)
  bounce?: { by: string; at: number; reason: string };      // ไม่รับ → ตีกลับหาคนส่ง พร้อมเหตุผล
  stageId?: string;                                          // ขั้นปัจจุบันของเอกสาร (เลื่อนเมื่อกดส่ง)
  // ส่งล่าสุด · recipients = ใครเห็นใน "รอรับ" ([] / undefined = ทุกคน) · ระบุคนเดียว = ส่งเจาะจง · หลายคน = ส่งทั้งกลุ่ม (เหมา) ใครรับก่อนได้งาน
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

/** Log การไหลของเอกสาร (เก็บแยกต่างหากจากตัวใบ) — ส่ง/รับ/ตีกลับ ใคร→ใคร เมื่อไร */
export type FlowAction = "SEND" | "RECEIVE" | "DECLINE" | "APPROVE" | "REJECT" | "COMPLETE";
export type FlowLogEntry = {
  code: string;
  action: FlowAction;
  fromStage?: string;
  toStage?: string;
  by: string;
  to?: string;
  at: number;
  reason?: string;
};
const logKey = () => `idoc.crm.reqlog.${getSession()?.companyId ?? ""}`;

/** อ่าน log (ทั้งหมด หรือเฉพาะของเอกสารหนึ่ง) — ใหม่ → เก่า */
export function loadLog(code?: string): FlowLogEntry[] {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    return (code ? list.filter((e) => e.code === code) : list).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export function appendLog(e: FlowLogEntry): void {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    list.push(e);
    localStorage.setItem(logKey(), JSON.stringify(list.slice(-5000)));
  } catch {
    /* ignore */
  }
}

/** ย้าย log ทั้งหมดจากรหัสเดิม → รหัสใหม่ (ใช้ตอนออกเลขจริงแทน DRAFT จะได้ไม่หลุดประวัติ) */
export function relabelLog(oldCode: string, newCode: string): void {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    let changed = false;
    for (const e of list) if (e.code === oldCode) { e.code = newCode; changed = true; }
    if (changed) localStorage.setItem(logKey(), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** จำกัดเก็บล่าสุด 2000 ใบ — กันแบ่งหน้าเยอะเกิน */
const MAX = 2000;
const key = () => `idoc.crm.requests.${getSession()?.companyId ?? ""}`;

export function loadRequests(): CustomerRequest[] {
  try {
    const raw = localStorage.getItem(key());
    const list = raw ? (JSON.parse(raw) as CustomerRequest[]) : [];
    return list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX); // ล่าสุดก่อน + ตัด 2000
  } catch {
    return [];
  }
}

export function getRequest(code: string): CustomerRequest | null {
  return loadRequests().find((r) => r.code === code) ?? null;
}

/** ใบที่ "รอรับ" (ถูกส่งมา/ตีกลับมา ยังไม่กดรับ) — ใช้ทำ badge + แจ้งเตือน
 *  (รวมใบที่ถูก "ไม่อนุมัติ" แล้วถอยกลับมาที่กล่องรับเข้าของผู้ส่ง — phase=RECEIVE แม้มี bounce) */
export function incomingRequests(): CustomerRequest[] {
  return loadRequests().filter((r) => r.phase === "RECEIVE" && !r.received);
}
export function incomingCount(): number {
  return incomingRequests().length;
}

/** จำแท็บที่เปิดล่าสุดของหน้าตารางคำขอ (กลับมาแล้วไม่เด้งกลับ "รอรับ") */
const TAB_KEY = "idoc.crm.requests.tab";
export function loadReqTab(): ReqPhase {
  const v = localStorage.getItem(TAB_KEY) as ReqPhase | null;
  return v && REQ_PHASES.includes(v) ? v : "RECEIVE";
}
export function saveReqTab(p: ReqPhase): void {
  localStorage.setItem(TAB_KEY, p);
}

export function deleteRequest(code: string): void {
  try {
    localStorage.setItem(key(), JSON.stringify(loadRequests().filter((r) => r.code !== code)));
    pingNotifs();
  } catch {
    /* ignore */
  }
}

export function saveRequest(rec: CustomerRequest): void {
  try {
    const list = loadRequests();
    const i = list.findIndex((r) => r.code === rec.code);
    if (i >= 0) list[i] = rec;
    else list.unshift(rec);
    const capped = list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX);
    localStorage.setItem(key(), JSON.stringify(capped));
    pingNotifs(); // มีใบใหม่/เปลี่ยนสถานะ → อัปเดต badge + กระดิ่ง
  } catch {
    /* ignore */
  }
}

import { getSession } from "../../shared/session";
import { pingNotifs } from "../../shared/notifications";

/** ใบคำขอดำเนินการ (สินค้า/บริการ) — โครงเดียวกับ CRM · เก็บต่อบริษัทใน localStorage ไปก่อน */
export type ReqPhase = "RECEIVE" | "PROCESS" | "EXPORT" | "DONE";
export const REQ_PHASES: ReqPhase[] = ["RECEIVE", "PROCESS", "EXPORT", "DONE"];

export type ProductRequest = {
  code: string;
  topic: string;        // "ADD" | "EDIT" | "STATUS"
  customer: string;     // สินค้าที่อ้างถึง (string "รหัส · ชื่อ") — ใช้ชื่อ field เดิมเพื่อความเข้ากันของ engine
  requester: string;
  status: string;
  phase: ReqPhase;
  savedAt: number;
  values?: Record<string, string>;
  origValues?: Record<string, string>;
  picked?: { id: string; code: string; name: string; status?: string };
  received?: { by: string; at: number };
  bounce?: { by: string; at: number; reason: string };
  stageId?: string;
  // recipients = ใครเห็นใน "รอรับ" ([]/undefined = ทุกคน) · คนเดียว = ส่งเจาะจง · หลายคน = ส่งทั้งกลุ่ม (เหมา)
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

export type FlowAction = "SEND" | "RECEIVE" | "DECLINE" | "APPROVE" | "REJECT" | "COMPLETE";
export type FlowLogEntry = {
  code: string; action: FlowAction; fromStage?: string; toStage?: string;
  by: string; to?: string; at: number; reason?: string;
};
const logKey = () => `idoc.prod.reqlog.${getSession()?.companyId ?? ""}`;

export function loadLog(code?: string): FlowLogEntry[] {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    return (code ? list.filter((e) => e.code === code) : list).sort((a, b) => b.at - a.at);
  } catch { return []; }
}
export function appendLog(e: FlowLogEntry): void {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    list.push(e);
    localStorage.setItem(logKey(), JSON.stringify(list.slice(-5000)));
  } catch { /* ignore */ }
}
export function relabelLog(oldCode: string, newCode: string): void {
  try {
    const raw = localStorage.getItem(logKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    let changed = false;
    for (const e of list) if (e.code === oldCode) { e.code = newCode; changed = true; }
    if (changed) localStorage.setItem(logKey(), JSON.stringify(list));
  } catch { /* ignore */ }
}

const MAX = 2000;
const key = () => `idoc.prod.requests.${getSession()?.companyId ?? ""}`;

export function loadRequests(): ProductRequest[] {
  try {
    const raw = localStorage.getItem(key());
    const list = raw ? (JSON.parse(raw) as ProductRequest[]) : [];
    return list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX);
  } catch { return []; }
}
export function getRequest(code: string): ProductRequest | null {
  return loadRequests().find((r) => r.code === code) ?? null;
}
export function incomingRequests(): ProductRequest[] {
  return loadRequests().filter((r) => r.phase === "RECEIVE" && !r.received && !r.bounce);
}
export function incomingCount(): number { return incomingRequests().length; }

const TAB_KEY = "idoc.prod.requests.tab";
export function loadReqTab(): ReqPhase {
  const v = localStorage.getItem(TAB_KEY) as ReqPhase | null;
  return v && REQ_PHASES.includes(v) ? v : "RECEIVE";
}
export function saveReqTab(p: ReqPhase): void { localStorage.setItem(TAB_KEY, p); }

export function deleteRequest(code: string): void {
  try { localStorage.setItem(key(), JSON.stringify(loadRequests().filter((r) => r.code !== code))); pingNotifs(); } catch { /* ignore */ }
}
export function saveRequest(rec: ProductRequest): void {
  try {
    const list = loadRequests();
    const i = list.findIndex((r) => r.code === rec.code);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    localStorage.setItem(key(), JSON.stringify(list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX)));
    pingNotifs();
  } catch { /* ignore */ }
}

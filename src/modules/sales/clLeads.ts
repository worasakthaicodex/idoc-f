import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";

/** รายชื่อในชุด CL (ตะกร้าซื้อจริง) — เรียก backend /api/sales-docs/CL/{code}/leads */
export type ClLead = { code: string; name: string; groupName?: string | null; lastContact?: string | null; usedCount: number };
export type ClPullLog = { method: string; detail: string; cnt: number; by: string; at: string };
export type PullBody = {
  q?: string; filters?: Record<string, string>;          // ค้นเอง (เร็ว/เต็มพิกัด)
  field?: string; value?: string;                          // กลุ่ม (ตามประเภท)
  bucket?: string; year?: number;                          // ตามงานขาย
  ready?: string; sinceContactMonths?: number; calendarDays?: number;
  limit?: number; method?: string; detail?: string; by?: string;
};

const tenant = () => getSession()?.companyId ?? "";
export const currentUser = () => { const s = getSession(); return s?.fullName || s?.email || s?.employeeCode || s?.companyCode || "-"; };
const enc = encodeURIComponent;

/** พรีวิวรายชื่อ (ยังไม่ลง DB) + ธงพร้อมใช้/อยู่ CL อื่น */
export type LeadPreview = { code: string; name: string; groupName?: string | null; lastContact?: string | null; ready: boolean; inOtherCl: boolean; usedCount: number };
export type ResolveBody = {
  fromBasket?: boolean; basketId?: string;
  q?: string; filters?: Record<string, string>;
  field?: string; value?: string; bucket?: string; year?: number;
  ready?: string; sinceContactMonths?: number; calendarDays?: number; limit?: number;
};
export type StagedLog = { method: string; detail: string; cnt: number; by: string };

export const resolveClLeads = (code: string, body: ResolveBody) => apiFetch<LeadPreview[]>(`/sales-docs/CL/${enc(code)}/leads/resolve`, { method: "POST", tenant: tenant(), body });
export const saveClLeads = (code: string, codes: string[], logs: StagedLog[], by: string) => apiFetch<{ added: number }>(`/sales-docs/CL/${enc(code)}/leads/save`, { method: "PUT", tenant: tenant(), body: { codes, logs, by } });

export const fetchClLeads = (code: string) => apiFetch<ClLead[]>(`/sales-docs/CL/${enc(code)}/leads`, { tenant: tenant() });
export const pullClLeads = (code: string, body: PullBody) => apiFetch<{ added: number }>(`/sales-docs/CL/${enc(code)}/leads/pull`, { method: "POST", tenant: tenant(), body });
export const removeClLead = (code: string, ref: string, by?: string) => apiFetch(`/sales-docs/CL/${enc(code)}/leads/${enc(ref)}${by ? `?by=${enc(by)}` : ""}`, { method: "DELETE", tenant: tenant() });
export const fetchClPullLog = (code: string) => apiFetch<ClPullLog[]>(`/sales-docs/CL/${enc(code)}/leads/log`, { tenant: tenant() });
/** ทำชุดจนจบ → บันทึกการใช้ลูกค้า +1 รอบ */
export const completeClLeads = (code: string) => apiFetch<{ added: number }>(`/sales-docs/CL/${enc(code)}/leads/complete`, { method: "POST", tenant: tenant() });

/** ===== Worklist: รายชื่อในชุด + ข้อมูลติดต่อ + สถานะ/ประวัติการโทร ===== */
export type CallResult = "INTERESTED" | "CALLBACK" | "NOANSWER" | "CONTACT_ISSUE" | "REJECTED" | "TO_FO";
export type LeadStatus = "NEW" | CallResult;
export type CallEntry = { result: CallResult; minutes?: number | null; note?: string | null; by?: string | null; at: string };
export type WorkLead = {
  code: string; name: string; contactPerson?: string | null; position?: string | null;
  phone?: string | null; email?: string | null; status: LeadStatus; calls: CallEntry[];
};
export type CallBody = { result: CallResult; minutes?: number | null; note?: string; by?: string };

export const fetchClWorklist = (code: string) => apiFetch<WorkLead[]>(`/sales-docs/CL/${enc(code)}/leads/worklist`, { tenant: tenant() });

/** สรุปภาพรวม — ข้อมูลการขายย้อนหลังของลูกค้าทั้งหมดในชุด CL */
export type NameCount = { name: string; count: number };
export type ClSummary = {
  salesTotal: number; qtCount: number; foCount: number; soCount: number;
  groups: NameCount[]; grades: NameCount[]; systems: string[]; techniques: string[]; services: string[];
};
export const fetchClSummary = (code: string) => apiFetch<ClSummary>(`/sales-docs/CL/${enc(code)}/leads/summary`, { tenant: tenant() });

/** รหัสลูกค้าที่มี FO อ้างอิง CL นี้ (จัดกลุ่ม "ส่งต่อ FO") — เจาะจง ไม่โหลด FO ทั้งบริษัท */
export const fetchClFoCustomers = (code: string) => apiFetch<string[]>(`/sales-docs/CL/${enc(code)}/leads/fo-customers`, { tenant: tenant() });

/** ผลดำเนินการ — ตัวเลขที่เกิดจาก CL นี้ (โทร/เปิด FO-QT-SO/ยอดประมาณการ/ยอดขาย) */
export type ClOps = {
  callCount: number; callDistinct: number;
  foCount: number; qtCount: number; soCount: number;
  qtEstimate: number; soSales: number;
};
export const fetchClOps = (code: string) => apiFetch<ClOps>(`/sales-docs/CL/${enc(code)}/leads/ops`, { tenant: tenant() });

/** ข้อมูลเสริมต่อ CL สำหรับกล่องงาน /sales/cl (คิวรีรวบทุก CL ครั้งเดียว) */
export type ClBoxRow = {
  code: string; salesEstimate: number; conditions: string | null;
  lastContact: string | null; nextAppt: string | null;
  foCount: number; qtCount: number; soCount: number;
};
export const fetchClBoxRows = () => apiFetch<ClBoxRow[]>(`/sales-docs/cl-box-rows`, { tenant: tenant() });

/** สายงานเอกสารที่ต่อจาก CL (FO/QT/SO) — ทำต้นไม้แม่-ลูก */
export type ChainDoc = { docType: string; code: string; title: string; srcFo: string; srcQt: string };
export const fetchClChain = (code: string) => apiFetch<ChainDoc[]>(`/sales-docs/CL/${enc(code)}/leads/chain`, { tenant: tenant() });
export const saveClCall = (code: string, ref: string, body: CallBody) =>
  apiFetch<WorkLead[]>(`/sales-docs/CL/${enc(code)}/leads/${enc(ref)}/call`, { method: "POST", tenant: tenant(), body });

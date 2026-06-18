import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { settingsGet, settingsSet } from "../../shared/settingsStore";

/**
 * config ของ Workflow · Stage = ขั้นในวงจรชีวิตของใบ (แกนตั้ง)
 * จัดทำ=หัว, เสร็จสิ้น=ท้าย ตรึงเสมอ · stages บันทึกจริงที่ backend (route/authority ยัง localStorage)
 */
export type StageKind = "WORK" | "REVIEW" | "APPROVE" | "DONE";

export type Stage = {
  id: string;
  name: string;
  kind: StageKind;
  pinned?: "head" | "tail";   // ตรึงหัว/ท้าย — ย้าย/ลบไม่ได้
  group?: string;             // (legacy) กลุ่มเดียว — แปลงเป็น groups ตอนโหลด
  groups?: string[];          // (WORK) กลุ่มข้อมูลที่ขั้นนี้รับผิดชอบ — เลือกได้หลายกลุ่ม (ว่าง = ทุกกลุ่ม)
  lock?: boolean;             // (เลิกใช้) ของเดิม
  outcome?: boolean;          // (DONE) ต้องยืนยันผล
};

/** ชนิดที่ "เพิ่มได้" ระหว่างหัว-ท้าย */
export const ADDABLE_KINDS: StageKind[] = ["WORK", "REVIEW", "APPROVE"];

/** กลุ่มข้อมูลของฟอร์มที่ขั้น WORK เลือกใช้ได้ (ภายหลังต่อกับกลุ่มฟิลด์จริงของเอกสาร) */
export const STAGE_GROUPS: string[] = ["กลุ่ม 1", "กลุ่ม 2", "กลุ่ม 3", "กลุ่ม 4"];

/** ประเภทเอกสารตัวอย่าง (ภายหลังดึงจากแต่ละโมดูล/แบ็กเอนด์) */
export type DocType = { code: string; module: string; name: string; nameEn?: string };
export const DOC_TYPES: DocType[] = [
  // CRM
  { code: "REQUEST", module: "crm", name: "คำขอดำเนินการ", nameEn: "Action request" },
  // สินค้าและบริการ
  { code: "PRODUCT_REQUEST", module: "product", name: "คำขอดำเนินการ (สินค้า)", nameEn: "Action request (Product)" },
  // บัญชี (CO)
  { code: "CC_REQUEST", module: "accounting", name: "คำขอดำเนินการ (Cost Center)", nameEn: "Action request (Cost Center)" },
  { code: "PLAN_REQUEST", module: "accounting", name: "คำขอดำเนินการ (Planning)", nameEn: "Action request (Planning)" },
  // Sales
  { code: "CL", module: "sales", name: "ลูกค้ามุ่งหวัง (CL)", nameEn: "Lead (CL)" },
  { code: "FO", module: "sales", name: "ใบติดตาม (FO)", nameEn: "Follow-up (FO)" },
  { code: "QT", module: "sales", name: "ใบเสนอราคา (QT)", nameEn: "Quotation (QT)" },
  { code: "SO", module: "sales", name: "ใบสั่งขาย (SO)", nameEn: "Sales order (SO)" },
];

/** ประเภทเอกสารของโมดูลนั้น (workflow โชว์เฉพาะของโมดูลที่เข้ามา) */
export const docTypesOf = (module: string) => DOC_TYPES.filter((d) => d.module === module);

export const docTypeName = (code: string, lang?: string) => {
  const d = DOC_TYPES.find((x) => x.code === code);
  if (!d) return code;
  return lang && !lang.startsWith("th") && d.nameEn ? d.nameEn : d.name;
};

/**
 * Route = เส้นทางไหลระหว่างประเภทใบ (แกนนอน) · ลำดับตายตัว สลับไม่ได้
 * ตัดออกได้เฉพาะ step ที่ removable · (เส้นทาง+removable ผู้ออกแบบต่อไว้ให้)
 */
export type RouteStep = { docType: string; removable?: boolean };
export type WfRoute = { id: string; module: string; name: string; steps: RouteStep[] };

export const ROUTES: WfRoute[] = [
  {
    id: "sales-main", module: "sales", name: "งานขายหลัก",
    steps: [
      { docType: "CL", removable: true },
      { docType: "FO", removable: true },
      { docType: "QT" },               // QT ตัดไม่ได้ (แกนหลักของงานขาย)
      { docType: "SO", removable: true },
    ],
  },
  {
    id: "crm-request", module: "crm", name: "คำขอดำเนินการ",
    steps: [{ docType: "REQUEST" }], // เอกสารเดียว → ตัด DB · ตัดไม่ได้
  },
  {
    id: "acc-cc-request", module: "accounting", name: "คำขอดำเนินการ Cost Center",
    steps: [{ docType: "CC_REQUEST" }],
  },
  {
    id: "acc-plan-request", module: "accounting", name: "คำขอดำเนินการ Planning",
    steps: [{ docType: "PLAN_REQUEST" }],
  },
];

/** เส้นทางของโมดูลนั้น */
export const routesOf = (module: string) => ROUTES.filter((r) => r.module === module);

/** docType ของ step ที่ถูก "ตัดออก" — เก็บจริงที่ backend (tenant_setting) */
export function getRouteCuts(routeId: string): string[] {
  return settingsGet<string[]>(`wf.routecuts.${routeId}`, []);
}
export function setRouteCuts(routeId: string, cuts: string[]): void {
  settingsSet(`wf.routecuts.${routeId}`, cuts);
}

/** docType ที่ "ใช้งานจริง" ของเส้นทางโมดูลนั้น (steps ลบที่ถูกตัดออก) */
export function activeDocTypes(module: string): string[] {
  const route = routesOf(module)[0];
  if (!route) return docTypesOf(module).map((d) => d.code);
  const cuts = getRouteCuts(route.id);
  return route.steps.filter((s) => !cuts.includes(s.docType)).map((s) => s.docType);
}

/* ===== กล่องงานของแต่ละบทบาท (Work box per role) ===== */
/** บทบาทผู้ทำงานของแต่ละโมดูล (เช่น งานขายมี MK/Telesale/Sale/AdminSale) */
export type WorkRole = { key: string; name: string; en: string };
export const ROLES_BY_MODULE: Record<string, WorkRole[]> = {
  sales: [
    { key: "mk", name: "การตลาด (MK)", en: "Marketing (MK)" },
    { key: "telesale", name: "เทเลเซล", en: "Telesale" },
    { key: "sale", name: "เซล", en: "Sale" },
    { key: "adminsale", name: "แอดมินขาย", en: "Admin Sale" },
  ],
};
export const roleName = (r: WorkRole, lang: string) => (lang.startsWith("th") ? r.name : r.en);
export const rolesOf = (module: string): WorkRole[] => ROLES_BY_MODULE[module] ?? [];

/** ค่าเริ่มต้น: แต่ละบทบาทเห็นกล่องเอกสารหลักของช่วงตัวเอง */
const DEFAULT_ROLE_BOXES: Record<string, Record<string, string[]>> = {
  sales: { mk: ["CL"], telesale: ["FO"], sale: ["QT"], adminsale: ["SO"] },
};
/** map: roleKey → docType[] ที่บทบาทนั้นเห็นในกล่องงาน — เก็บจริงที่ backend (ตั้งต่อบริษัท) */
export function getRoleBoxes(module: string): Record<string, string[]> {
  return settingsGet<Record<string, string[]>>(`wf.rolebox.${module}`, JSON.parse(JSON.stringify(DEFAULT_ROLE_BOXES[module] ?? {})));
}
export function setRoleBoxes(module: string, map: Record<string, string[]>): void {
  settingsSet(`wf.rolebox.${module}`, map);
}

/**
 * การออกรหัสเอกสาร (numbering) — ปล่อยเลขที่เอกสารเมื่อเหตุการณ์ใด (ต่อประเภทเอกสาร)
 *  CREATE = เมื่อกดสร้าง · RECEIVE = เมื่อกดรับ · APPROVE = เมื่ออนุมัติ
 */
export type IssueEvent = "CREATE" | "RECEIVE" | "APPROVE";
export const ISSUE_EVENTS: IssueEvent[] = ["CREATE", "RECEIVE", "APPROVE"];
export function getIssueEvent(dt: string): IssueEvent {
  const v = settingsGet<IssueEvent>(`wf.numbering.${dt}`, "CREATE");
  return ISSUE_EVENTS.includes(v) ? v : "CREATE";
}
export function setIssueEvent(dt: string, ev: IssueEvent): void {
  settingsSet(`wf.numbering.${dt}`, ev);
}

const uid = () => crypto.randomUUID();

/** ค่าเริ่มต้น — id "คงที่" เพื่อให้ assigns ของเอกสารสิทธิ์อ้างถึง stage เดียวกันได้ทุกหน้า/ทุกครั้ง */
export const defaultStages = (): Stage[] => [
  { id: "st-head", name: "จัดทำ", kind: "WORK", pinned: "head" },
  { id: "st-exec", name: "ดำเนินการ", kind: "WORK" },
  { id: "st-review", name: "ตรวจสอบ", kind: "REVIEW" },
  { id: "st-approve", name: "อนุมัติ", kind: "APPROVE" },
  { id: "st-done", name: "เสร็จสิ้น", kind: "DONE", pinned: "tail", outcome: false },
];

export const newStage = (kind: StageKind, name: string): Stage => ({ id: uid(), name, kind });

/** แปลง stage รุ่นเก่า (group เดี่ยว) → groups[] */
const normStages = (stages: Stage[]): Stage[] => stages.map((s) => {
  if (s.groups) return s;
  if (s.group) { const { group, ...rest } = s; return { ...rest, groups: [group] }; }
  return s;
});

/** โหลด stages จาก backend (ว่าง = ใช้ค่าเริ่มต้น) */
export async function fetchStages(dt: string): Promise<Stage[]> {
  const tenant = getSession()?.companyId ?? "";
  try {
    const r = await apiFetch<{ docType: string; stages: Stage[] }>(`/workflow/stages?docType=${encodeURIComponent(dt)}`, { tenant });
    return r.stages && r.stages.length ? normStages(r.stages) : defaultStages();
  } catch {
    return defaultStages();
  }
}

/** บันทึก stages ลง backend */
export async function saveStagesApi(dt: string, stages: Stage[]): Promise<void> {
  const tenant = getSession()?.companyId ?? "";
  await apiFetch(`/workflow/stages`, { method: "PUT", tenant, body: { docType: dt, stages } });
}

/**
 * เอกสารสิทธิ์ (Authority) — แยกใบต่อความสามารถ (scope) + สมาชิก
 * scope = "CREATE" (สิทธิ์สร้าง) หรือ stage.id (สิทธิ์ประจำขั้น = ปลายทาง FLOW)
 * member = ใครอยู่ในใบนี้ (3 แบบ) · budget = เพดานอนุมัติ (เฉพาะ scope ที่เป็นขั้น APPROVE)
 */
export type MemberMode = "ALL" | "USERS" | "ORG";
export type MemberRule = {
  mode: MemberMode;
  users: string[];        // ระบุชื่อ
  positions: string[];    // ตามตำแหน่ง/แผนก/ฝ่าย (ORG)
  departments: string[];
  divisions: string[];
};
/**
 * กติกาตอนใช้งานจริง (runtime — จะบังคับใน workflow execution engine ภายหลัง):
 *  - ยึด "ผู้สร้างเอกสาร" เป็นหัวของกรอบ → ผู้สร้างเห็นผู้อนุมัติเฉพาะในกรอบของตัวเองเท่านั้น
 *  - ถ้าผู้สร้างตรงหลายกรอบ → ใช้กรอบ "แรก" (บนสุดของลำดับ list)
 *  - คนดำเนินการ/ตรวจ อยู่ได้หลายกรอบ (ไม่กำหนดกรอบ) — การเลือกกรอบยึดที่ผู้สร้างเสมอ
 * (หน้าตั้งค่านี้แค่กำหนดข้อมูล · ลำดับกรอบ = ลำดับใน list, เรียงขึ้น-ลงได้)
 */

/** การมอบหมายของ 1 ขั้น (stage) ในกรอบ — ใคร/ตำแหน่งไหนนั่งทำขั้นนี้ */
export type StageAssign = {
  member: MemberRule;
  budget?: number | null; // เพดานอนุมัติ (เฉพาะขั้น APPROVE)
};

/**
 * เอกสารสิทธิ์ (Authority) = 1 "กรอบ" (เช่น สำหรับทีม B)
 * assigns = แมปต่อ stage.id → ใครนั่งทำขั้นนั้น · กล่องย่อยถูกสร้างให้ตรงกับ stages ที่วางไว้
 */
export type Authority = {
  id: string;
  name: string;
  note?: string;            // ป้ายอธิบาย เช่น "สำหรับทีม B" (กันสับสนตอนเลือก)
  assigns: Record<string, StageAssign>;
};

export const emptyMember = (): MemberRule => ({ mode: "ALL", users: [], positions: [], departments: [], divisions: [] });
export const emptyAssign = (): StageAssign => ({ member: emptyMember(), budget: null });
export const newAuthority = (): Authority => ({ id: uid(), name: "", note: "", assigns: {} });

/** member resolve ได้ 0 คนแน่ ๆ ไหม (guard กันตั้งผิด) */
export function memberIsEmpty(m: MemberRule): boolean {
  if (m.mode === "ALL") return false;
  if (m.mode === "USERS") return m.users.length === 0;
  return m.positions.length + m.departments.length + m.divisions.length === 0;
}

/** รองรับข้อมูลเก่า → ให้มี assigns เสมอ */
function normalizeAuthority(a: Authority): Authority {
  return { id: a.id, name: a.name ?? "", note: a.note ?? "", assigns: a.assigns ?? {} };
}

/** โหลดเอกสารสิทธิ์จาก backend */
export async function fetchAuthorities(dt: string): Promise<Authority[]> {
  const tenant = getSession()?.companyId ?? "";
  try {
    const r = await apiFetch<{ docType: string; authorities: Authority[] }>(`/workflow/authorities?docType=${encodeURIComponent(dt)}`, { tenant });
    return (r.authorities ?? []).map(normalizeAuthority);
  } catch {
    return [];
  }
}

/** บันทึกเอกสารสิทธิ์ลง backend */
export async function saveAuthoritiesApi(dt: string, list: Authority[]): Promise<void> {
  const tenant = getSession()?.companyId ?? "";
  await apiFetch(`/workflow/authorities`, { method: "PUT", tenant, body: { docType: dt, authorities: list } });
}

/* ===== FLOW runtime (ใช้ config ขับการส่งต่อจริง) ===== */

/** ผู้ใช้ปัจจุบัน (อย่างย่อ) ที่ใช้จับคู่สมาชิกในกรอบ */
export type FlowUser = { fullName?: string; email?: string; employeeCode?: string };

function userInList(list: string[], u: FlowUser): boolean {
  const keys = [u.fullName, u.email, u.employeeCode].filter(Boolean).map((x) => x!.trim().toLowerCase());
  return list.some((name) => keys.includes(name.trim().toLowerCase()));
}

/** member rule ระบุผู้ใช้นี้ "ชัดเจน" ไหม (ALL ไม่นับว่าชัด) */
export function memberMatchesUser(m: MemberRule, u: FlowUser): boolean {
  if (m.mode === "USERS") return userInList(m.users, u);
  if (m.mode === "ORG") return false; // ยังไม่มีข้อมูล org ของผู้ใช้
  return false;
}

/** สมาชิกที่นั่งขั้นนี้ในกรอบ — ไม่ได้ตั้ง = ALL (ตรงกับค่าเริ่มต้นที่ UI โชว์) */
export function memberAt(a: Authority, stageId: string): MemberRule {
  return a.assigns[stageId]?.member ?? emptyMember();
}

/**
 * แปลง member rule → รายชื่อผู้รับที่เป็นไปได้ (ตอนส่ง FLOW จะได้เลือกได้)
 *  - USERS = รายชื่อที่ระบุไว้ตรง ๆ
 *  - ALL   = ทุกคน (ส่งรายชื่อทั้งบริษัทเข้ามา)
 *  - ORG   = ยังไม่มีข้อมูล org ของผู้ใช้ → คืน [] (ถือเป็นส่งทั้งกลุ่มกว้าง)
 */
export function resolveCandidates(m: MemberRule | undefined, allUsers: string[]): string[] {
  if (!m) return [];
  if (m.mode === "USERS") return [...m.users];
  if (m.mode === "ALL") return [...allUsers];
  return [];
}

/**
 * map โมดูล workflow ("crm"/"product"/"sales") → code สิทธิ์โมดูลในตำแหน่ง (ปัจจุบันเก็บเป็นชื่อไทย)
 * สิทธิ์ผูกที่ "ตำแหน่ง" (Position.modules) พนักงานได้สิทธิ์ตามตำแหน่ง
 */
const MODULE_PERM_CODE: Record<string, string> = {
  crm: "ลูกค้า",
  product: "สินค้าและบริการ",
  sales: "งานขาย",
  accounting: "บัญชี",
};

type PosPerm = { name: string; modules?: { module: string; level: string }[] };
type EmpLite = { fullName?: string; position?: string; role?: string };

/**
 * รายชื่อพนักงานที่ "มีสิทธิ์อย่างน้อย user" ของโมดูลนี้ — เวอร์ชันสยบกระสุนปืนกลด้วย RAM แคช 24 ชม.
 */
export async function fetchModuleUsers(module: string): Promise<string[]> {
  const tenant = getSession()?.companyId ?? "";
  const permCode = (MODULE_PERM_CODE[module] ?? module).trim().toLowerCase();
  try {
    // 🔥 วิ่งผ่าน apiFetch กลาง ดึงปุ๊บชนแคช RAM ในเครื่อง 0 ms สอยข้อมูลไปใช้ได้ทันที ไม่หลุดไปกวน GCP
    const [emps, poss] = await Promise.all([
      apiFetch<{ content: EmpLite[] }>("/admin/employees?size=300", { tenant }),
      apiFetch<PosPerm[]>("/admin/positions", { tenant }),
    ]);

    const positionList = poss ?? [];
    const okPos = new Set(
      positionList
        .filter((p) => (p.modules ?? []).some((mp) => (mp.module ?? "").trim().toLowerCase() === permCode))
        .map((p) => p.name),
    );

    // 🛡️ ป้องกันกรณี emps.content หลุดมาเป็น null หรือ undefined กันแอปขวิดพัง
    const employeeList = emps?.content ?? [];

    return employeeList
      .filter((e) => e.role === "COMPANY_OWNER" || (!!e.position && okPos.has(e.position)))
      .map((e) => (e.fullName ?? "").trim())
      .filter(Boolean);
  } catch (err) {
    console.error(`❌ [Fetch Module Users Error] Module: ${module}`, err);
    return [];
  }
}

/**
 * เลือกกรอบ (Authority) ของผู้สร้าง ตามกติกา:
 *  1) กรอบที่ "หัวขั้น" ระบุชื่อผู้สร้างชัด → อันแรกที่เจอ
 *  2) ไม่มี → กรอบที่หัวขั้นเป็น ALL (รวมที่ไม่ได้ตั้ง = ALL) → อันแรก
 *  3) ไม่มีอีก → null
 */
export function pickAuthorityFrame(list: Authority[], headStageId: string, u: FlowUser): Authority | null {
  const explicit = list.find((a) => memberMatchesUser(memberAt(a, headStageId), u));
  if (explicit) return explicit;
  return list.find((a) => memberAt(a, headStageId).mode === "ALL") ?? null;
}

/**
 * รายชื่อ "ผู้มีสิทธิ์สร้าง" เอกสารชนิดนี้ — ดึงจากผู้ที่ถูกมอบหมายขั้น "จัดทำ" (head) ในเอกสารสิทธิ์ (workflow authorities)
 * union ทุกกรอบ · ถ้ายังไม่ตั้งสิทธิ์เลย → fallback เป็นผู้ใช้ของโมดูล (กันรายชื่อว่าง)
 */
export async function fetchDocCreators(dt: string, module = "sales"): Promise<string[]> {
  try {
    const [stages, auths, allUsers] = await Promise.all([fetchStages(dt), fetchAuthorities(dt), fetchModuleUsers(module)]);
    const head = stages.find((s) => s.pinned === "head") ?? stages[0];
    if (!head) return allUsers;
    const set = new Set<string>();
    auths.forEach((a) => resolveCandidates(memberAt(a, head.id), allUsers).forEach((u) => set.add(u)));
    const list = [...set];
    return list.length ? list : allUsers;
  } catch {
    return [];
  }
}

/**
 * จำว่าเอกสารใช้ "กรอบสิทธิ์" ไหน (ยึดผู้สร้าง = หัวกรอบของทั้งใบ)
 * เก็บต่อบริษัท+docType ไว้ก่อน (mock) → ภายหลังผูกกับเลขที่เอกสารจริงใน backend
 */
export type UsedFrame = { id: string; name: string };
const ufkey = (dt: string) => `idoc.wf.usedframe.${getSession()?.companyId ?? ""}.${dt}`;
export function loadUsedFrame(dt: string): UsedFrame | null {
  try { const raw = localStorage.getItem(ufkey(dt)); return raw ? (JSON.parse(raw) as UsedFrame) : null; } catch { return null; }
}
export function storeUsedFrame(dt: string, f: UsedFrame): void {
  localStorage.setItem(ufkey(dt), JSON.stringify(f));
}

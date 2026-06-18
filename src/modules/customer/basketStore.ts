import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";

/** ตะกร้ารายชื่อลูกค้า — ของผู้ใช้ (owner=employeeCode) · บันทึกจริงที่ backend (/api/baskets) */
export type Basket = { id: string; name: string; count: number; owner: string; note?: string | null };
export type CrmUser = { code: string; name: string };
export type BasketItem = { code: string; name: string; groupName?: string | null; lastContact?: string | null; fo: number; qt: number; so: number; reason?: string | null; removeBy?: string | null; addedAt?: string | null };

/** เกณฑ์ยกก้อนลงตะกร้า — ตรงกับ AddToBasketRequest ฝั่ง backend */
export type AddBasketBody = {
  codes?: string[];
  field?: string; value?: string;
  bucket?: string; year?: number;
  limit?: number;
  onlyNew?: boolean;   // เฉพาะคนที่ยังไม่อยู่ในตะกร้านี้
  ready?: string; sinceContactMonths?: number; calendarDays?: number;
  reason?: string; removeBy?: string;   // เหตุผล + วันที่ต้องหยิบออก (ISO yyyy-MM-dd)
};

const tenant = () => getSession()?.companyId ?? "";
/** รหัสผู้ใช้ปัจจุบัน (เจ้าของตะกร้า) */
export const currentOwner = () => { const s = getSession(); return s?.employeeCode || s?.email || s?.companyCode || "-"; };
const owner = currentOwner;

export const listBaskets = () => apiFetch<Basket[]>(`/baskets?owner=${encodeURIComponent(owner())}`, { tenant: tenant() });
export const createBasket = (name: string) => apiFetch<Basket>(`/baskets?owner=${encodeURIComponent(owner())}`, { method: "POST", tenant: tenant(), body: { name } });
export const deleteBasket = (id: string) => apiFetch(`/baskets/${id}`, { method: "DELETE", tenant: tenant() });
export const updateBasket = (id: string, body: { name?: string; note?: string }) =>
  apiFetch<Basket>(`/baskets/${id}`, { method: "PATCH", tenant: tenant(), body });
export const fetchBasketItems = (id: string) => apiFetch<BasketItem[]>(`/baskets/${id}/items`, { tenant: tenant() });
export type BasketConflict = { code: string; owner: string; basketName: string };
export const addToBasket = (id: string, body: AddBasketBody) => apiFetch<{ added: number; conflicts: BasketConflict[] }>(`/baskets/${id}/add`, { method: "POST", tenant: tenant(), body });
export const removeFromBasket = (id: string, code: string) => apiFetch(`/baskets/${id}/items/${encodeURIComponent(code)}`, { method: "DELETE", tenant: tenant() });
export const updateBasketItem = (id: string, code: string, body: { reason?: string; removeBy?: string }) =>
  apiFetch(`/baskets/${id}/items/${encodeURIComponent(code)}`, { method: "PATCH", tenant: tenant(), body });

export const getShares = (id: string) => apiFetch<string[]>(`/baskets/${id}/shares`, { tenant: tenant() });
export const setShares = (id: string, users: string[]) => apiFetch<{ shared: number }>(`/baskets/${id}/shares`, { method: "PUT", tenant: tenant(), body: { users } });

type EmpLite = { code?: string; fullName?: string; position?: string; role?: string };
type PosPerm = { name: string; modules?: { module: string; level: string }[] };

// 🎯 ปรับปรุงเฉพาะฟังก์ชันล่างสุดของไฟล์นี้ เพื่อผสานพลังกับแคช RAM 24 ชั่วโมงครับเดฟ
export async function fetchCrmUsers(): Promise<CrmUser[]> {
  const t = tenant();
  try {
    // 🔥 ยิงผ่านท่อ apiFetch ที่มีตัวดักแคชอยู่เบื้องหลัง ดึงปุ๊บได้ข้อมูลจากแรม 0 ms ทันที!
    const [emps, poss] = await Promise.all([
      apiFetch<{ content: EmpLite[] }>("/admin/employees?size=300", { tenant: t }),
      apiFetch<PosPerm[]>("/admin/positions", { tenant: t }),
    ]);
    
    const okPos = new Set(
      (poss ?? [])
        .filter((p) => (p.modules ?? []).some((mp) => (mp.module ?? "").trim() === "ลูกค้า"))
        .map((p) => p.name)
    );
    
    // ป้องกันกรณี emps.content หลุดมาเป็น null/undefined กันแอปขวิดหน้าจอขาว
    const employeeList = emps?.content ?? [];
    
    return employeeList
      .filter((e) => e.role === "COMPANY_OWNER" || (!!e.position && okPos.has(e.position)))
      .map((e) => ({ 
        code: (e.code ?? "").trim(), 
        name: (e.fullName ?? "").trim() || (e.code ?? "") 
      }))
      .filter((u) => u.code && u.code !== currentOwner());
  } catch (err) { 
    console.error("❌ [Fetch CRM Users Error]", err);
    return []; 
  }
}

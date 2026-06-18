import { registerDoc } from "../workflow/docRegistry";
import { apiFetch } from "../../shared/api";
import { COLUMN_KEYS } from "./customerFields";
import type { CustomerRequest } from "./customerRequests";

/**
 * ลงทะเบียนเอกสารของโมดูลลูกค้า — "คำขอดำเนินการ" (REQUEST)
 * ปลายทางเสร็จสิ้น = ทำตามคำขอกับลูกค้าจริง (เพิ่ม/แก้ไข/แก้สถานะ) ผ่าน API
 * → backend บันทึก revision ให้เอง → โผล่ใน Tab "ประวัติข้อมูล" ของลูกค้า
 */
const isColumn = (k: string) => COLUMN_KEYS.includes(k);

type CustomerSnap = { name?: string; groupName?: string; status?: string; attributes?: Record<string, string> };

/** สร้าง attributes จาก values (เฉพาะ key ที่ไม่ใช่คอลัมน์หลัก) */
function attrsFrom(vals: Record<string, string>): Record<string, string> {
  const a: Record<string, string> = {};
  Object.entries(vals).forEach(([k, v]) => { if (!isColumn(k) && v && String(v).trim()) a[k] = String(v); });
  return a;
}

registerDoc({
  code: "REQUEST",
  module: "crm",
  completeLabel: "ทำตามคำขอ: เพิ่ม/แก้ไข/แก้สถานะลูกค้า แล้วบันทึกประวัติ",
  complete: async (recRaw, ctx) => {
    const rec = recRaw as unknown as CustomerRequest;
    const vals = rec.values ?? {};
    try {
      // เพิ่มลูกค้าใหม่
      if (rec.topic === "ADD") {
        const name = (vals.name ?? "").trim();
        if (!name) return false; // ชื่อห้ามว่าง
        await apiFetch("/customers", {
          method: "POST", tenant: ctx.tenant, headers: { "X-Workflow": "1" },
          body: { name, groupName: (vals.groupName ?? "").trim() || null, status: rec.status, attributes: attrsFrom(vals), changedBy: ctx.changedBy },
        });
        return true;
      }

      const id = rec.picked?.id;
      if (!id) return false;
      // ดึงข้อมูลปัจจุบันก่อน — กันฟิลด์อื่นหาย/เป็น null (โดยเฉพาะคำขอแก้สถานะที่ไม่ได้กรอกชื่อ)
      const cur = await apiFetch<CustomerSnap>(`/customers/${id}`, { tenant: ctx.tenant });

      let body: Record<string, unknown>;
      if (rec.topic === "STATUS") {
        // เปลี่ยนเฉพาะสถานะ คงชื่อ/กลุ่ม/attributes เดิมไว้ทั้งหมด
        body = { name: cur.name, groupName: cur.groupName ?? null, status: rec.status, attributes: cur.attributes ?? {}, changedBy: ctx.changedBy };
      } else {
        // แก้ไขข้อมูล — ใช้ค่าที่กรอก แต่ถ้าชื่อ/กลุ่มว่างให้คงของเดิม (กัน null)
        body = {
          name: (vals.name ?? "").trim() || cur.name,
          groupName: (vals.groupName ?? "").trim() || cur.groupName || null,
          status: rec.status,
          attributes: attrsFrom(vals),
          changedBy: ctx.changedBy,
        };
      }
      await apiFetch(`/customers/${id}`, { method: "PUT", tenant: ctx.tenant, headers: { "X-Workflow": "1" }, body });
      return true;
    } catch {
      return false;
    }
  },
});

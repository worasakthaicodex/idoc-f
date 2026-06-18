import { registerDoc } from "../workflow/docRegistry";
import { apiFetch } from "../../shared/api";
import { COLUMN_KEYS } from "./productFields";
import type { ProductRequest } from "./productRequests";

/**
 * ลงทะเบียนเอกสารของโมดูลสินค้า — "คำขอดำเนินการ (สินค้า)" (PRODUCT_REQUEST)
 * ปลายทางเสร็จสิ้น = ทำตามคำขอกับสินค้าจริง (เพิ่ม/แก้ไข/แก้สถานะ) ผ่าน API /products
 * → backend บันทึก revision ให้เอง
 */
const isColumn = (k: string) => COLUMN_KEYS.includes(k);
type ProductSnap = { name?: string; groupName?: string; status?: string; attributes?: Record<string, string> };

function attrsFrom(vals: Record<string, string>): Record<string, string> {
  const a: Record<string, string> = {};
  Object.entries(vals).forEach(([k, v]) => { if (!isColumn(k) && v && String(v).trim()) a[k] = String(v); });
  return a;
}

registerDoc({
  code: "PRODUCT_REQUEST",
  module: "product",
  completeLabel: "ทำตามคำขอ: เพิ่ม/แก้ไข/แก้สถานะสินค้า แล้วบันทึกประวัติ",
  complete: async (recRaw, ctx) => {
    const rec = recRaw as unknown as ProductRequest;
    const vals = rec.values ?? {};
    try {
      if (rec.topic === "ADD") {
        const name = (vals.name ?? "").trim();
        if (!name) return false;
        await apiFetch("/products", {
          method: "POST", tenant: ctx.tenant, headers: { "X-Workflow": "1" },
          body: { name, groupName: (vals.groupName ?? "").trim() || null, status: rec.status, attributes: attrsFrom(vals), changedBy: ctx.changedBy },
        });
        return true;
      }
      const id = rec.picked?.id;
      if (!id) return false;
      const cur = await apiFetch<ProductSnap>(`/products/${id}`, { tenant: ctx.tenant });

      let body: Record<string, unknown>;
      if (rec.topic === "STATUS") {
        body = { name: cur.name, groupName: cur.groupName ?? null, status: rec.status, attributes: cur.attributes ?? {}, changedBy: ctx.changedBy };
      } else {
        body = {
          name: (vals.name ?? "").trim() || cur.name,
          groupName: (vals.groupName ?? "").trim() || cur.groupName || null,
          status: rec.status,
          attributes: attrsFrom(vals),
          changedBy: ctx.changedBy,
        };
      }
      await apiFetch(`/products/${id}`, { method: "PUT", tenant: ctx.tenant, headers: { "X-Workflow": "1" }, body });
      return true;
    } catch {
      return false;
    }
  },
});

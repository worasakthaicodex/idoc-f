import { apiFetch } from "../../shared/api";

export type LegacyProduct = { name: string; groupName: string | null; status: string; attributes: Record<string, string> };
export type ImportResult = { ok: number; skip: number; fail: number; total: number };

/**
 * นำเข้าสินค้า/บริการจากระบบเก่า (legacyProducts.json) เข้า backend /products
 *  - ใช้ tenant ปัจจุบัน (จาก session ที่ login) · กันซ้ำด้วย attributes.legacyId
 *  - onProgress เรียกระหว่างทำเพื่ออัปเดตข้อความสถานะ
 */
export async function importLegacyProducts(
  tenant: string,
  changedBy: string,
  onProgress?: (done: number, r: ImportResult) => void,
): Promise<ImportResult> {
  const data = ((await import("./data/legacyProducts.json")).default as LegacyProduct[]) || [];
  // map ของเดิมตาม legacyId → ใช้ทั้งกันซ้ำ และ "อัปเดตของที่นำเข้าผิด" (เช่น materialType เก่าเป็น "งานบริการ")
  const existing = new Map<string, { id: string; attributes: Record<string, string> }>();
  try {
    const pg = await apiFetch<{ content?: { id: string; attributes?: Record<string, string> }[] }>(`/products?size=5000`, { tenant });
    (pg.content || []).forEach((p) => { const lid = p.attributes?.legacyId; if (lid) existing.set(lid, { id: p.id, attributes: p.attributes || {} }); });
  } catch { /* ดึงของเดิมไม่ได้ → นำเข้าทั้งหมด */ }
  const r: ImportResult = { ok: 0, skip: 0, fail: 0, total: data.length };
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const ex = d.attributes.legacyId ? existing.get(d.attributes.legacyId) : undefined;
    try {
      if (ex) {
        // มีอยู่แล้ว → อัปเดตเฉพาะเมื่อ materialType ไม่ตรง (ของเดิมนำเข้าผิด) · ตรงแล้วก็ข้าม
        if ((ex.attributes.materialType || "") !== (d.attributes.materialType || "")) {
          await apiFetch(`/products/${ex.id}`, {
            method: "PUT", tenant, headers: { "X-Workflow": "1" },
            body: { name: d.name, groupName: d.groupName, status: d.status, attributes: { ...ex.attributes, ...d.attributes }, changedBy },
          });
          r.ok++;
        } else r.skip++;
      } else {
        await apiFetch("/products", {
          method: "POST", tenant, headers: { "X-Workflow": "1" },
          body: { name: d.name, groupName: d.groupName, status: d.status, attributes: d.attributes, changedBy },
        });
        r.ok++;
      }
    } catch { r.fail++; }
    if (onProgress && (i % 10 === 0 || i === data.length - 1)) onProgress(i + 1, r);
  }
  return r;
}

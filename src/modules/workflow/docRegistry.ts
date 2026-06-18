/**
 * ทะเบียนเอกสาร (Document Registry) — แต่ละชนิดเอกสารลงทะเบียนว่า "เมื่อถึงปลายทาง (เสร็จสิ้น) ต้องทำอะไร"
 * engine (หน้าคำขอ/flow) เรียก getDoc(code).complete(...) โดยไม่ต้องรู้รายละเอียดของแต่ละชนิด
 * เพิ่มเอกสารใหม่ = แต่ละโมดูล registerDoc ของตัวเอง (ไม่แตะ engine)
 */
export type DocCompleteCtx = { tenant: string; changedBy: string };

export type DocDescriptor = {
  code: string;            // docType เช่น "REQUEST" | "QT" | "SO"
  module: string;
  /** คำอธิบายปลายทาง (โชว์ให้ผู้ใช้รู้ว่าเสร็จแล้วระบบทำอะไร) */
  completeLabel?: string;
  /** การกระทำเมื่อเอกสารถึงปลายทาง "เสร็จสิ้น" — คืน true ถ้าสำเร็จ */
  complete?: (rec: Record<string, unknown>, ctx: DocCompleteCtx) => Promise<boolean>;
};

const registry: Record<string, DocDescriptor> = {};

export function registerDoc(d: DocDescriptor): void {
  registry[d.code] = d;
}

export function getDoc(code: string): DocDescriptor | undefined {
  return registry[code];
}

export function allDocs(): DocDescriptor[] {
  return Object.values(registry);
}

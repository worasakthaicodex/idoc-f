import { type ReactNode } from "react";

/**
 * แสดงชื่อเอกสารปัจจุบันเท่านั้น (ตัดตัวสลับข้ามโมดูลออกแล้ว)
 * คงพารามิเตอร์ fallback ไว้เพื่อให้จุดเรียกเดิมใช้งานได้ — ส่งชื่อเอกสารเข้ามาได้เลย
 */
export default function CrossNavSelect({ fallback }: { fallback?: ReactNode }) {
  return <>{fallback ?? null}</>;
}

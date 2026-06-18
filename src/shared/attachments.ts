import { apiFetch } from "./api";
import { getSession } from "./session";

/**
 * ไฟล์แนบ — ใช้ระบบ attachment ของ backend (presigned URL + โควตาต่อบริษัท)
 * flow: ขอ upload-url → PUT ไฟล์ตรงขึ้น storage (bytes ไม่ผ่าน backend) → confirm
 * provider สลับได้ที่ backend (dev | firebase | R2 ...) โดยหน้าจอไม่ต้องแก้
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB ต่อไฟล์
const tenant = () => getSession()?.companyId ?? "";

export type Attachment = {
  id: string; ownerType: string; ownerId: string;
  filename: string; contentType: string; sizeBytes: number;
  status: string; createdAt: string;
  category?: string | null; sourceRef?: string | null;
};
type UploadUrl = { attachmentId: string; uploadUrl: string; method: string; headers: Record<string, string>; storageKey: string };

/** อัปโหลดไฟล์ 1 ไฟล์ → คืน metadata (โยน error: FILE_TOO_LARGE / UPLOAD_FAILED / QUOTA / NO_OWNER) */
export async function uploadAttachment(ownerType: string, ownerId: string, file: File, opts?: { category?: string; sourceRef?: string }): Promise<Attachment> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("FILE_TOO_LARGE");
  if (!ownerId) throw new Error("NO_OWNER");
  const t = tenant();
  const up = await apiFetch<UploadUrl>("/admin/attachments/upload-url", {
    method: "POST", tenant: t,
    body: { ownerType, ownerId, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, category: opts?.category || null, sourceRef: opts?.sourceRef || null },
  });
  // PUT bytes ตรงขึ้น storage — ข้ามถ้าเป็น dev mock (ยังไม่ตั้ง Firebase)
  if (!up.uploadUrl.includes("dev-storage.local")) {
    const res = await fetch(up.uploadUrl, { method: up.method || "PUT", headers: up.headers || {}, body: file });
    if (!res.ok) throw new Error("UPLOAD_FAILED");
  }
  return apiFetch<Attachment>(`/admin/attachments/${up.attachmentId}/confirm`, { method: "POST", tenant: t });
}

export async function listAttachments(ownerType: string, ownerId: string): Promise<Attachment[]> {
  if (!ownerId) return [];
  return (await apiFetch<Attachment[]>(`/admin/attachments?ownerType=${encodeURIComponent(ownerType)}&ownerId=${encodeURIComponent(ownerId)}`, { tenant: tenant() })) || [];
}

export async function attachmentDownloadUrl(id: string): Promise<string> {
  const r = await apiFetch<{ url: string }>(`/admin/attachments/${id}/download-url`, { tenant: tenant() });
  return r?.url || "";
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiFetch(`/admin/attachments/${id}`, { method: "DELETE", tenant: tenant() });
}

/** พื้นที่จัดเก็บที่ใช้ไป/โควตา ของบริษัท (ไว้ดูว่าเหลือเท่าไร กันเกินแพ็กเกจ) */
export async function storageUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
  return apiFetch<{ usedBytes: number; quotaBytes: number }>("/admin/attachments/usage", { tenant: tenant() });
}

/** พื้นที่รวมทั้งระบบ (ทุกบริษัท) — หน้า "จัดการ server" ของเจ้าของระบบ */
export async function storageUsageAll(): Promise<{ usedBytes: number; quotaBytes: number }> {
  return apiFetch<{ usedBytes: number; quotaBytes: number }>("/admin/attachments/usage-all", { tenant: tenant() });
}

export const humanSize = (n: number) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

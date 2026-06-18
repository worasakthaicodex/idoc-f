/** ทะเบียนโมดูล — ดึงจาก backend (global catalog) แทน hardcode */
import { apiFetch } from "../../shared/api";

export type AppModule = { id: string; code: string; name: string; nameEn?: string };

export const listModules = () => apiFetch<AppModule[]>("/admin/modules");

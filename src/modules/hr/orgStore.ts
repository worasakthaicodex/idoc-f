/**
 * แผนก/ฝ่าย — เรียก backend จริง (tenant-scoped) ผ่าน /api/admin/divisions, /departments
 * code (DIV-/DEP-) ออกจากฝั่ง server แบบรันต่อบริษัท
 */
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";

export type OrgDivision = { id: string; code: string; name: string };
export type OrgDepartment = { id: string; code: string; name: string; division: string };

const tenant = () => getSession()?.companyId ?? "";

// ----- ฝ่าย (division) -----
export const listDivisions = () => apiFetch<OrgDivision[]>("/admin/divisions", { tenant: tenant() });
export const getDivision = (id: string) => apiFetch<OrgDivision>(`/admin/divisions/${id}`, { tenant: tenant() });
export const saveDivision = (name: string, id?: string) =>
  id
    ? apiFetch<OrgDivision>(`/admin/divisions/${id}`, { method: "PUT", tenant: tenant(), body: { name } })
    : apiFetch<OrgDivision>("/admin/divisions", { method: "POST", tenant: tenant(), body: { name } });
export const deleteDivision = (id: string) => apiFetch<void>(`/admin/divisions/${id}`, { method: "DELETE", tenant: tenant() });

// ----- แผนก (department) -----
export const listDepartments = () => apiFetch<OrgDepartment[]>("/admin/departments", { tenant: tenant() });
export const getDepartment = (id: string) => apiFetch<OrgDepartment>(`/admin/departments/${id}`, { tenant: tenant() });
export const saveDepartment = (name: string, division: string, id?: string) =>
  id
    ? apiFetch<OrgDepartment>(`/admin/departments/${id}`, { method: "PUT", tenant: tenant(), body: { name, division } })
    : apiFetch<OrgDepartment>("/admin/departments", { method: "POST", tenant: tenant(), body: { name, division } });
export const deleteDepartment = (id: string) => apiFetch<void>(`/admin/departments/${id}`, { method: "DELETE", tenant: tenant() });

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Undo, Plus, Edit, FileText } from "../../shared/icons";
import { isCrmAdmin } from "./crmAccess";
import "./customer.css";

type Rev = {
  id: string;
  revno: number;
  action: string;
  changedBy?: string;
  createdAt?: string;
  snapshot?: Record<string, unknown>;
};

/** แบนสแนปช็อตลูกค้าให้เป็นคู่ key/value แถวเดียว (name/groupName/status + attributes) */
function flat(snap?: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  if (!snap) return o;
  if (snap.name != null) o.name = String(snap.name);
  if (snap.groupName != null) o.groupName = String(snap.groupName);
  if (snap.status != null) o.status = String(snap.status);
  const a = snap.attributes;
  if (a && typeof a === "object") {
    for (const [k, v] of Object.entries(a as Record<string, unknown>)) o[k] = v == null ? "" : String(v);
  }
  return o;
}

/**
 * ประวัติ/เวอร์ชันของข้อมูลลูกค้า — ใครสร้าง/แก้ไข เมื่อไหร่
 * กดแต่ละเวอร์ชันเพื่อดูว่า "แก้อะไรไป" (ก่อน → หลัง) + ย้อนกลับเวอร์ชันได้
 * อ่านผ่าน /api/revisions (generic) · ย้อนกลับผ่าน /api/customers/{id}/revert/{revId}
 */
export default function CustomerHistoryPanel({ customerId, onReverted }: { customerId: string; onReverted?: () => void }) {
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const [list, setList] = useState<Rev[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  function reload() {
    if (!tenant || !customerId) return;
    apiFetch<Rev[]>(`/revisions?entityType=CUSTOMER&entityId=${customerId}`, { tenant })
      .then(setList).catch(() => setList([]));
  }
  useEffect(() => { reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [customerId, tenant]);

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "");
  const actionLabel = (a: string) => t(`custHistory.action.${a}`, { defaultValue: a });
  const ActionIcon = ({ a }: { a: string }) => (a === "CREATE" ? <Plus size={14} /> : a === "REVERT" ? <Undo size={14} /> : <Edit size={14} />);

  const labelOf = (k: string) =>
    k === "name" ? t("custFields.name", { defaultValue: "ชื่อ" })
    : k === "groupName" ? t("custFields.groupName", { defaultValue: "กลุ่ม" })
    : k === "status" ? t("custHistory.statusLabel")
    : t(`custFields.${k}`, { defaultValue: k });
  const showVal = (k: string, v: string) => (!v ? "" : k === "status" ? t(`custStatus.${v}`, { defaultValue: v }) : v);

  /** แถว diff ของเวอร์ชันที่ index i (เทียบกับเวอร์ชันก่อนหน้า = list[i+1] เพราะเรียงใหม่→เก่า) */
  function diffRows(i: number): { k: string; before: string; after: string }[] {
    const cur = flat(list[i].snapshot);
    const prev = i + 1 < list.length ? flat(list[i + 1].snapshot) : null;
    if (!prev) {
      return Object.keys(cur).filter((k) => cur[k]).map((k) => ({ k, before: "", after: cur[k] }));
    }
    const keys = Array.from(new Set([...Object.keys(cur), ...Object.keys(prev)]));
    return keys
      .filter((k) => String(prev[k] ?? "") !== String(cur[k] ?? ""))
      .map((k) => ({ k, before: prev[k] ?? "", after: cur[k] ?? "" }));
  }

  async function revert(id: string) {
    if (!window.confirm(t("custHistory.confirmRevert"))) return;
    const by = encodeURIComponent(session?.fullName || session?.companyCode || "");
    await apiFetch(`/customers/${customerId}/revert/${id}?by=${by}`, { method: "POST", tenant });
    reload();
    onReverted?.();
  }

  return (
    <div className="card">
      <div className="sh"><FileText size={15} />{t("custForm.tabHistory")}</div>
      <div className="crm-dl">
        {list.length === 0 ? (
          <div className="crm-row"><div className="dd muted">{t("custHistory.empty")}</div></div>
        ) : list.map((r, i) => {
          const open = openId === r.id;
          const rows = open ? diffRows(i) : [];
          const isOldest = i === list.length - 1;
          return (
            <div className="crm-row hist-row" key={r.id}>
              <div className="dt">{t("custHistory.rev", { n: r.revno })}</div>
              <div className="dd">
                <div className="hist-line">
                  <button type="button" className="hist-head" onClick={() => setOpenId(open ? null : r.id)}>
                    <span className="hist-act"><ActionIcon a={r.action} />{actionLabel(r.action)}</span>
                    {" · "}{t("custHistory.by")} {r.changedBy || "—"} · {fmt(r.createdAt)}
                  </button>
                  {i === 0
                    ? <span className="chip green" style={{ marginLeft: 8 }}>{t("custHistory.current")}</span>
                    : isCrmAdmin() && <button className="btn" style={{ marginLeft: 10, padding: "3px 10px" }} onClick={() => revert(r.id)}><Undo size={13} />{t("custHistory.revert")}</button>}
                  <button type="button" className="hist-toggle" onClick={() => setOpenId(open ? null : r.id)}>
                    {open ? t("custHistory.hide") : t("custHistory.view")}
                  </button>
                </div>
                {open && (
                  <div className="hist-diff">
                    {isOldest && <div className="hist-diff-cap">{t("custHistory.initial")}</div>}
                    {rows.length === 0 ? (
                      <div className="muted" style={{ fontSize: 13, padding: "4px 0" }}>{t("custHistory.noChange")}</div>
                    ) : (
                      <table className="hist-tbl">
                        <thead>
                          <tr>
                            <th>{t("custHistory.colField")}</th>
                            {!isOldest && <th>{t("custHistory.colBefore")}</th>}
                            <th>{t("custHistory.colAfter")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((d) => (
                            <tr key={d.k}>
                              <td className="hf">{labelOf(d.k)}</td>
                              {!isOldest && (
                                <td className="hb">{showVal(d.k, d.before) || <span className="muted">{t("custHistory.blank")}</span>}</td>
                              )}
                              <td className="ha">{showVal(d.k, d.after) || <span className="muted">{t("custHistory.blank")}</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import { getWorkboxByPosition, setWorkboxByPosition, WORKBOX_ROLES, type WorkboxMap } from "./salesWorkbox";
import "../customer/customer.css";

/** ตั้งค่ากล่องงาน — แต่ละกล่องให้ตำแหน่งไหนเห็นได้ (ไม่มี = เห็นตลอด) เลือกจากตำแหน่งใน DB */
export default function SalesWorkboxSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [positions, setPositions] = useState<string[]>([]);
  const [map, setMap] = useState<WorkboxMap>(() => getWorkboxByPosition());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    apiFetch<{ name: string }[]>("/admin/positions", { tenant })
      .then((ps) => setPositions(ps.map((p) => p.name).filter(Boolean)))
      .catch(() => setPositions([]));
  }, [tenant]);

  const addPos = (roleKey: string, pos: string) => {
    if (!pos) return;
    setMap((m) => { const cur = m[roleKey] ?? []; return cur.includes(pos) ? m : { ...m, [roleKey]: [...cur, pos] }; });
    setDirty(true);
  };
  const removePos = (roleKey: string, pos: string) => { setMap((m) => ({ ...m, [roleKey]: (m[roleKey] ?? []).filter((p) => p !== pos) })); setDirty(true); };
  const save = () => { setWorkboxByPosition(map); nav("/sales/settings"); };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "กล่องงานตามตำแหน่ง" : "Work box by position"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="settings" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/sales/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
          </div>

          <div className="crm-body">
            <div className="set-head">{th ? "กล่องงานที่แต่ละกล่องให้ตำแหน่งไหนเห็น" : "Which positions can see each work box"}</div>
            <div className="set-sub">{th ? "เพิ่มตำแหน่งที่เห็นกล่องนั้น (เลือกจากตำแหน่งในระบบ) — ถ้าไม่ใส่ตำแหน่งเลย กล่องนั้นจะเห็นตลอดทุกตำแหน่ง" : "Add positions that can see each box — leave empty = visible to everyone"}</div>

            {WORKBOX_ROLES.map((r) => {
              const assigned = map[r.key] ?? [];
              const avail = positions.filter((p) => !assigned.includes(p));
              return (
                <div key={r.key} className="card">
                  <div className="sh">✓ {th ? r.th : r.en}</div>
                  <div style={{ padding: "14px 16px" }}>
                    {assigned.length === 0 ? (
                      <div className="set-hint" style={{ marginBottom: 10 }}>{th ? "เห็นตลอด (ทุกตำแหน่ง)" : "Visible to everyone"}</div>
                    ) : (
                      <div className="opt-chips" style={{ marginBottom: 10 }}>
                        {assigned.map((p) => (
                          <span key={p} className="opt-chip" style={{ background: "#e7f0ff", borderColor: "var(--blue)", color: "var(--blue-d)" }}>{p}<button type="button" onClick={() => removePos(r.key, p)}>×</button></span>
                        ))}
                      </div>
                    )}
                    <select value="" onChange={(e) => { addPos(r.key, e.target.value); e.target.value = ""; }} style={{ maxWidth: 280 }} disabled={avail.length === 0}>
                      <option value="">{avail.length === 0 ? (th ? "— เพิ่มครบแล้ว —" : "— all added —") : (th ? "+ เพิ่มตำแหน่งที่เห็นกล่องนี้" : "+ add a position")}</option>
                      {avail.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
            {positions.length === 0 && <div className="set-hint" style={{ padding: "4px 2px" }}>{th ? "ยังไม่มีตำแหน่งในระบบ — เพิ่มที่ /hr/position/new ก่อน" : "No positions yet — add at /hr/position/new first"}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

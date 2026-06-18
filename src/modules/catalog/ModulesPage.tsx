import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../shared/api";
import { Grid, ChevronDown, Help, Plus, ArrowLeft, HomeIcon } from "../../shared/icons";

type Mod = { id: string; code: string; name: string; nameEn?: string; sortOrder: number; active: boolean };

export default function ModulesPage() {
  const nav = useNavigate();
  const [mods, setMods] = useState<Mod[]>([]);
  const [form, setForm] = useState({ name: "", nameEn: "", code: "" });
  const [error, setError] = useState("");

  const load = () =>
    apiFetch<Mod[]>("/admin/modules?all=true").then(setMods).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim()) return;
    setError("");
    try {
      await apiFetch("/admin/modules", { method: "POST", body: { name: form.name.trim(), nameEn: form.nameEn.trim() || null, code: form.code.trim() || null } });
      setForm({ name: "", nameEn: "", code: "" });
      load();
    } catch (e) { setError("เพิ่มไม่สำเร็จ: " + (e as Error).message); }
  }

  async function toggle(m: Mod) {
    await apiFetch(`/admin/modules/${m.id}`, { method: "PUT", body: { name: m.name, nameEn: m.nameEn ?? null, sortOrder: m.sortOrder, active: !m.active } });
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>ทะเบียนโมดูล</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div className="ic"><Help /></div>
        <div className="me">A</div>
      </div>

      <div className="subbar">
        <div style={{ fontSize: 13, color: "var(--txt2)", paddingLeft: 8 }}>โมดูลทั้งหมดของระบบ ({mods.length})</div>
        <div className="u-spacer" />
        <div className="fields" onClick={() => nav("/admin/companies")}><ArrowLeft size={16} />ทะเบียนบริษัท</div>
        <div className="vsep" />
        <div className="fields" onClick={() => nav("/app")}><HomeIcon size={16} />หน้าหลัก</div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "var(--bg)" }}>
        {error && <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}

        <div className="card" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13.5, borderBottom: "1px solid var(--line)" }}>เพิ่มโมดูลใหม่</div>
          <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, alignItems: "end", background: "#fafbfc", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="field-sm"><label>ชื่อโมดูล (ไทย) *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ผลิต" /></div>
            <div className="field-sm"><label>ชื่อ (อังกฤษ)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="e.g. Production" /></div>
            <div className="field-sm"><label>code (เว้นว่าง = ใช้ชื่อไทย)</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="auto" /></div>
            <div><button className="btn primary" onClick={add}><Plus size={15} />เพิ่มโมดูล</button></div>
          </div>

          <table className="data-grid">
            <thead><tr><th>ลำดับ</th><th>code</th><th>ชื่อ (ไทย)</th><th>ชื่อ (EN)</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {mods.length === 0 ? (
                <tr className="empty-row"><td colSpan={6} style={{ textAlign: "center", padding: 22, color: "var(--txt3)" }}>ยังไม่มีโมดูล</td></tr>
              ) : mods.map((m) => (
                <tr key={m.id}>
                  <td className="num">{m.sortOrder}</td>
                  <td className="docno">{m.code}</td>
                  <td>{m.name}</td>
                  <td className="muted" style={{ color: "var(--txt3)" }}>{m.nameEn || "—"}</td>
                  <td><span className={`chip ${m.active ? "green" : "red"}`}>{m.active ? "ใช้งาน" : "ปิด"}</span></td>
                  <td><button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => toggle(m)}>{m.active ? "ปิดใช้" : "เปิดใช้"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

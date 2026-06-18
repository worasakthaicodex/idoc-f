import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { depsFor, fetchAvailableModules } from "./moduleRegistry";

/**
 * แสดงในแถบ Documents — โมดูลที่เอกสาร/โมดูลนี้ "ต้องพึ่ง" + สถานะพร้อมใช้
 * เช่น CL (งานขาย) ต้องพึ่งโมดูลลูกค้า เพื่อรู้สถานะลูกค้า · ถ้าโมดูลนั้นไม่ได้เปิด/ซื้อ จะเตือน
 */
export default function ModuleDeps({ moduleKey, readOnly = false }: { moduleKey: string; readOnly?: boolean }) {
  const nav = useNavigate();
  const deps = depsFor(moduleKey);
  const [avail, setAvail] = useState<Set<string>>(new Set());
  useEffect(() => { fetchAvailableModules().then(setAvail); }, []);

  if (!deps.length) return null;
  return (
    <div className="dep-sec">
      <div className="dep-h">ต้องใช้โมดูล</div>
      {deps.map((d) => {
        const ok = avail.has(d.catalog);
        return (
          <div className={`dep-item${readOnly ? " ro" : ""}`} key={d.key} title={d.reason} onClick={readOnly ? undefined : () => nav(d.to)}>
            <span className="dep-nm">{d.label}</span>
            <span className={`chip ${ok ? "green" : "red"}`}>{ok ? "พร้อมใช้" : "ยังไม่เปิด"}</span>
          </div>
        );
      })}
    </div>
  );
}

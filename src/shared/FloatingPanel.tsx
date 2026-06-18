import { useRef, type ReactNode } from "react";
import { X } from "./icons";
import "./floatingPanel.css";

/**
 * กล่องลอยลากได้ — ใช้ดึงเนื้อหา (เช่นกลุ่มฟิลด์) ออกมาดูเทียบ
 * ลากที่หัวกล่อง (แก้ transform ตรง ๆ ผ่าน ref ไม่ re-render)
 */
export default function FloatingPanel({ title, onClose, children, initial }: {
  title: string; onClose: () => void; children: ReactNode; initial?: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const off = useRef<{ x: number; y: number }>({ x: initial?.x ?? 0, y: initial?.y ?? 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const apply = () => { if (ref.current) ref.current.style.transform = `translate(${off.current.x}px, ${off.current.y}px)`; };
  const onMove = (e: PointerEvent) => { if (!drag.current) return; off.current = { x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) }; apply(); };
  const onUp = () => { drag.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".floatp-x")) return;   // กดปุ่มปิด ไม่ใช่ลาก
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: off.current.x, oy: off.current.y };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };
  return (
    <div ref={ref} className="floatp" style={{ transform: `translate(${off.current.x}px, ${off.current.y}px)` }}>
      <div className="floatp-h" onPointerDown={onDown}>
        <span className="floatp-t">{title}</span>
        <button type="button" className="floatp-x" onClick={onClose} title="ปิด"><X size={14} /></button>
      </div>
      <div className="floatp-b">{children}</div>
    </div>
  );
}

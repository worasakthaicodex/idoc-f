import { useEffect, useRef, useState } from "react";

/**
 * ช่องที่อยู่แบบค้นหา — ค้นจากชุดข้อมูลที่อยู่ไทย (ต./อ./จ./รหัสไปรษณีย์) ที่ฝังมากับแอป
 * (นำเข้าจาก dataset_data refer=152) · โหลดแบบ lazy ครั้งเดียว แล้วค้นในเครื่อง (ออฟไลน์ เร็ว)
 */
let ADDR_CACHE: string[] | null = null;
let ADDR_LOADING: Promise<string[]> | null = null;
function loadAddresses(): Promise<string[]> {
  if (ADDR_CACHE) return Promise.resolve(ADDR_CACHE);
  if (!ADDR_LOADING) {
    ADDR_LOADING = import("../../shared/data/thaiAddresses.json")
      .then((m) => { ADDR_CACHE = (m.default as string[]) || []; return ADDR_CACHE; })
      .catch(() => { ADDR_CACHE = []; return ADDR_CACHE; });
  }
  return ADDR_LOADING;
}

const MAX_SHOW = 40;

export default function ThaiAddressInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [q, setQ] = useState(value);
  const [rows, setRows] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const all = useRef<string[] | null>(ADDR_CACHE);

  useEffect(() => setQ(value), [value]);
  useEffect(() => { loadAddresses().then((list) => { all.current = list; }); }, []);

  const search = (v: string): string[] => {
    const needle = v.trim().toLowerCase().replace(/\s+/g, " ");
    if (needle.length < 2 || !all.current) return [];
    const out: string[] = [];
    for (const a of all.current) {
      if (a.toLowerCase().includes(needle)) { out.push(a); if (out.length >= MAX_SHOW) break; }
    }
    return out;
  };

  function onType(v: string) {
    setQ(v); onChange(v); setOpen(true);
    // ถ้ายังโหลดชุดข้อมูลไม่เสร็จ ให้รอแล้วค่อยค้น
    if (!all.current) { loadAddresses().then((list) => { all.current = list; setRows(search(v)); }); return; }
    setRows(search(v));
  }

  function pick(s: string) { setQ(s); onChange(s); setOpen(false); }

  return (
    <div className="ta-box">
      <input value={q} placeholder={placeholder}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        name="thai-address-search" data-lpignore="true" data-form-type="other"
        onChange={(e) => onType(e.target.value)}
        onFocus={() => rows.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)} />
      {open && rows.length > 0 && (
        <div className="ta-menu">
          {rows.map((r, i) => (
            <div key={i} className="ta-item" onMouseDown={() => pick(r)}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

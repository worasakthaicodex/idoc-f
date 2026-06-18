/** กราฟใช้ร่วมของรายงานการขาย — แท่ง/เส้น (MultiChart) + วงกลม (Donut) · ไม่พึ่ง chart lib */
export const palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
export const num = (v?: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
export const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export type Series = { name: string; color: string; values: number[] };
export type Bar = { label: string; value: number; tone?: string };

/** กราฟแกนเวลาหลายชุด (แท่งกลุ่ม/เส้น) */
export function MultiChart({ periods, series, type, empty }: { periods: string[]; series: Series[]; type: "bar" | "line"; empty: string }) {
  if (periods.length === 0) return <div className="muted" style={{ padding: 12 }}>{empty}</div>;
  const n = periods.length;
  const W = Math.max(n * 64, 360), H = 230, padT = 14, padB = 30, padL = 12, padR = 12;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const slot = (W - padL - padR) / n;
  const cx = (i: number) => padL + slot * i + slot / 2;
  const base = H - padB;
  const cy = (v: number) => padT + (1 - v / max) * (base - padT);
  return (
    <>
      <div className="rp-legend-row" style={{ marginBottom: 6 }}>{series.map((s) => <span key={s.name} className="rp-leg-chip"><span className="rp-dot" style={{ background: s.color }} />{s.name}</span>)}</div>
      <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" style={{ width: "100%", height: "auto" }}>
        <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="var(--line, #ddd)" />
        {type === "line" && series.map((s, si) => (
          <g key={si}>
            <polyline points={periods.map((_, i) => `${cx(i)},${cy(s.values[i])}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} />
            {s.values.map((v, i) => <circle key={i} cx={cx(i)} cy={cy(v)} r={2.5} fill={s.color} />)}
          </g>
        ))}
        {type === "bar" && periods.map((_, i) => {
          const k = series.length, gw = Math.min(slot * 0.74, 48), bw = gw / k, x0 = cx(i) - gw / 2;
          return series.map((s, si) => { const v = s.values[i], h = base - cy(v); return <rect key={`${i}-${si}`} x={x0 + bw * si} y={cy(v)} width={Math.max(1, bw - 1)} height={Math.max(0, h)} fill={s.color} rx={1} />; });
        })}
        {periods.map((p, i) => <text key={i} x={cx(i)} y={H - 9} textAnchor="middle" fontSize={10.5} fill="var(--txt3, #888)">{p}</text>)}
      </svg>
    </>
  );
}

/** กราฟวงกลม (donut) + คำอธิบาย */
export function Donut({ items, unit }: { items: Bar[]; unit?: string }) {
  const sum = items.reduce((a, b) => a + b.value, 0);
  const size = 168, th = 30, r = (size - th) / 2, c = 2 * Math.PI * r, cc = size / 2;
  const col = (b: Bar, i: number) => b.tone ?? palette[i % palette.length];
  let acc = 0;
  return (
    <div className="rp-donut-wrap">
      <svg className="rp-donut" viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${cc} ${cc})`}>
          {sum === 0 ? <circle cx={cc} cy={cc} r={r} fill="none" stroke="var(--bg)" strokeWidth={th} />
            : items.map((b, i) => {
              const len = (c * b.value) / sum;
              const seg = <circle key={i} cx={cc} cy={cc} r={r} fill="none" stroke={col(b, i)} strokeWidth={th} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
              acc += len; return seg;
            })}
        </g>
        <text x={cc} y={cc - 2} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--txt)">{sum.toLocaleString()}</text>
        <text x={cc} y={cc + 17} textAnchor="middle" fontSize={11} fill="var(--txt3)">{unit || "รวม"}</text>
      </svg>
      <div className="rp-legend">
        {items.map((b, i) => (
          <div key={i} className="rp-leg">
            <span className="rp-dot" style={{ background: col(b, i) }} />
            <span className="rp-leg-lb">{b.label}</span>
            <span className="rp-leg-v">{b.value.toLocaleString()} · {sum ? Math.round((b.value / sum) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

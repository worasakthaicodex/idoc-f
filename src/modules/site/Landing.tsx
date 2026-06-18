import { useNavigate } from "react-router-dom";
import {
  Hexagon, ArrowRight, Check2, Box, Cart, Bag, Dollar, Users, BarChart, Shield,
} from "../../shared/icons";
import "./site.css";

const features = [
  { Icon: Cart, color: "#0f8a8a", title: "งานขาย", desc: "CL/FO/QT/SO ครบวงจร ติดตามทุกขั้นตอนการขาย" },
  { Icon: Box, color: "#1167a8", title: "คลังสินค้า", desc: "รับ-จ่าย โอนย้าย นับสต็อก เรียลไทม์" },
  { Icon: Bag, color: "#3a4a9c", title: "จัดซื้อ", desc: "ขอซื้อ สั่งซื้อ จัดการผู้ขายอย่างเป็นระบบ" },
  { Icon: Dollar, color: "#c47a14", title: "บัญชีและการเงิน", desc: "แยกประเภท รับ-จ่าย ออกงบอัตโนมัติ" },
  { Icon: Users, color: "#a83a5b", title: "บุคคล", desc: "พนักงาน เงินเดือน วันลา ครบในที่เดียว" },
  { Icon: BarChart, color: "#4a5763", title: "รายงานและวิเคราะห์", desc: "Dashboard และรายงานเชิงลึกแบบเรียลไทม์" },
];

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="p-site">
      {/* public nav */}
      <div className="pubnav">
        <div className="logo"><Hexagon size={26} className="li" />iDoc ERP</div>
        <div className="menu">
          <a>ฟีเจอร์</a><a>ความปลอดภัย</a><a>ราคา</a><a>ติดต่อเรา</a>
        </div>
        <div className="acts">
          <button className="btn btn-ghost" onClick={() => nav("/login")}>เข้าสู่ระบบ</button>
          <button className="btn primary" onClick={() => nav("/login")}>ทดลองใช้ฟรี</button>
        </div>
      </div>

      {/* hero */}
      <div className="lhero">
        <div className="htext">
          <h1>ระบบ ERP <span className="hl">สำหรับธุรกิจยุคใหม่</span> ครบ จบ ในที่เดียว</h1>
          <p>จัดการงานขาย คลังสินค้า จัดซื้อ บัญชี และบุคคล บนระบบเดียว รองรับหลายบริษัท แยกข้อมูลปลอดภัย เริ่มใช้งานได้ทันทีไม่ต้องติดตั้ง</p>
          <div className="hcta">
            <button className="btn primary btn-lg" onClick={() => nav("/login")}>เริ่มใช้งานฟรี<ArrowRight size={16} /></button>
            <button className="btn btn-ghost btn-lg" onClick={() => nav("/app")}>ดูตัวอย่างระบบ</button>
          </div>
          <div className="htrust"><Check2 size={15} />ไม่ต้องใช้บัตรเครดิต · ตั้งค่าเสร็จใน 5 นาที</div>
        </div>
        <div className="hmock">
          <div className="bar"><i /><i /><i /></div>
          <div className="screen">
            <div className="srow s1" />
            <div className="srow s2" />
            <div className="srow s3" />
            <div className="scards"><div className="c1" /><div className="c2" /><div className="c3" /></div>
          </div>
        </div>
      </div>

      {/* features */}
      <div className="lfeat">
        <div className="inner">
          <div className="eyebrow">ทุกระบบในที่เดียว</div>
          <h2>ครอบคลุมทุกงานในองค์กร</h2>
          <div className="sub">โมดูลทำงานเชื่อมกัน ลดงานซ้ำ เห็นภาพรวมธุรกิจทันที</div>
          <div className="lgrid">
            {features.map((f) => (
              <div className="fcard" key={f.title}>
                <div className="fi" style={{ background: f.color }}><f.Icon size={22} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* security band */}
      <div className="lband">
        <div>
          <div className="bi"><Shield size={26} /></div>
          <h2>หลายบริษัท แยกข้อมูลขาดจากกัน</h2>
          <p>ออกแบบมาเพื่อ Multi-tenant ตั้งแต่วันแรก แต่ละบริษัทเห็นเฉพาะข้อมูลของตัวเอง ป้องกันการรั่วไหลถึงระดับฐานข้อมูล</p>
          <ul>
            <li><Check2 size={16} />แยกข้อมูลด้วย tenant + Row-Level Security</li>
            <li><Check2 size={16} />Admin บริษัทกำหนด Role และสิทธิ์ได้เอง</li>
            <li><Check2 size={16} />เข้าสู่ระบบด้วย Google หรืออีเมล/รหัสผ่าน</li>
          </ul>
        </div>
        <div className="stats">
          <div className="stat"><div className="n">99.9%</div><div className="l">ความพร้อมใช้งาน</div></div>
          <div className="stat"><div className="n">5 นาที</div><div className="l">ตั้งค่าเริ่มต้น</div></div>
          <div className="stat"><div className="n">7+</div><div className="l">โมดูลพร้อมใช้</div></div>
          <div className="stat"><div className="n">∞</div><div className="l">จำนวนบริษัท</div></div>
        </div>
      </div>

      {/* CTA */}
      <div className="lcta">
        <h2>พร้อมเริ่มใช้งานแล้วหรือยัง?</h2>
        <p>ทดลองใช้ฟรี ไม่มีข้อผูกมัด</p>
        <button className="btn btn-lg" style={{ background: "#fff", color: "var(--blue-d)", fontWeight: 600 }} onClick={() => nav("/login")}>
          สมัครใช้งานฟรี<ArrowRight size={16} />
        </button>
      </div>

      {/* footer */}
      <div className="lfoot">
        <div className="inner">
          <div className="logo">iDoc ERP</div>
          <div className="links"><a>ฟีเจอร์</a><a>ราคา</a><a>เอกสาร</a><a>ติดต่อ</a><a>นโยบายความเป็นส่วนตัว</a></div>
          <div>© 2026 iDoc ERP</div>
        </div>
      </div>
    </div>
  );
}

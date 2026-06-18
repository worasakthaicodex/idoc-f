import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Grid, ChevronDown, Help, Hexagon, BarChart, Eye, Search,
  Filter, Sort, HomeIcon, Star, Clock, Box, Cart, Users, User, ArrowLeft, Building,
  FileText, Dollar, Calendar, Workflow,
} from "../../shared/icons";
import { isPlatformOwner, isCompanyOwner, getSession, clearSession } from "../../shared/session";
import { moduleLevel, MODULE } from "../../shared/access";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import "./home.css";

type Tile = { to: string; key: string; thumb: string; cat: string; mod: string; Icon: (p: { size?: number }) => React.JSX.Element };

/** เฉพาะระบบที่พร้อมใช้ (ซ่อน Inventory/Purchasing/Accounting/Documents ไว้ก่อน) · mod = รหัสโมดูลเช็คสิทธิ์ */
const TILES: Tile[] = [
  { to: "/sales", key: "sales", thumb: "t-teal", cat: "sales", mod: MODULE.SALES, Icon: Cart },
  { to: "/customer", key: "customer", thumb: "t-cyan", cat: "sales", mod: MODULE.CUSTOMER, Icon: User },
  { to: "/product", key: "products", thumb: "t-blue", cat: "product", mod: MODULE.PRODUCT, Icon: Box },
  { to: "/hr", key: "hr", thumb: "t-rose", cat: "hr", mod: MODULE.HR, Icon: Users },
  { to: "/accounting", key: "accounting", thumb: "t-amber", cat: "finance", mod: MODULE.ACCOUNTING, Icon: FileText },
  { to: "/finance", key: "finance", thumb: "t-slate", cat: "finance", mod: MODULE.FINANCE, Icon: Dollar },
  { to: "/pp", key: "pp", thumb: "t-indigo", cat: "production", mod: MODULE.PP, Icon: Calendar },
  { to: "/manufacturing", key: "manufacturing", thumb: "t-teal", cat: "production", mod: MODULE.MANUFACTURING, Icon: Workflow },
];
const CATS: { key: string; th: string; en: string }[] = [
  { key: "sales", th: "งานขาย & ลูกค้า", en: "Sales & Customer" },
  { key: "product", th: "สินค้าและบริการ", en: "Products & Services" },
  { key: "hr", th: "บุคคล", en: "HR" },
  { key: "finance", th: "บัญชีและการเงิน", en: "Accounting & Finance" },
  { key: "production", th: "การผลิต", en: "Manufacturing" },
];

const FAV_KEY = "idoc.home.favs";
const RECENT_KEY = "idoc.home.recent";
const loadFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; } };
const loadRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } };

export default function Home() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (a: string, b: string) => (th ? a : b);
  const owner = isPlatformOwner();
  const companyOwner = isCompanyOwner();
  const session = getSession();
  const logout = () => { clearSession(); nav("/login"); };

  const [view, setView] = useState<"all" | "fav" | "recent">("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");          // กรองตามประเภท ("" = ทั้งหมด)
  const [sort, setSort] = useState<"az" | "za">("az");
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const recent = loadRecent();
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenu]);

  const title = (k: string) => t(`home.tiles.${k}.title`);
  const desc = (k: string) => t(`home.tiles.${k}.desc`);
  const toggleFav = (k: string) => setFavs((f) => { const n = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; localStorage.setItem(FAV_KEY, JSON.stringify(n)); return n; });
  const touchRecent = (k: string) => { const n = [k, ...loadRecent().filter((x) => x !== k)].slice(0, 12); localStorage.setItem(RECENT_KEY, JSON.stringify(n)); };

  const list = useMemo(() => {
    // เห็นเฉพาะโมดูลที่มีสิทธิ์ (owner = ทุกโมดูล) — ไม่ใช่โชว์ทุกระบบ
    const allowed = TILES.filter((x) => moduleLevel(x.mod) != null);
    let base = allowed;
    if (view === "fav") base = allowed.filter((x) => favs.includes(x.key));
    else if (view === "recent") base = recent.map((k) => allowed.find((x) => x.key === k)).filter(Boolean) as Tile[];
    const ql = q.trim().toLowerCase();
    let out = base.filter((x) => (!cat || x.cat === cat) && (!ql || title(x.key).toLowerCase().includes(ql) || desc(x.key).toLowerCase().includes(ql)));
    if (view !== "recent") out = [...out].sort((a, b) => sort === "az" ? title(a.key).localeCompare(title(b.key), "th") : title(b.key).localeCompare(title(a.key), "th"));
    return out;
  }, [view, q, cat, sort, favs, recent]); // eslint-disable-line react-hooks/exhaustive-deps

  const tileNode = (tile: Tile) => (
    <Link key={tile.key} to={tile.to} className="tile" onClick={() => touchRecent(tile.key)}>
      <button type="button" className={`tile-star${favs.includes(tile.key) ? " on" : ""}`} title={L("รายการโปรด", "Favorite")}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(tile.key); }}><Star size={16} /></button>
      <div className={`thumb ${tile.thumb}`}><tile.Icon size={40} /></div>
      <div className="meta">
        <div className="kind">{CATS.find((c) => c.key === tile.cat)?.[th ? "th" : "en"]}</div>
        <div className="title">{title(tile.key)}</div>
        <div className="date">{desc(tile.key)}</div>
      </div>
    </Link>
  );

  const crumb = view === "fav" ? t("home.favorites") : view === "recent" ? t("home.recent") : t("home.allSystems");

  return (
    <div className="p-home">
      {/* top bar */}
      <div className="topbar">
        <div className="app">{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex" }}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("home.menu")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        {/* ผู้เข้าใช้ปัจจุบัน — เมนูดรอปดาวน์ (รวม logout) */}
        <div className="me-menu" ref={menuRef}>
          <div className="me-trigger" onClick={() => setUserMenu((o) => !o)} title={session?.fullName || session?.companyCode || ""}>
            <div className="me">{(session?.fullName || session?.companyCode || "A").charAt(0).toUpperCase()}</div>
            <ChevronDown size={14} className={`me-chev${userMenu ? " open" : ""}`} />
          </div>
          {userMenu && (
            <div className="me-dd">
              <div className="me-dd-head">
                <div className="me-dd-name">{session?.fullName || session?.email || "—"}</div>
                <div className="me-dd-sub">{owner ? L("เจ้าของระบบ", "Platform owner") : (session?.companyName || session?.companyCode || "")}</div>
              </div>
              <div className="me-dd-item danger" onClick={logout}><ArrowLeft size={15} />{t("common.logout")}</div>
            </div>
          )}
        </div>
      </div>

      {/* hero */}
      <div className="hero">
        <div className="brand">
          <Hexagon size={56} className="logo" />
          <div>
            <h1>{t("common.appName")}</h1>
            <div className="sub">{t("home.workspace")}</div>
            <div className="tag">{t("home.tagline")}</div>
          </div>
        </div>
        <div className="features">
          <div className="feature">
            <BarChart size={34} className="fi" />
            <h3>{t("home.reportsTitle")}</h3>
            <p>{t("home.reportsDesc")}</p>
          </div>
          {companyOwner && (
            <div className="feature" onClick={() => nav("/company")}>
              <Building size={34} className="fi" />
              <h3>{t("home.companyTitle", { defaultValue: "การจัดการบริษัท" })}</h3>
              <p>{t("home.companyDesc", { defaultValue: "ข้อมูลบริษัท โลโก้ พื้นที่จัดเก็บ และพิมพ์ข้อมูลเอกสาร" })}</p>
            </div>
          )}
          {owner && (
            <div className="feature" onClick={() => nav("/server")}>
              <Box size={34} className="fi" />
              <h3>{t("home.serverTitle", { defaultValue: "จัดการ server" })}</h3>
              <p>{t("home.serverDesc", { defaultValue: "ดูพื้นที่ Firebase ที่ใช้/เหลือ ทั้งระบบ กันเกินแพ็กเกจ" })}</p>
            </div>
          )}
          {owner && (
            <div className="feature" onClick={() => nav("/admin/companies")}>
              <Eye size={34} className="fi" />
              <h3>{t("home.adminTitle")}</h3>
              <p>{t("home.adminDesc")}</p>
            </div>
          )}
        </div>
      </div>

      {/* toolbar */}
      <div className="home-toolbar">
        <div className="home-search">
          <Search />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.searchPlaceholder")} />
        </div>
        <div className="u-spacer" />
        <label className="tool-action">
          <Filter size={16} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{L("ทุกประเภท", "All types")}</option>
            {CATS.map((c) => <option key={c.key} value={c.key}>{th ? c.th : c.en}</option>)}
          </select>
        </label>
        <div className="divider-v" />
        <label className="tool-action">
          <Sort size={16} />
          <select value={sort} onChange={(e) => setSort(e.target.value as "az" | "za")}>
            <option value="az">{L("ชื่อ ก–ฮ", "Name A–Z")}</option>
            <option value="za">{L("ชื่อ ฮ–ก", "Name Z–A")}</option>
          </select>
        </label>
      </div>

      {/* body */}
      <div className="body">
        <div className="sidebar">
          <div className={`nav-item${view === "all" ? " active" : ""}`} onClick={() => setView("all")}><HomeIcon size={17} />{t("home.allSystems")}</div>
          <div className={`nav-item${view === "fav" ? " active" : ""}`} onClick={() => setView("fav")}><Star size={17} />{t("home.favorites")}</div>
          <div className={`nav-item${view === "recent" ? " active" : ""}`} onClick={() => setView("recent")}><Clock size={17} />{t("home.recent")}</div>
        </div>

        <div className="home-content">
          <div className="crumb">{crumb} <span className="muted" style={{ fontWeight: 400 }}>· {list.length}</span></div>

          {list.length === 0 ? (
            <div className="home-empty">{view === "fav" ? L("ยังไม่มีรายการโปรด — กดดาวที่ระบบเพื่อปักหมุด", "No favorites yet — tap the star on a system") : view === "recent" ? L("ยังไม่มีระบบที่เพิ่งใช้", "No recently used systems") : L("ไม่พบระบบที่ค้นหา", "No systems match")}</div>
          ) : (
            <div className="tile-grid">{list.map(tileNode)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

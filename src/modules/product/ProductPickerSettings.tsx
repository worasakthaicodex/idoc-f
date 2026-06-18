import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Plus, X, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { prodLabel, groupLabelOf, CORE_KEYS, PROD_FIELDS } from "./productFields";
import {
  getEnabledFields, setEnabledFields,
  getColumns, setColumns, availableColumns, DEFAULT_COLUMNS, COL_SPECIAL,
  getSearchFields, setSearchFields, searchableUniverse, DEFAULT_SEARCH, SEARCH_SPECIAL,
} from "./productConfig";
import "../customer/customer.css";

type Kind = "fields" | "columns" | "search";

/** ตัวจัดฟิลด์แบบลากวาง — ใช้ร่วม 3 หน้า (ฟิลด์ที่ใช้ / มุมมองตาราง / ฟิลด์ค้น) */
export default function ProductPickerSettings({ kind }: { kind: Kind }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();

  const cfg = {
    fields: {
      title: lang.startsWith("th") ? "ฟิลด์ข้อมูลสินค้า/บริการ" : "Product fields",
      sub: lang.startsWith("th") ? "เลือก/จัดลำดับฟิลด์ที่บริษัทใช้" : "Choose and order fields",
      load: getEnabledFields, save: setEnabledFields,
      universe: () => PROD_FIELDS.map((f) => f.key), defaults: PROD_FIELDS.filter((f) => f.def || f.core).map((f) => f.key),
      special: [] as string[], core: CORE_KEYS,
    },
    columns: {
      title: lang.startsWith("th") ? "มุมมองตาราง (คอลัมน์)" : "Table view (columns)",
      sub: lang.startsWith("th") ? "เลือกว่าตารางจะโชว์คอลัมน์ไหน เรียงยังไง" : "Pick which columns the table shows",
      load: getColumns, save: setColumns, universe: availableColumns, defaults: DEFAULT_COLUMNS, special: COL_SPECIAL, core: [] as string[],
    },
    search: {
      title: lang.startsWith("th") ? "ตั้งค่าการค้นหา (เต็มพิกัด)" : "Search settings (advanced)",
      sub: lang.startsWith("th") ? "เลือกว่าฟิลด์ไหนใช้ค้นแบบเต็มพิกัดได้ (ค้นจริงที่ DB)" : "Choose searchable fields (real DB search)",
      load: getSearchFields, save: setSearchFields, universe: searchableUniverse, defaults: DEFAULT_SEARCH, special: SEARCH_SPECIAL, core: [] as string[],
    },
  }[kind];

  const [used, setUsed] = useState<string[]>(cfg.load());
  const [initial] = useState<string[]>(() => cfg.load());
  const dragKey = useRef<string | null>(null);
  const [overUsed, setOverUsed] = useState(false);
  const [overAvail, setOverAvail] = useState(false);

  const label = (k: string) => prodLabel(k, lang);
  const tag = (k: string) => {
    if (cfg.special.includes(k)) return lang.startsWith("th") ? "พิเศษ" : "Special";
    // หน้า "ฟิลด์" โชว์ว่าช่องนี้อยู่มุมมองอะไร (Basic/ขาย/จัดซื้อ/...)
    if (kind === "fields") return groupLabelOf(k, lang) || (lang.startsWith("th") ? "ฟิลด์" : "Field");
    return lang.startsWith("th") ? "ฟิลด์" : "Field";
  };
  const isCore = (k: string) => cfg.core.includes(k);

  const add = (k: string) => { if (!used.includes(k)) setUsed([...used, k]); };
  const remove = (k: string) => { if (!isCore(k)) setUsed(used.filter((x) => x !== k)); };
  const save = () => { cfg.save(used); nav("/product/settings"); };
  const dirty = used.length !== initial.length || used.some((k, i) => k !== initial[i]);

  const avail = cfg.universe().filter((k) => !used.includes(k));

  const start = (k: string) => () => { dragKey.current = k; };
  const dropOnUsed = (beforeKey?: string) => (e: React.DragEvent) => {
    e.preventDefault(); setOverUsed(false);
    const k = dragKey.current; dragKey.current = null;
    if (!k) return;
    const arr = used.filter((x) => x !== k);
    if (beforeKey && beforeKey !== k) { const i = arr.indexOf(beforeKey); arr.splice(i < 0 ? arr.length : i, 0, k); }
    else arr.push(k);
    setUsed(arr);
  };
  const dropOnAvail = (e: React.DragEvent) => {
    e.preventDefault(); setOverAvail(false);
    const k = dragKey.current; dragKey.current = null;
    if (k) remove(k);
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="settings" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/product/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
            <div style={{ marginLeft: "auto" }}>
              <div className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed([...cfg.defaults])}>{lang.startsWith("th") ? "ค่าเริ่มต้น" : "Defaults"}</div>
            </div>
          </div>

          <div className="crm-body">
            <div className="set-head">{cfg.title}</div>
            <div className="set-sub">{cfg.sub}</div>

            <div className="ff-cols">
              <div className={`ff-panel${overUsed ? " over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverUsed(true); }} onDragLeave={() => setOverUsed(false)} onDrop={dropOnUsed()}>
                <div className="ff-head">{lang.startsWith("th") ? "ที่เลือก" : "Selected"} <span className="ff-count">{used.length}</span></div>
                <div className="ff-list">
                  {used.map((k, i) => (
                    <div key={k} className="ff-item used" draggable onDragStart={start(k)} onDragOver={(e) => e.preventDefault()} onDrop={dropOnUsed(k)}>
                      <span className="ff-grip">⠿</span><span className="ff-no">{i + 1}</span>
                      <span className="ff-label">{label(k)}</span><span className="ff-tag">{tag(k)}</span>
                      {isCore(k) ? <span className="ff-core">core</span> : <button className="ff-act" onClick={() => remove(k)}><X size={13} /></button>}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`ff-panel${overAvail ? " over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverAvail(true); }} onDragLeave={() => setOverAvail(false)} onDrop={dropOnAvail}>
                <div className="ff-head">{lang.startsWith("th") ? "เลือกเพิ่มได้" : "Add more"} <span className="ff-count">{avail.length}</span></div>
                <div className="ff-list">
                  {avail.map((k) => (
                    <div key={k} className="ff-item" draggable onDragStart={start(k)}>
                      <span className="ff-label">{label(k)}</span><span className="ff-tag">{tag(k)}</span>
                      <button className="ff-act add" onClick={() => add(k)}><Plus size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

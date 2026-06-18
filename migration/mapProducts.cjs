const fs = require("fs");
const text = fs.readFileSync(__dirname + "/product_master.csv", "utf8");
function p(l){const o=[];let c="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'){if(l[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}else{if(ch===','){o.push(c);c="";}else if(ch==='"'){q=true;}else c+=ch;}}o.push(c);return o;}
const NULL = String.fromCharCode(92) + "N"; // backslash-N (SQL null marker)
const NV = (v) => { v = (v || "").trim(); return (v === "" || v === NULL) ? "" : v; };
const L = text.split(/\r?\n/).filter((x) => x.length);
const H = p(L[0]); const idx = (k) => H.indexOf(k);
const out = [];
for (let i = 1; i < L.length; i++) {
  const f = p(L[i]); if (f.length < 3) continue;
  const name = NV(f[idx("product_names")]); if (!name) continue;
  const attributes = {};
  const put = (k, v) => { v = NV(v); if (v) attributes[k] = v; };
  // product_type ระบบเก่า = "งานบริการ" → map เป็น materialType ที่ระบบใหม่รู้จัก = "บริการ" (ไม่งั้นถูกกรองออกตอนค้นในใบเสนอราคา)
  const pt = NV(f[idx("product_type")]);
  if (pt) attributes.materialType = pt.indexOf("บริการ") >= 0 ? "บริการ" : pt;
  put("description", f[idx("product_details")]);
  put("unit", f[idx("unit")]);
  put("dimensions", f[idx("product_dimensions")]);
  put("price", f[idx("product_selling_price")]);
  put("cost", f[idx("product_cost_price")]);
  attributes.legacyId = NV(f[idx("id")]) || String(i);
  const codePrefix = NV(f[idx("product_code")]);
  if (codePrefix) attributes.sku = codePrefix + "-" + attributes.legacyId;
  out.push({ name, groupName: NV(f[idx("product_category")]) || null, status: "ACTIVE", attributes });
}
fs.writeFileSync(__dirname + "/../src/modules/product/data/legacyProducts.json", JSON.stringify(out));
console.log("mapped:", out.length, "| with price:", out.filter((o) => o.attributes.price).length, "| groups:", new Set(out.map((o) => o.groupName)).size);
console.log("sample:", JSON.stringify(out[0]));

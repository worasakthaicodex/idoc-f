import { Box, FileText, BarChart, Mail } from "../../shared/icons";

export type ProdMenuItem = { key: string; Icon: typeof Box; enabled: boolean; to?: string; th: string; en: string };

export const productMenu: ProdMenuItem[] = [
  { key: "core", Icon: Box, enabled: true, to: "/product", th: "สินค้า / บริการ", en: "Products / Services" },
  { key: "requests", Icon: Mail, enabled: true, to: "/product/requests", th: "คำขอดำเนินการ", en: "Action requests" },
  { key: "bom", Icon: FileText, enabled: true, to: "/product/bom", th: "สูตรการผลิต (BOM)", en: "BOM" },
  { key: "bomRequests", Icon: Mail, enabled: true, to: "/product/bom/requests", th: "คำขอดำเนินการสูตรการผลิต (BOM)", en: "BOM action requests" },
  { key: "reports", Icon: BarChart, enabled: false, th: "รายงาน", en: "Reports" },
];

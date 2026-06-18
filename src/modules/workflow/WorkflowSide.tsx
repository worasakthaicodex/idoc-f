import CustomerSide from "../customer/CustomerSide";
import ProductSide from "../product/ProductSide";
import SalesSide from "../sales/SalesSide";
import AccountingSide from "../accounting/AccountingSide";

/** เมนูซ้ายของหน้า workflow = เมนูของโมดูลที่เข้ามา (ไฮไลต์ "ตั้งค่า") */
export default function WorkflowSide({ module }: { module: string }) {
  if (module === "product") return <ProductSide active="settings" />;
  if (module === "sales") return <SalesSide active="settings" />;
  if (module === "accounting") return <AccountingSide active="settings" />;
  return <CustomerSide active="settings" />;
}

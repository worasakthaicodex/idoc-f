import { Route } from "react-router-dom";
import ProductPage from "./ProductPage";
import ProductForm from "./ProductForm";
import ProductDetail from "./ProductDetail";
import ProductSettings from "./ProductSettings";
import ProductPickerSettings from "./ProductPickerSettings";
import ProductRequestList from "./ProductRequestList";
import ProductRequestForm from "./ProductRequestForm";
import ProductBomPage from "./ProductBomPage";
import ProductBomRequestList from "./ProductBomRequestList";
import ProductBomRequestForm from "./ProductBomRequestForm";

/** โมดูลสินค้าและบริการ — master data + สูตรการผลิต (BOM) */
export const productRoutes = [
  <Route key="product" path="/product" element={<ProductPage />} />,
  <Route key="product-new" path="/product/new" element={<ProductForm />} />,
  <Route key="product-bom" path="/product/bom" element={<ProductBomPage />} />,
  <Route key="product-bom-reqs" path="/product/bom/requests" element={<ProductBomRequestList />} />,
  <Route key="product-bom-req-new" path="/product/bom/requests/new" element={<ProductBomRequestForm />} />,
  <Route key="product-bom-req-edit" path="/product/bom/requests/:code" element={<ProductBomRequestForm />} />,
  <Route key="product-requests" path="/product/requests" element={<ProductRequestList />} />,
  <Route key="product-req-new" path="/product/requests/new" element={<ProductRequestForm />} />,
  <Route key="product-req-edit" path="/product/requests/:code" element={<ProductRequestForm />} />,
  <Route key="product-settings" path="/product/settings" element={<ProductSettings />} />,
  <Route key="product-settings-fields" path="/product/settings/fields" element={<ProductPickerSettings kind="fields" />} />,
  <Route key="product-settings-columns" path="/product/settings/columns" element={<ProductPickerSettings kind="columns" />} />,
  <Route key="product-settings-search" path="/product/settings/search" element={<ProductPickerSettings kind="search" />} />,
  <Route key="product-detail" path="/product/:id" element={<ProductDetail />} />,
  <Route key="product-edit" path="/product/:id/edit" element={<ProductForm />} />,
];

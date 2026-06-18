-- เร่ง query "เอกสารที่อ้างอิง CL นี้" (ผลดำเนินการ): นับ/รวมยอด FO/QT/SO ตาม src_cl
create index if not exists idx_sales_doc_srccl on sales_document (company_id, doc_type, src_cl);

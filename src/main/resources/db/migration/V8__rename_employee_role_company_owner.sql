-- สิทธิ์ในบริษัทเปลี่ยนชื่อให้ชัด: ADMIN (ผู้ดูแลบริษัท) → COMPANY_OWNER (เจ้าของบริษัท)
-- ระดับสิทธิ์รวม: PLATFORM_OWNER (platform_account) > COMPANY_OWNER > STAFF
update employee set role = 'COMPANY_OWNER' where role = 'ADMIN';

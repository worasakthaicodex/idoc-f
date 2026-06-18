-- เก็บ value เป็น JSON text (แปลงเองด้วย ObjectMapper) แทน jsonb เพื่อรองรับ Jackson 3
alter table tenant_setting alter column value drop default;
alter table tenant_setting alter column value type text using value::text;
alter table tenant_setting alter column value set default '';

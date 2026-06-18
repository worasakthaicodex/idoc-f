-- soft delete สำหรับ activity: เกิน 3 วันลบ = ขีดออก (VOID) รอนำออก 6 เดือน, ยกเลิกได้
alter table activity add column status varchar(10) not null default 'ACTIVE';
alter table activity add column voided_at timestamptz;

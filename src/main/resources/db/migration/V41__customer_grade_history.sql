-- ประวัติการ "ตัดเกรด" ลูกค้า (เตรียมไว้สำหรับระบบตัดเกรดรายเดือน)
-- ทุกครั้งที่ตัด: บันทึก 1 แถวต่อลูกค้า (เกรดเดิม -> เกรดใหม่) ในรอบนั้น
-- รายงาน "เกรดขึ้น/ลง" = เทียบรอบล่าสุด (old_grade vs new_grade)
create table customer_grade_history (
    id            uuid         primary key,
    company_id    uuid         not null,
    customer_code varchar(30)  not null,
    period        varchar(7)   not null,   -- รอบ (YYYY-MM ของวันเริ่มรอบ)
    cut_at        timestamptz  not null,
    old_grade     varchar(10),             -- NULL = ยังไม่เคยมีเกรด (NEW)
    new_grade     varchar(10),             -- NULL = ไม่มีเกรด (NONE)
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
create index idx_grade_hist_period on customer_grade_history (company_id, period);
create index idx_grade_hist_cust   on customer_grade_history (company_id, customer_code, cut_at desc);

-- Denormalize "วันติดต่อล่าสุด" ลง customer เพื่อให้คำนวณ "พร้อมใช้" ไม่ต้อง subquery บน activity ต่อแถว
-- (รองรับลูกค้าจำนวนมาก + concurrent สูง) · ดูแลค่าด้วย DB trigger จาก activity (เขียนน้อยกว่าอ่านมาก)
alter table customer
    add column last_comm_at timestamptz,
    add column last_call_at timestamptz;

-- backfill จากข้อมูลเดิม
update customer c set
    last_comm_at = (select max(a.occurred_at) from activity a
                    where a.company_id = c.company_id and a.customer_code = c.code
                      and a.status = 'ACTIVE' and a.kind = 'COMMUNICATION'),
    last_call_at = (select max(a.occurred_at) from activity a
                    where a.company_id = c.company_id and a.customer_code = c.code
                      and a.status = 'ACTIVE' and a.kind = 'CALL_RESULT');

-- trigger: ทุกครั้งที่ activity (COMMUNICATION/CALL_RESULT) เปลี่ยน → คำนวณใหม่เฉพาะลูกค้ารายนั้น (ใช้ index)
create or replace function trg_customer_last_contact() returns trigger as $$
declare
    cc text := coalesce(NEW.customer_code, OLD.customer_code);
    cid uuid := coalesce(NEW.company_id, OLD.company_id);
    k   text := coalesce(NEW.kind, OLD.kind);
begin
    if cc is null or k not in ('COMMUNICATION', 'CALL_RESULT') then
        return null;
    end if;
    update customer c set
        last_comm_at = (select max(a.occurred_at) from activity a
                        where a.company_id = cid and a.customer_code = cc
                          and a.status = 'ACTIVE' and a.kind = 'COMMUNICATION'),
        last_call_at = (select max(a.occurred_at) from activity a
                        where a.company_id = cid and a.customer_code = cc
                          and a.status = 'ACTIVE' and a.kind = 'CALL_RESULT')
    where c.company_id = cid and c.code = cc;
    return null;
end;
$$ language plpgsql;

create trigger activity_last_contact
    after insert or update or delete on activity
    for each row execute function trg_customer_last_contact();

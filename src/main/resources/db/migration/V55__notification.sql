-- แจ้งเตือนที่ "เขียนไว้" ตอนมีเหตุการณ์จริง (ส่งเอกสาร / ปิดการขายได้) ถึงผู้รับ
-- อ่านย้อนหลังได้แม้ตอนเกิดเหตุไม่ได้เปิดหน้าไว้ · ไม่ต้อง poll · realtime ผ่าน SSE ตอนเปิดหน้าอยู่
create table notification (
    id          uuid         primary key,
    company_id  uuid         not null,
    recipient   varchar(255) not null,          -- ผู้รับ (fullName/email/companyCode — ตรงกับ user ใน sent.recipients)
    kind        varchar(40)  not null,          -- ชนิด: docIncoming / dealWon / ...
    title       varchar(255) not null,
    body        varchar(500),
    ref_type    varchar(20),                    -- เอกสารอ้างอิง: CL / FO / QT / SO
    ref_code    varchar(40),
    by_user     varchar(255),                   -- ผู้ทำให้เกิดเหตุ (คนส่ง/คนปิด)
    read_at     timestamptz,                    -- null = ยังไม่อ่าน
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
-- ดึง "ของฉันที่ยังไม่อ่าน / ล่าสุด" เร็ว
create index idx_notification_recipient on notification (company_id, recipient, created_at desc);

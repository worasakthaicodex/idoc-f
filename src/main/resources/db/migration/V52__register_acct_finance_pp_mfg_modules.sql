-- แยกโมดูลรวม "บัญชีการเงิน" เดิม → "บัญชี" + "การเงิน" และลงทะเบียนโมดูลฝ่ายผลิต (PP, Manufacturing)
-- code = ชื่อไทย (ใช้เป็นค่าใน job_position.modules ให้เข้ากับระบบสิทธิ์เดิม) · name_en = ชื่ออังกฤษ
-- ปิดโมดูลรวมเดิม (เก็บแถวไว้กันอ้างอิงตำแหน่งเก่า แต่ไม่โชว์ในตัวเลือก /hr/position/new)
update app_module set active = false, updated_at = now() where code = 'บัญชีการเงิน';

insert into app_module (id, code, name, name_en, sort_order, active, created_at, updated_at) values
 (gen_random_uuid(), 'บัญชี',            'บัญชี',                    'Accounting',               10, true, now(), now()),
 (gen_random_uuid(), 'การเงิน',          'การเงิน',                  'Finance',                  11, true, now(), now()),
 (gen_random_uuid(), 'การวางแผนการผลิต', 'การวางแผนการผลิต (PP)',    'Production Planning (PP)',  12, true, now(), now()),
 (gen_random_uuid(), 'การผลิต',          'การผลิต (Manufacturing)',  'Manufacturing',            13, true, now(), now())
on conflict (code) do nothing;

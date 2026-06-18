# iDoc ERP — Backend Architecture (DDD / Modular Monolith)

เป้าหมาย: **เพิ่ม module ใหม่ได้โดยไม่กระทบของเดิม** ไม่ว่าจะเป็นคนหรือ AI หลายคนทำพร้อมกัน

## โครงสร้าง package

```
com.idoc
├── IdocApplication.java          ← main (อยู่ราก เพื่อ scan ทุก module)
├── shared/                       ← ของกลาง ใช้ได้ทุก module
│   ├── domain/    BaseEntity (id + audit)
│   ├── exception/ ResourceNotFoundException, BusinessException
│   ├── web/       ApiError, GlobalExceptionHandler
│   └── config/    SecurityConfig
└── modules/
    └── company/                  ← 1 module = 1 โฟลเดอร์ (self-contained)
        ├── api/          ← **สัญญาสาธารณะ** ให้ module อื่นเรียก (interface + view)
        ├── domain/       ← entity (rich behavior) + enum + repository (port)
        ├── application/  ← service (logic ทั้งหมด) + dto + mapper
        └── web/          ← controller (บาง ไม่มี logic)
```

## เลเยอร์ (บังคับ)

| เลเยอร์ | หน้าที่ | กฎ |
|---|---|---|
| `web` (Controller) | map HTTP ↔ DTO, delegate | **ห้ามมี business logic** |
| `application` (Service) | business logic, `@Transactional` | logic ทั้งหมดอยู่ที่นี่ |
| `domain` (Entity/Repository) | กฎทางธุรกิจในตัว entity + JPA | ไม่รู้จัก HTTP |
| `infrastructure` | (ถ้ามี) integration ภายนอก | — |

## กติกาการคุยข้าม module (loose coupling)

1. module หนึ่งจะเรียกอีก module ได้ **ผ่าน `api` package เท่านั้น** (interface เช่น `CompanyApi`)
2. **ห้าม** import `domain` / `application` / `web` ของ module อื่นโดยตรง
3. งานที่เป็น event/async ใช้ `ApplicationEventPublisher` (domain event) แทนการเรียกตรง

→ เพิ่ม/แก้/ลบ module ใด ไม่กระทบ module อื่น เพราะผูกกันแค่ผ่าน interface

## วิธีเพิ่ม module ใหม่ (เช่น `users`, `inventory`)

1. สร้างโฟลเดอร์ `com.idoc.modules.<name>/` ตามโครง `api / domain / application / web`
2. เขียน entity + repository (JPA) + service(+impl) + controller
3. เปิด API ให้ module อื่น (ถ้าต้องการ) ที่ `api/<Name>Api.java`
4. เพิ่ม Flyway migration ใหม่ `Vn__<desc>.sql` (เลขรันต่อ ห้ามแก้ของเก่า)
5. **ไม่ต้องแตะไฟล์ของ module อื่นเลย** — Spring scan ให้อัตโนมัติ (main อยู่ราก com.idoc)

## ข้อตกลงอื่น

- **schema จัดการด้วย Flyway เท่านั้น** (`ddl-auto: validate`) — ห้าม `update`
- entity id เป็น UUID, มี `created_at` / `updated_at` ผ่าน `BaseEntity`
- ตารางระดับแพลตฟอร์ม เช่น `company` (tenant registry) ไม่มี `tenant_id`
- ตารางข้อมูลธุรกิจ (ของแต่ละบริษัท) จะมี `tenant_id` + Row-Level Security (เพิ่มในเลเยอร์ถัดไป)
- REST path: `/api/admin/**` (หลังบ้าน) — ภายหลังแยก `/api/portal/**` (ลูกค้า) + ใส่ JWT

## โมดูลปัจจุบัน

| Module | สถานะ | endpoint |
|---|---|---|
| `company` | ✅ ทะเบียนบริษัทที่เช่า (tenant) | `/api/admin/companies` |
| `user` | ✅ พนักงาน/ผู้ใช้ในบริษัท + login | `/api/admin/employees`, `/api/auth/**` |
| `position` | ✅ ตำแหน่งงาน + สิทธิ์โมดูล | `/api/admin/positions` |
| `platform` | ✅ เจ้าของระบบ (platform owner) — ไม่ผูก tenant, login ด้วย Google | — (ใช้ผ่าน `/api/auth/google`) |

## สิทธิ์ผู้ใช้ (3 ระดับ)

| ระดับ | เก็บที่ | login |
|---|---|---|
| เจ้าของระบบ (PLATFORM_OWNER) | `platform_account` (โมดูล `platform`) | Google เท่านั้น |
| เจ้าของบริษัท (COMPANY_OWNER) | `employee.role` (tenant) | Google (ของจริง) |
| พนักงาน (STAFF) | `employee.role` (tenant) | อีเมล/รหัสผ่าน |

> หมายเหตุ: ของจริงบังคับ Google สำหรับ owner/company-owner — endpoint-level guard (JWT) เพิ่มในเลเยอร์ auth ถัดไป

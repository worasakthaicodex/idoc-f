# Deploy iDoc ERP ขึ้น Google (ฟรี) — Spring Boot + React

สถาปัตยกรรม (ฟรีล้วนสำหรับบัญชีใหม่):

| ส่วน | บริการ | ฟรี |
|------|--------|-----|
| Backend (Spring Boot) | **Cloud Run** | ✅ free tier (scale-to-zero) |
| Database (Postgres) | **Neon** | ✅ free tier |
| Frontend (React/Vite) | **Firebase Hosting** | ✅ Spark plan |
| ไฟล์แนบ | **Firebase Storage** | ✅ Spark plan |

> Frontend เรียก `/api/...` แบบ relative → Firebase Hosting จะ rewrite `/api/**` ไปที่ Cloud Run
> (same-origin → ไม่มีปัญหา CORS) ส่วนอื่น rewrite ไป `/index.html` (SPA)

แนะนำให้ทำผ่าน **Google Cloud Shell** (เปิดในเบราว์เซอร์ ไม่ต้องลง gcloud เอง):
https://console.cloud.google.com → ปุ่ม `>_` มุมขวาบน

---

## 0) เตรียมบัญชี
1. ล็อกอิน https://console.cloud.google.com (บัญชีใหม่ได้เครดิตทดลอง $300 / 90 วัน)
2. สร้างโปรเจกต์ใหม่ → จด **PROJECT_ID** (เช่น `idoc-erp`)
3. เปิด Billing ให้โปรเจกต์ (จำเป็นสำหรับ Cloud Run แต่จะไม่โดนเก็บเงินถ้าอยู่ในโควตาฟรี)

```bash
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

---

## 1) ฐานข้อมูล — Neon (ฟรี)
1. สมัคร https://neon.tech → New Project (เลือก region ใกล้ไทย เช่น Singapore)
2. หน้า **Connection Details** → เลือกรูปแบบ **Java / JDBC** จะได้ค่า:
   - host: `ep-xxxx.ap-southeast-1.aws.neon.tech`
   - database, user, password
3. แปลงเป็นค่าที่แอปใช้ (เก็บไว้ใช้ขั้นตอนถัดไป):

```
DB_URL=jdbc:postgresql://ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
DB_USERNAME=<neon user>
DB_PASSWORD=<neon password>
```

> Flyway จะสร้างตาราง + รัน migration V1..V47 ให้อัตโนมัติตอน backend boot ครั้งแรก

---

## 2) Backend → Cloud Run
อยู่ในโฟลเดอร์ `idoc` (มี `Dockerfile` แล้ว) แล้วสั่ง deploy จาก source ได้เลย
(Cloud Build จะ build จาก Dockerfile → push → deploy ให้):

```bash
cd idoc
gcloud run deploy idoc-api \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 512Mi --cpu 1 \
  --set-env-vars "DB_URL=jdbc:postgresql://ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require,DB_USERNAME=NEON_USER,DB_PASSWORD=NEON_PASS,STORAGE_PROVIDER=dev"
```

gcloud run deploy idoc-api --source . --region asia-southeast1 --project idoc-3299c --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 1 --max-instances 3 --set-env-vars "DB_URL=jdbc:postgresql://ep-broad-boat-aodifyb8-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require,DB_USERNAME=neondb_owner,DB_PASSWORD=npg_BbszauT51CeA,STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=idoc-3299c.firebasestorage.app"

gcloud run services update idoc-api --region asia-southeast1 --project idoc-3299c --memory=1Gi --min-instances=1 --max-instances=3 --quiet 2>&1


gcloud run deploy idoc-api --source . --region asia-southeast1 --project idoc-3299c --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 1 --max-instances 3 --set-env-vars "DB_URL=jdbc:postgresql://45.77.245.101:5432/idoc_db?sslmode=disable,DB_USERNAME=postgres,DB_PASSWORD=idoc,STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=idoc-3299c.firebasestorage.app"


gcloud run deploy idoc-api --source . --region asia-southeast1 --project idoc-3299c --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 1 --max-instances 3 --set-env-vars "DB_URL=jdbc:postgresql://45.77.245.101:5432/idoc_db?sslmode=disable,DB_USERNAME=postgres,DB_PASSWORD=idoc,STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=idoc-3299c.firebasestorage.app,SPRING_FLYWAY_ENABLED=false,JAVA_TOOL_OPTIONS=-Xms256m -Xmx512m"



https://idoc-3299c.web.app/sales/print/qt/QT202606-57
- ตอบ `y` เมื่อถามสร้าง Artifact Registry
- เสร็จแล้วได้ URL เช่น `https://idoc-api-xxxxxx-as.a.run.app` → ลองเปิด `…/actuator/health` ควรได้ `{"status":"UP"}`

> **ชื่อ service ต้องเป็น `idoc-api` และ region `asia-southeast1`** ให้ตรงกับ `firebase.json`
> (ถ้าใช้ชื่อ/region อื่น ให้แก้ `idoc-web/firebase.json` ตาม)

---

## 3) Frontend → Firebase Hosting
1. ผูกโปรเจกต์ Firebase กับ GCP project เดิม: https://console.firebase.google.com → Add project → เลือก PROJECT_ID
2. แก้ `idoc-web/.firebaserc` ใส่ PROJECT_ID จริง
3. Build + deploy:

```bash
npm i -g firebase-tools
firebase login            # (ใน Cloud Shell ใช้ firebase login --no-localhost)
cd idoc-web
npm ci
npm run build             # ได้โฟลเดอร์ dist/
firebase deploy --only hosting
```

เสร็จแล้วได้ URL `https://PROJECT_ID.web.app` — เปิดใช้งานได้เลย
(`/api/**` จะวิ่งไป Cloud Run อัตโนมัติตาม rewrite)

---

## 4) (เลือกทำ) เก็บไฟล์แนบจริงด้วย Firebase Storage
ค่าเริ่มต้นด้านบนตั้ง `STORAGE_PROVIDER=dev` (เก็บไฟล์ใน container ชั่วคราว — หายเมื่อ restart)
ถ้าต้องการเก็บไฟล์จริง:

1. เปิด Firebase Storage ในคอนโซล → จด bucket (เช่น `PROJECT_ID.appspot.com`)
2. ให้ service account ของ Cloud Run เข้าถึง bucket ได้ (แอปใช้ ADC อัตโนมัติ ไม่ต้องแนบ key):

```bash
PROJNUM=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:${PROJNUM}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

3. อัปเดต env ของ Cloud Run:

```bash
gcloud run services update idoc-api --region asia-southeast1 \
  --update-env-vars "STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=PROJECT_ID.appspot.com"
```

---

## อัปเดตเวอร์ชันใหม่ภายหลัง
- Backend: `cd idoc && gcloud run deploy idoc-api --source . --region asia-southeast1`
- Frontend: `cd idoc-web && npm run build && firebase deploy --only hosting`
npm run build && echo "---DEPLOY---" && firebase deploy --only hosting

gcloud run deploy idoc-api --source . --region asia-southeast1 --project idoc-3299c --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 1 --max-instances 10 --set-env-vars "DB_URL=jdbc:postgresql://ep-broad-boat-aodifyb8-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require,DB_USERNAME=neondb_owner,DB_PASSWORD=npg_BbszauT51CeA,STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=idoc-3299c.firebasestorage.app"


## หมายเหตุ / ข้อควรรู้
- Cloud Run scale-to-zero → คำขอแรกหลังพัก backend จะช้า ~7 วิ (cold start) ถือว่าปกติสำหรับ free
- Neon free จะ "sleep" เมื่อไม่ใช้งานนาน → คำขอแรกอาจช้าเล็กน้อยเช่นกัน
- ค่าทุกอย่างอ่านจาก env (`application.yml`) — ไม่มีรหัสผ่าน hard-code ในโค้ด
- อยู่ในโควตาฟรีของทั้ง 3 บริการสำหรับการใช้งานสาธิต/ทีมเล็ก


npm run build && echo "---DEPLOY---" && firebase deploy --only hosting


f528d314-d2c2-4a49-9293-8dcfd914afec
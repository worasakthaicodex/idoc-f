#!/usr/bin/env sh
# Deploy iDoc backend -> prod (Cloud Run, project idoc-3299c)
# คำสั่ง deploy "มาตรฐาน" — ใส่ config ครบทุกครั้ง เพื่อไม่ให้ memory/scale/storage รีเซ็ตกลับค่า default
#   - memory 1Gi (กัน OOM ตอนอัพรูป), warm 1 instance, scale ได้ถึง 3
#   - STORAGE_PROVIDER=firebase + bucket (กันอัพรูปไม่ขึ้นเพราะ provider กลับเป็น dev)
#   - --update-env-vars = ผสานกับ env เดิม (DB_URL/DB creds ฯลฯ ไม่ถูกล้าง)
set -e
gcloud run deploy idoc-api --source . \
  --region asia-southeast1 --project idoc-3299c \
  --memory=1Gi --cpu=1 --min-instances=1 --max-instances=3 \
  --update-env-vars STORAGE_PROVIDER=firebase,FIREBASE_BUCKET=idoc-3299c.firebasestorage.app \
  "$@"

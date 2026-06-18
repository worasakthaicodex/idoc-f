import { getSession } from "./session";
import { refreshServerNotifs } from "../modules/inbox/notifStore";

/**
 * แจ้งเตือน realtime ผ่าน SSE — เวอร์ชันอัปเกรดโล่ป้องกัน Reconnect Storm
 */
let es: EventSource | null = null;
let reconnectTimeout: any = null; // 🎯 1. เพิ่มตัวแปรสำหรับเคลียร์คิวหน่วงเวลา

export function startLiveEvents(): void {
  const s = getSession();
  const company = s?.companyId;
  const user = s?.fullName || s?.email || s?.companyCode || "";
  if (!company || !user) return;

  stopLiveEvents();

  // เคลียร์คิวหน่วงเวลาตัวเก่าทิ้ง (ถ้ามี)
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  es = new EventSource(`/api/events?company=${encodeURIComponent(company)}&user=${encodeURIComponent(user)}`);
  
  const onEvent = () => { refreshServerNotifs().catch(() => {}); };   
  es.addEventListener("notify", onEvent);
  es.addEventListener("doc-incoming", onEvent);   

  // 🎯 2. 🔥 ไม้ตายสยบปืนกลระเบิดหลังบ้านตอนสายหลุด หรือติด 503
  es.onerror = () => {
    console.warn("🚨 [SSE Error] ท่อสัญญาณขาดหรือเจอ 503 — สั่งคูลดาวน์ระบบด่วน!");
    
    // สั่งปิดท่อตัวปัจจุบันทิ้งทันที เพื่อเตะสกัดขาห้ามบราวเซอร์สาด Auto-Retry ทุกๆ 3 วินาที
    stopLiveEvents();


  };
}

export function stopLiveEvents(): void {
  if (es) { 
    es.close(); 
    es = null; 
  }
  // 🎯 3. อย่าลืมล้างคิวหน่วงเวลาตอนสั่งปิดแอปด้วยครับเดฟ
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}
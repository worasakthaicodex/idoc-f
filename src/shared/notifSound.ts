/**
 * เสียงแจ้งเตือน + แจ้งเตือนระดับ OS — แก้ปัญหา "เสียงโดนบล็อค" จากนโยบาย autoplay ของเบราว์เซอร์
 *
 * วิธีแก้: ใช้ Web Audio API สร้างเสียง "ติ๊ง" เอง (ไม่ต้องมีไฟล์เสียง) แล้ว "ปลดล็อก" AudioContext
 * ด้วยการแตะ/กดปุ่มครั้งแรกของผู้ใช้ (gesture) — หลังจากนั้นเล่นเสียงได้โดยไม่ถูกบล็อกอีก
 * ถ้าแท็บอยู่เบื้องหลัง จะเด้ง OS notification ด้วย (ถ้าผู้ใช้อนุญาต) เพื่อให้เห็นแม้ไม่ได้โฟกัสแท็บ
 */
let ctx: AudioContext | null = null;
let armed = false;

function ensureCtx(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) { try { ctx = new AC(); } catch { ctx = null; } }
  }
  return ctx;
}

/** เรียกครั้งเดียวตอนเริ่มแอป — ดักการแตะ/กดครั้งแรกเพื่อปลดล็อกเสียง + ขออนุญาต OS notification */
export function armNotifSound(): void {
  if (armed) return;
  armed = true;
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    } catch { /* ignore */ }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** เล่นเสียงแจ้งเตือนสั้น ๆ (ติ๊ง-ติ๊ง) */
export function playNotifSound(): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const beep = (freq: number, start: number, dur: number) => {
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine";
      o.frequency.value = freq;
      const t0 = c.currentTime + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  };
  beep(880, 0, 0.33);
  beep(1170, 0.18, 0.34);
}

/** เด้ง OS notification (เฉพาะตอนแท็บอยู่เบื้องหลัง + ผู้ใช้อนุญาตแล้ว) */
export function notifyOS(title: string, body?: string): void {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!document.hidden) return; // โฟกัสแท็บอยู่แล้ว ใช้เสียง/กระดิ่งในแอปพอ
    new Notification(title, { body, tag: "idoc-notif" });
  } catch { /* ignore */ }
}

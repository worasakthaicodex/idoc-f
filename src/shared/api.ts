import { getSession, clearSession } from "./session";
export type Page<T> = { content: T[]; totalElements: number; totalPages: number; number: number };

type Options = { method?: string; body?: unknown; tenant?: string; headers?: Record<string, string> };

function b64utf8(s: string): string {
  try { return btoa(String.fromCharCode(...new TextEncoder().encode(s))); } catch { return ""; }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// 🎯 คลังเก็บ Request ที่กำลังทำงานอยู่ (กันยิงซ้ำในมิลลิวินาทีเดียวกัน)
const pendingRequests = new Map<string, Promise<any>>();

// 🎯 🔥 ถังแคชใน RAM สยบวิญญาณปืนกลสาดดึงพนักงาน 300 คนข้ามหน้าข้ามตา
const employeesCache = {
  data: null as any,
  fetchedAt: 0
};

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const isGet = method === "GET";

  // 🔥 1. ดักสกัดกั้นขาปืนกลดึงพนักงาน 300 คน: ถ้ายิงมาและในแรมมีอยู่แล้ว (ไม่เกิน 5 นาที) ตัดหน้าคืนค่าในแรมไปเลย!
  if (isGet && path.includes("employees?size=300")) {
    const now = Date.now();
    if (employeesCache.data && (now - employeesCache.fetchedAt < 86400000)) { // 24ชม
      console.log("📦 [RAM Cache Hit] ส่งข้อมูลพนักงาน 300 คนจากแรมให้ทันที ไม่ยอมหลุดไปกวน GCP แน่นอนเดฟ!");
      return employeesCache.data as T;
    }
  }

  // 🎯 สร้าง Key ประจำตัวของ Request (รวบเฉพาะ GET เท่านั้น)
  const requestKey = isGet ? path : null;

  // 🎯 ถ้ามีคนกำลังขอข้อมูล URL นี้อยู่แล้ว ให้คืนค่า Promise ตัวเดิมกลับไปเลย (In-flight request deduplication)
  if (requestKey && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  // 📸 กล้องวงจรปิดดักจับประวัติการสาดกระสุนปืนกลของเดฟ (คงไว้ครบถ้วน)
  if (isGet && path.includes("docType=FO") && window.location.pathname.includes("/sales/qt")) {
    console.error(`🚨เจอตัวฆาตกรแล้ว! มีคนสั่งยิง FO ในหน้า QT -> Path: ${path}`);
    console.trace();
  }

  if (isGet && path.includes("company-modules")) {
    console.error(`🚨 เจอตัวการยิงปืนกลแล้ว! เส้น company-modules โดนยิง -> Path: ${path}`);
    console.trace();
  }

  if (isGet) {
    const targetPaths = ["/notifications", "/settings", "/events"];
    const isSuspect = targetPaths.some((p) => path.includes(p));
    if (isSuspect) {
      console.error(`🚨 จับได้ไล่ทันแล้วเดฟ! มีการยิงปืนกลไม่หยุด -> Path: ${path}`);
      console.trace();
    }
  }

  // 🎯 ประกอบชิ้นส่วน Header
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.tenant) headers["X-Company-Id"] = opts.tenant;
  
  const s = getSession();
  if (s?.role) headers["X-User-Role"] = s.role;
  if (s?.modules && Object.keys(s.modules).length) headers["X-User-Modules"] = b64utf8(JSON.stringify(s.modules));
  if (opts.headers) Object.assign(headers, opts.headers);

  // 🎯 ห่อหุ้มกลไก Fetch
  const fetchPromise = (async () => {
    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });

    // 🎯 เช็กว่าคิวรี่นี้เกี่ยวกับท่อ Login/Auth หรือไม่
    const isAuthPath = path.includes("login") || path.includes("auth");

    // 🎯 🔥 โล่ชิ้นสำคัญ: ถ้าบราวเซอร์เปิดหน้าระบบอยู่ที่หน้า Login อยู่แล้ว ห้ามสั่งดีดหน้าจอซ้ำเด็ดขาด!
    const isAlreadyAtLogin = window.location.pathname.includes("/login");

    // 🔥 ดักจับเซสชันหมดอายุ (401/403/409) + ไม่ใช่เส้นล็อกอิน + และต้องไม่อยู่หน้าล็อกอินอยู่แล้วด้วย!
    if ((res.status === 401 || res.status === 403 || res.status === 409) && !isAuthPath && !isAlreadyAtLogin) {
      console.warn("🔒 [Session Expired] เซสชันหลุดหรือตั๋วหมดอายุ! กำลังดีดไปหน้า Login...");

      clearSession();   // ⚠️ ต้องล้าง key จริง "idoc.session" (เดิมลบ "session" ผิด key → session ค้าง ไม่ถูกเคลียร์)
      sessionStorage.clear();

      window.location.href = "/login";
      
      return new Promise<T>(() => {}); 
    }

    // -------------------------------------------------------------
    // 🔍 โดมิโนโค้ดเดิมตรวจเช็ก Error ของเดฟ
    // -------------------------------------------------------------
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const e = await res.json();
        if (e?.message) msg = e.message;
        if (e?.code) code = e.code;
      } catch {
        /* ignore */
      }
      throw new ApiError(msg, res.status, code);
    }
    if (res.status === 204) return undefined as T;
    
    const text = await res.text();
    const parsedData = text ? JSON.parse(text) : undefined;

    // 🎯 ตักปลาใส่ตู้แคช: ถ้ายิงดึงพนักงานสำเร็จรอบแรก ฝังข้อมูลใส่ RAM ทันที
    if (isGet && path.includes("employees?size=300") && parsedData) {
      employeesCache.data = parsedData;
      employeesCache.fetchedAt = Date.now();
    }

    return parsedData as T;
  })();

  // 🎯 เก็บลงประวัติ In-flight เพื่อยุติปัญหายิงเบิ้ลพร้อมกัน
  if (requestKey) {
    pendingRequests.set(requestKey, fetchPromise);
    fetchPromise.finally(() => {
      pendingRequests.delete(requestKey);
    });
  }

  return fetchPromise;
}
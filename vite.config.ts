import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PORT env (Node) — ประกาศเองเพราะไม่ได้ลง @types/node
declare const process: { env: Record<string, string | undefined> }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5174,   // PORT env ใช้ตอน preview tool เปิดอินสแตนซ์ที่สอง
    // proxy /api -> Spring Boot (เลี่ยง CORS ตอน dev)
    // local backend (Docker pg :5433) สำหรับเทสในเครื่อง · prod = https://idoc-api-786236226767.asia-southeast1.run.app
    proxy: {
      "/api": { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})

package com.idoc.modules.customer.application;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;

/**
 * เกณฑ์การตัดเกรดลูกค้า (sync กับฝั่ง frontend: settings key "crm.grade.config")
 * ฟิลด์ตรงกับ customerGradeConfig.ts — windowYears/aMin/bMin/cMin/cutMonths/lastCutAt
 */
public record GradeConfig(int windowYears, int aMin, int bMin, int cMin, int cutMonths, Long lastCutAt) {

    public static final String KEY = "crm.grade.config";

    public static GradeConfig from(Map<String, Object> m) {
        return new GradeConfig(
                intOf(m, "windowYears", 3),
                intOf(m, "aMin", 3),
                intOf(m, "bMin", 2),
                intOf(m, "cMin", 1),
                intOf(m, "cutMonths", 12),
                m.get("lastCutAt") instanceof Number n ? n.longValue() : null);
    }

    private static int intOf(Map<String, Object> m, String k, int def) {
        return m.get(k) instanceof Number n ? n.intValue() : def;
    }

    /** ถึงรอบตัดเกรดแล้วหรือยัง (ยังไม่เคยตัด = ตัดรอบแรกเลย) */
    public boolean isDue() {
        if (lastCutAt == null) return true;
        Instant due = Instant.ofEpochMilli(lastCutAt)
                .atZone(ZoneId.systemDefault())
                .plusMonths(Math.max(1, cutMonths))
                .toInstant();
        return !Instant.now().isBefore(due);
    }

    /** เกรดจากจำนวนครั้งที่เปิด SO ในช่วง + เคยติดต่อไหม */
    public String gradeOf(java.util.List<Long> soDatesMs, boolean contacted) {
        if (soDatesMs != null && !soDatesMs.isEmpty()) {
            long winMs = (long) (windowYears * 365.25d * 86_400_000d);
            long cutoff = System.currentTimeMillis() - winMs;
            long inWin = soDatesMs.stream().filter(d -> d != null && d >= cutoff).count();
            if (inWin >= aMin) return "A";
            if (inWin >= bMin) return "B";
            if (inWin >= cMin) return "C";
            return "D"; // เคยมี SO แต่ไม่มีในช่วง
        }
        return contacted ? "NONE" : "NEW";
    }
}

package com.idoc.modules.customer.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.idoc.modules.customer.domain.CustomerReportRepository;
import com.idoc.shared.tenant.TenantContext;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** รายงานลูกค้า — เรียลไทม์ (ติดต่อ/ครบถ้วน/เกรด) + ไม่เรียลไทม์ (เพิ่ม/แก้ จาก revision) */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomerReportService {

    private final CustomerReportRepository repo;
    private final CustomerInsightCache insightCache;   // cache รายงาน (ล้างเมื่อข้อมูลกระทบยอดเปลี่ยน)
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record Distribution(long b0, long b1, long b2, long b3plus) {}
    public record Completeness(long complete, long noPhone, long noGroup, long noBoth) {}
    public record Member(String code, String name, String c1, String c2) {}
    public record GradeCount(String grade, long count) {}
    public record StatusCount(String status, long count) {}
    public record BucketCount(int bucket, long count) {}
    public record CompletenessPct(long total, int avg, List<BucketCount> buckets) {}
    public record GradeMovement(String period, long total, long up, long down, long same,
                                long newlyGraded, long droppedToNone, List<GradeCount> dist) {}
    /** เหตุการณ์เพิ่ม/แก้ไข 1 ครั้ง · fields = ฟิลด์ที่เปลี่ยน (ว่าง = สร้างใหม่) */
    public record RevisionEvent(String action, String code, String changedBy, Instant at, List<String> fields) {}

    public Distribution contactDistribution(boolean gradeAbc) {
        return insightCache.get("contactDistribution", String.valueOf(gradeAbc), () -> {
            long[] b = repo.contactDistribution(TenantContext.required(), gradeAbc);
            return new Distribution(b[0], b[1], b[2], b[3]);
        });
    }

    public List<Member> contactMembers(int bucket, boolean gradeAbc, int limit) {
        return repo.contactMembers(TenantContext.required(), bucket, gradeAbc, limit).stream()
                .map(r -> new Member((String) r[0], (String) r[1], (String) r[2], String.valueOf(num(r[3]))))
                .toList();
    }

    public Completeness completeness() {
        return insightCache.get("completeness", "", () -> {
            long[] b = repo.completeness(TenantContext.required());
            return new Completeness(b[0], b[1], b[2], b[3]);
        });
    }

    public List<Member> completenessMembers(String kind, int limit) {
        return repo.completenessMembers(TenantContext.required(), kind, limit).stream()
                .map(r -> new Member((String) r[0], (String) r[1], (String) r[2], (String) r[3]))
                .toList();
    }

    /** ความครบถ้วนเป็น % ของฟิลด์ที่เปิดใช้ — นับที่ DB (ส่งรายชื่อฟิลด์มาจากหน้า ตาม field config) */
    @SuppressWarnings("unchecked")
    public CompletenessPct completenessPct(List<String> fields) {
        return insightCache.get("completenessPct", fields == null ? "" : String.join(",", fields), () -> {
            Object[] r = repo.completenessPct(TenantContext.required(), fields);
            List<BucketCount> buckets = ((List<Object[]>) r[2]).stream()
                    .map(b -> new BucketCount(((Number) b[0]).intValue(), num(b[1])))
                    .toList();
            return new CompletenessPct(num(r[0]), (int) num(r[1]), buckets);
        });
    }

    /** รายชื่อลูกค้าในช่วงความครบถ้วน (bucket 0..10) — c2 = pct */
    public List<Member> completenessPctMembers(List<String> fields, int bucket, int limit) {
        return repo.completenessPctMembers(TenantContext.required(), fields, bucket, limit).stream()
                .map(r -> new Member((String) r[0], (String) r[1], "", String.valueOf(num(r[2]))))
                .toList();
    }

    /** นับลูกค้าตามสถานะ (ทุกสถานะ) — นับที่ DB ไม่ดึงรายการมานับฝั่งหน้า */
    public List<StatusCount> statusDistribution() {
        return insightCache.get("statusDistribution", "", () ->
                repo.statusDistribution(TenantContext.required()).stream()
                        .map(r -> new StatusCount(r[0] == null ? "ACTIVE" : String.valueOf(r[0]), num(r[1])))
                        .toList());
    }

    /** รายชื่อลูกค้าของสถานะหนึ่ง (จำกัดจำนวน) — สำหรับ drill */
    public List<Member> statusMembers(String status, int limit) {
        return repo.statusMembers(TenantContext.required(), status, limit).stream()
                .map(r -> new Member((String) r[0], (String) r[1], "", ""))
                .toList();
    }

    // ---------- ตัดเกรด ----------

    @Transactional
    public int recordGradeCut(String period) {
        UUID cid = TenantContext.required();
        int rows = repo.recordGradeCut(cid, normPeriod(period));
        insightCache.invalidate(cid);   // มีรอบตัดเกรดใหม่ → gradeMovement เปลี่ยน
        return rows;
    }

    public GradeMovement gradeMovement() {
        return insightCache.get("gradeMovement", "", () -> {
        UUID cid = TenantContext.required();
        String period = repo.latestGradePeriod(cid);
        if (period == null) return new GradeMovement(null, 0, 0, 0, 0, 0, 0, List.of());
        long up = 0, down = 0, same = 0, newly = 0, dropped = 0, total = 0;
        Map<String, Long> dist = new LinkedHashMap<>();
        for (String g : new String[] { "A", "B", "C", "D", "NONE" }) dist.put(g, 0L);
        for (Object[] r : repo.gradeCutRows(cid, period)) {
            String oldG = norm((String) r[0]), newG = norm((String) r[1]);
            total++;
            dist.merge(newG == null ? "NONE" : newG, 1L, Long::sum);
            int ro = rank(oldG), rn = rank(newG);
            if (oldG == null && newG != null) newly++;
            if (oldG != null && newG == null) dropped++;
            if (rn > ro) up++; else if (rn < ro) down++; else same++;
        }
        List<GradeCount> d = new ArrayList<>();
        dist.forEach((g, c) -> { if (c > 0 || "A".equals(g) || "B".equals(g) || "C".equals(g) || "NONE".equals(g)) d.add(new GradeCount(g, c)); });
        return new GradeMovement(period, total, up, down, same, newly, dropped, d);
        });
    }

    private static int rank(String g) {
        if (g == null) return 0;
        return switch (g) { case "A" -> 5; case "B" -> 4; case "C" -> 3; case "D" -> 2; default -> 1; };
    }

    // ---------- revision feed (เพิ่ม/แก้) ----------

    /** เหตุการณ์เพิ่ม/แก้ไขในช่วง [from, to) — diff snapshot กับเวอร์ชันก่อนหน้าเพื่อหา "แก้อะไร" */
    public List<RevisionEvent> revisions(Instant from, Instant to) {
        UUID cid = TenantContext.required();
        List<Object[]> rows = repo.revisionRows(cid, to);   // ทั้งหมดถึง to (เผื่อ diff เวอร์ชันก่อน from)
        List<RevisionEvent> out = new ArrayList<>();
        String curEntity = null;
        Map<String, Object> prev = null;
        for (Object[] r : rows) {
            String entityId = (String) r[0];
            String action = (String) r[1];
            String code = (String) r[2];
            String by = (String) r[3];
            Instant at = (Instant) r[4];
            Map<String, Object> snap = parse((String) r[5]);
            if (!entityId.equals(curEntity)) { curEntity = entityId; prev = null; }
            List<String> fields = "UPDATE".equals(action) ? changedFields(prev, snap) : List.of();
            if (at != null && !at.isBefore(from) && at.isBefore(to)) {
                out.add(new RevisionEvent(action, code, by, at, fields));
            }
            prev = snap;
        }
        out.sort((a, b) -> b.at().compareTo(a.at()));   // ใหม่สุดก่อน
        return out;
    }

    /** หาฟิลด์ที่เปลี่ยน ระหว่าง snapshot 2 เวอร์ชัน (name/groupName/status + attributes.<key>) */
    @SuppressWarnings("unchecked")
    private List<String> changedFields(Map<String, Object> a, Map<String, Object> b) {
        List<String> out = new ArrayList<>();
        if (a == null) return out;
        for (String k : new String[] { "name", "groupName", "status" }) {
            if (!eq(a.get(k), b.get(k))) out.add(k);
        }
        Map<String, Object> aa = a.get("attributes") instanceof Map ? (Map<String, Object>) a.get("attributes") : Map.of();
        Map<String, Object> ba = b.get("attributes") instanceof Map ? (Map<String, Object>) b.get("attributes") : Map.of();
        TreeSet<String> keys = new TreeSet<>();
        keys.addAll(aa.keySet());
        keys.addAll(ba.keySet());
        for (String k : keys) { if (!eq(aa.get(k), ba.get(k))) out.add(k); }
        return out;
    }

    private static boolean eq(Object a, Object b) {
        String sa = a == null ? "" : String.valueOf(a).trim();
        String sb = b == null ? "" : String.valueOf(b).trim();
        return sa.equals(sb);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parse(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try { return MAPPER.readValue(json, Map.class); } catch (Exception e) { return Map.of(); }
    }

    private static String norm(String g) {
        if (g == null) return null;
        String t = g.trim();
        return t.isEmpty() || "NONE".equalsIgnoreCase(t) ? null : t.toUpperCase();
    }

    private static String normPeriod(String p) {
        if (p != null && p.matches("\\d{4}-\\d{2}")) return p;
        java.time.YearMonth ym = java.time.YearMonth.now();
        return ym.toString();
    }

    private static long num(Object o) { return o == null ? 0L : ((Number) o).longValue(); }
}

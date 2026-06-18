package com.idoc.modules.customer.domain;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Query สำหรับ "รายงานลูกค้า" (read-only, native SQL) — แยกจาก CustomerRepositoryImpl ให้ไม่บวม
 *  - เรียลไทม์นับเฉพาะลูกค้า ACTIVE
 *  - การติดต่อ = activity kind COMMUNICATION/CALL_RESULT (status ACTIVE)
 */
@Repository
public class CustomerReportRepository {

    @PersistenceContext
    private EntityManager em;

    private static final String CONTACT_N =
            "(select count(*) from activity a where a.company_id=c.company_id and a.customer_code=c.code "
            + "and a.status='ACTIVE' and a.kind in ('COMMUNICATION','CALL_RESULT'))";
    private static final String GRADE = "nullif(trim(c.attributes->>'grade'),'')";
    private static final String HAS_PHONE =
            "(coalesce(nullif(trim(c.attributes->>'phone'),''), nullif(trim(c.attributes->>'mobile'),'')) is not null)";
    private static final String HAS_GROUP = "(nullif(trim(c.group_name),'') is not null)";

    /** การกระจายจำนวนครั้งติดต่อ → [b0, b1, b2, b3plus] · gradeAbc=true → เฉพาะเกรด A/B/C */
    public long[] contactDistribution(UUID companyId, boolean gradeAbc) {
        String where = " where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' "
                + (gradeAbc ? " and " + GRADE + " in ('A','B','C') " : "");
        Query q = em.createNativeQuery(
                "select case when n=0 then 0 when n=1 then 1 when n=2 then 2 else 3 end b, count(*) "
                + "from (select " + CONTACT_N + " n from customer c " + where + ") x group by 1");
        q.setParameter("cid", companyId.toString());
        long[] out = new long[4];
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        for (Object[] r : rows) out[((Number) r[0]).intValue()] = ((Number) r[1]).longValue();
        return out;
    }

    /** สมาชิกตาม bucket การติดต่อ (0/1/2/3=>2) — ไว้ดูข้อมูลดิบ/export */
    public List<Object[]> contactMembers(UUID companyId, int bucket, boolean gradeAbc, int limit) {
        String bp = bucket <= 0 ? "n=0" : bucket == 1 ? "n=1" : bucket == 2 ? "n=2" : "n>=3";
        String where = " where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' "
                + (gradeAbc ? " and " + GRADE + " in ('A','B','C') " : "");
        Query q = em.createNativeQuery(
                "select code, name, g, n from (select c.code, c.name, " + GRADE + " g, " + CONTACT_N + " n "
                + "from customer c " + where + ") x where " + bp + " order by n desc, code asc");
        q.setParameter("cid", companyId.toString());
        q.setMaxResults(Math.max(1, Math.min(limit, 2000)));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    /** ความครบถ้วน → [complete, noPhone, noGroup, noBoth] (ครบ = มีเบอร์อย่างน้อย 1 และมีกลุ่ม) */
    public long[] completeness(UUID companyId) {
        Query q = em.createNativeQuery(
                "select count(*) filter (where hp and hg), count(*) filter (where not hp and hg), "
                + "count(*) filter (where hp and not hg), count(*) filter (where not hp and not hg) "
                + "from (select " + HAS_PHONE + " hp, " + HAS_GROUP + " hg from customer c "
                + "where c.company_id=cast(:cid as uuid) and c.status='ACTIVE') t");
        q.setParameter("cid", companyId.toString());
        Object[] r = (Object[]) q.getSingleResult();
        return new long[] { num(r[0]), num(r[1]), num(r[2]), num(r[3]) };
    }

    /** สมาชิกความครบถ้วน — kind: complete | noPhone | noGroup | noBoth */
    public List<Object[]> completenessMembers(UUID companyId, String kind, int limit) {
        String pred = switch (kind) {
            case "complete" -> HAS_PHONE + " and " + HAS_GROUP;
            case "incomplete" -> "not (" + HAS_PHONE + " and " + HAS_GROUP + ")";
            case "noPhone" -> "not " + HAS_PHONE + " and " + HAS_GROUP;
            case "noGroup" -> HAS_PHONE + " and not " + HAS_GROUP;
            case "noBoth" -> "not " + HAS_PHONE + " and not " + HAS_GROUP;
            default -> "false";
        };
        Query q = em.createNativeQuery(
                "select c.code, c.name, c.group_name, coalesce(nullif(trim(c.attributes->>'phone'),''), nullif(trim(c.attributes->>'mobile'),'')) ph "
                + "from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' and (" + pred + ") order by c.code asc");
        q.setParameter("cid", companyId.toString());
        q.setMaxResults(Math.max(1, Math.min(limit, 2000)));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    /** นับลูกค้าตามสถานะ (ทุกสถานะ ไม่กรอง ACTIVE) → [status, count] · นับที่ DB รองรับข้อมูลจำนวนมาก */
    public List<Object[]> statusDistribution(UUID companyId) {
        Query q = em.createNativeQuery(
                "select c.status, count(*) from customer c "
                + "where c.company_id=cast(:cid as uuid) group by c.status order by count(*) desc");
        q.setParameter("cid", companyId.toString());
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    /** รายชื่อลูกค้าของสถานะหนึ่ง (จำกัดจำนวน) — สำหรับ drill ดูข้อมูลดิบ/export → [code, name] */
    public List<Object[]> statusMembers(UUID companyId, String status, int limit) {
        Query q = em.createNativeQuery(
                "select c.code, c.name from customer c "
                + "where c.company_id=cast(:cid as uuid) and c.status::text=:st order by c.code asc");
        q.setParameter("cid", companyId.toString());
        q.setParameter("st", status);
        q.setMaxResults(Math.max(1, Math.min(limit, 2000)));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    /** สร้างนิพจน์ผลรวม "ฟิลด์ที่กรอกแล้ว" จากรายชื่อฟิลด์ (groupName = คอลัมน์ · อื่น = attribute) · ตรวจอักขระแล้ว */
    private static String filledSum(List<String> validFields) {
        List<String> parts = new ArrayList<>();
        for (String k : validFields) {
            if ("groupName".equals(k)) parts.add("(case when nullif(trim(c.group_name),'') is not null then 1 else 0 end)");
            else parts.add("(case when nullif(trim(c.attributes->>'" + k + "'),'') is not null then 1 else 0 end)");
        }
        return parts.isEmpty() ? "0" : String.join(" + ", parts);
    }

    private static List<String> validFields(List<String> fields) {
        List<String> out = new ArrayList<>();
        if (fields != null) for (String f : fields) {
            if (f != null && f.trim().matches("[A-Za-z0-9_]{1,40}")) out.add(f.trim());
        }
        return out;
    }

    /** ความครบถ้วนเป็น % ของฟิลด์ที่เปิดใช้ — นับที่ DB · → [total, avg, buckets([bucket0..10, count])] */
    public Object[] completenessPct(UUID companyId, List<String> fields) {
        List<String> valid = validFields(fields);
        int total = valid.size();
        if (total == 0) return new Object[] { 0L, 0L, new ArrayList<Object[]>() };
        String inner = "select floor((" + filledSum(valid) + ") * 100.0 / " + total + ")::int p "
                + "from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE'";
        Query agg = em.createNativeQuery("select count(*), coalesce(round(avg(p)),0) from (" + inner + ") x");
        agg.setParameter("cid", companyId.toString());
        Object[] ar = (Object[]) agg.getSingleResult();
        Query bq = em.createNativeQuery(
                "select bkt, count(*) from (select (case when p>=100 then 10 else p/10 end) bkt from (" + inner + ") x) y group by bkt");
        bq.setParameter("cid", companyId.toString());
        @SuppressWarnings("unchecked")
        List<Object[]> buckets = bq.getResultList();
        return new Object[] { num(ar[0]), num(ar[1]), buckets };
    }

    /** รายชื่อลูกค้าในช่วงความครบถ้วน (bucket 0..10) — จำกัดจำนวน → [code, name, pct] */
    public List<Object[]> completenessPctMembers(UUID companyId, List<String> fields, int bucket, int limit) {
        List<String> valid = validFields(fields);
        int total = valid.size();
        if (total == 0) return new ArrayList<>();
        String pexpr = "floor((" + filledSum(valid) + ") * 100.0 / " + total + ")::int";
        Query q = em.createNativeQuery(
                "select code, name, p from (select c.code, c.name, " + pexpr + " p from customer c "
                + "where c.company_id=cast(:cid as uuid) and c.status='ACTIVE') x "
                + "where (case when p>=100 then 10 else p/10 end) = :bkt order by p asc, code asc");
        q.setParameter("cid", companyId.toString());
        q.setParameter("bkt", bucket);
        q.setMaxResults(Math.max(1, Math.min(limit, 2000)));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    // ---------- ตัดเกรด ----------

    /** บันทึก "ตัดเกรด" รอบใหม่ (idempotent: ลบรอบเดิม period นี้ก่อน) → จำนวนแถว */
    public int recordGradeCut(UUID companyId, String period) {
        Query del = em.createNativeQuery(
                "delete from customer_grade_history where company_id=cast(:cid as uuid) and period=:p");
        del.setParameter("cid", companyId.toString());
        del.setParameter("p", period);
        del.executeUpdate();
        Query ins = em.createNativeQuery(
                "insert into customer_grade_history(id,company_id,customer_code,period,cut_at,old_grade,new_grade,created_at,updated_at) "
                + "select gen_random_uuid(), c.company_id, c.code, :p, now(), "
                + "(select h.new_grade from customer_grade_history h where h.company_id=c.company_id and h.customer_code=c.code "
                + "  and h.period < :p order by h.period desc, h.cut_at desc limit 1), "
                + GRADE + ", now(), now() "
                + "from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE'");
        ins.setParameter("cid", companyId.toString());
        ins.setParameter("p", period);
        return ins.executeUpdate();
    }

    public String latestGradePeriod(UUID companyId) {
        Query q = em.createNativeQuery(
                "select max(period) from customer_grade_history where company_id=cast(:cid as uuid)");
        q.setParameter("cid", companyId.toString());
        Object r = q.getSingleResult();
        return r == null ? null : r.toString();
    }

    /** แถวของรอบหนึ่ง → [old_grade, new_grade] */
    public List<Object[]> gradeCutRows(UUID companyId, String period) {
        Query q = em.createNativeQuery(
                "select old_grade, new_grade from customer_grade_history where company_id=cast(:cid as uuid) and period=:p");
        q.setParameter("cid", companyId.toString());
        q.setParameter("p", period);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        return rows;
    }

    // ---------- revision feed (เพิ่ม/แก้ไขลูกค้า) ----------

    /** revision ของลูกค้า (CREATE/UPDATE) ทั้งหมดถึงเวลา to · เรียงตาม entity แล้ว revno (ไว้ diff หาฟิลด์ที่แก้)
     *  → [entityId(text), action, entity_code, changed_by, created_at(Instant), snapshot(text json)] */
    public List<Object[]> revisionRows(UUID companyId, Instant to) {
        Query q = em.createNativeQuery(
                "select cast(entity_id as text), action, entity_code, changed_by, created_at, snapshot::text "
                + "from entity_revision where company_id=cast(:cid as uuid) and entity_type='CUSTOMER' "
                + "and action in ('CREATE','UPDATE') and created_at < :to "
                + "order by entity_id asc, revno asc");
        q.setParameter("cid", companyId.toString());
        q.setParameter("to", to);
        q.setMaxResults(100000);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<Object[]> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new Object[] { r[0], r[1], r[2], r[3], toInstant(r[4]), r[5] });
        return out;
    }

    private static long num(Object o) { return o == null ? 0L : ((Number) o).longValue(); }

    private static Instant toInstant(Object o) {
        if (o == null) return null;
        if (o instanceof Instant i) return i;
        if (o instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (o instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        return null;
    }
}

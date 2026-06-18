package com.idoc.modules.customer.domain;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

/**
 * ค้นหาลูกค้าด้วย native SQL (รองรับ JSONB attributes) — สร้าง where แบบไดนามิก
 * ค่าที่ค้นเป็น parameter เสมอ (กัน SQL injection) · key ของ attributes ผ่าน whitelist [A-Za-z0-9_]
 */
public class CustomerRepositoryImpl implements CustomerRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    /** map คีย์ฟิลด์ → คอลัมน์จริง (อื่น ๆ = อยู่ใน attributes JSONB) */
    private static String columnExpr(String key) {
        return switch (key) {
            case "code" -> "c.code";
            case "name" -> "c.name";
            case "groupName" -> "c.group_name";
            case "status" -> "c.status";
            default -> null;
        };
    }

    private static boolean safeKey(String k) {
        return k != null && k.matches("[A-Za-z0-9_]{1,64}");
    }

    @Override
    public Page<Customer> search(UUID companyId, String q, Map<String, String> filters, List<String> statusIn, Pageable pageable) {
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) ");
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());

        // กรองสถานะ: statusIn = ชุดสถานะของแท็บ (เช่น ['ACTIVE'] หรือ ที่เหลือทั้งหมด) · ไม่ส่งมา → ACTIVE อย่างเดียว (พฤติกรรมเดิม)
        List<String> st = statusIn == null ? List.of()
                : statusIn.stream().map(s -> s == null ? "" : s.trim()).filter(s -> s.matches("[A-Z_]{1,40}")).toList();
        if (st.isEmpty()) {
            where.append(" and c.status = 'ACTIVE' ");
        } else {
            List<String> ph = new ArrayList<>();
            int si = 0;
            for (String s : st) { String p = "st" + (si++); ph.add(":" + p); params.put(p, s); }
            where.append(" and c.status in (").append(String.join(",", ph)).append(") ");
        }

        if (q != null && !q.isBlank()) {
            where.append(" and (lower(c.code) like :q or lower(c.name) like :q ")
                 .append(" or lower(coalesce(c.group_name,'')) like :q or lower(c.attributes::text) like :q) ");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }

        int i = 0;
        if (filters != null) {
            for (Map.Entry<String, String> e : filters.entrySet()) {
                String key = e.getKey();
                String val = e.getValue();
                if (val == null || val.isBlank() || !safeKey(key)) continue;
                String p = "f" + (i++);
                String col = columnExpr(key);
                if (col != null) {
                    where.append(" and lower(cast(").append(col).append(" as text)) like :").append(p).append(" ");
                } else {
                    where.append(" and lower(c.attributes->>'").append(key).append("') like :").append(p).append(" ");
                }
                params.put(p, "%" + val.trim().toLowerCase() + "%");
            }
        }

        String base = " from customer c " + where;

        Query countQ = em.createNativeQuery("select count(*) " + base);
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        Query dataQ = em.createNativeQuery("select c.* " + base + " order by c.created_at desc", Customer.class);
        params.forEach(dataQ::setParameter);
        dataQ.setFirstResult((int) pageable.getOffset());
        dataQ.setMaxResults(pageable.getPageSize());
        @SuppressWarnings("unchecked")
        List<Customer> content = dataQ.getResultList();

        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public List<Customer> lookup(UUID companyId, String q, int limit) {
        String s = q == null ? "" : q.trim().toLowerCase();
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status = 'ACTIVE' ");
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        if (!s.isEmpty()) {
            // prefix (q%) เฉพาะรหัส/ชื่อ — ใช้ index ได้ ไม่สแกน attributes
            where.append(" and (lower(c.code) like :p or lower(c.name) like :p) ");
            params.put("p", s + "%");
        }
        Query dataQ = em.createNativeQuery("select c.* from customer c " + where + " order by c.name asc", Customer.class);
        params.forEach(dataQ::setParameter);
        dataQ.setMaxResults(Math.max(1, Math.min(limit, 50)));
        @SuppressWarnings("unchecked")
        List<Customer> content = dataQ.getResultList();
        return content;
    }

    /** นิพจน์กลุ่มของแต่ละ field (whitelist) — null = ไม่ระบุ */
    private static String groupExpr(String field) {
        return switch (field) {
            case "groupName" -> "nullif(trim(c.group_name), '')";
            case "grade" -> "nullif(trim(c.attributes->>'grade'), '')";
            case "businessType" -> "nullif(trim(c.attributes->>'businessType'), '')";
            default -> null;
        };
    }

    /** ค่าจริง (raw) ของฟิลด์ — โชว์ใน popup ไว้ตรวจ */
    private static String rawExpr(String field) {
        return switch (field) {
            case "groupName" -> "c.group_name";
            case "grade" -> "c.attributes->>'grade'";
            case "businessType" -> "c.attributes->>'businessType'";
            default -> "null";
        };
    }

    @Override
    public List<GroupCount> groupCounts(UUID companyId, String field, String ready,
                                        Integer sinceContactMonths, Integer calendarDays, String excludeBasketOwner) {
        String expr = groupExpr(field);
        if (expr == null) return List.of();

        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status = 'ACTIVE' ");
        appendReady(where, params, ready, sinceContactMonths, calendarDays);
        appendNotInMyBaskets(where, params, excludeBasketOwner);

        Query query = em.createNativeQuery(
                "select " + expr + " as value, count(*) as cnt from customer c " + where + " group by 1 order by cnt desc");
        params.forEach(query::setParameter);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<GroupCount> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new GroupCount(r[0] == null ? null : r[0].toString(), ((Number) r[1]).longValue()));
        }
        return out;
    }

    /** เติมเงื่อนไข "พร้อมใช้" ลง where (+ params) — OR ของกฎที่ส่งมา (comm ก่อน ไม่มีค่อย call / ปฏิทิน ±days) */
    private static void appendReady(StringBuilder where, Map<String, Object> params, String ready,
                                    Integer sinceContactMonths, Integer calendarDays) {
        if (ready == null || "all".equals(ready)) return;
        List<String> ors = new ArrayList<>();
        if (sinceContactMonths != null && sinceContactMonths > 0) {
            // ใช้คอลัมน์ denormalize (last_comm_at ก่อน ไม่มีค่อย last_call_at) — ไม่ subquery บน activity ต่อแถว
            params.put("scCut", ZonedDateTime.now(ZoneId.systemDefault()).minusMonths(sinceContactMonths).toInstant().toString());
            ors.add("(coalesce(c.last_comm_at, c.last_call_at) is null "
                    + "or coalesce(c.last_comm_at, c.last_call_at) <= cast(:scCut as timestamptz))");
        }
        if (calendarDays != null && calendarDays > 0) {
            params.put("calLo", LocalDate.now().minusDays(calendarDays).toString());
            params.put("calHi", LocalDate.now().plusDays(calendarDays).toString());
            ors.add("exists (select 1 from calendar_event ce where ce.company_id=c.company_id and ce.customer_ref=c.code "
                    + "and ce.status <> 'DONE' and ce.activity_date between cast(:calLo as date) and cast(:calHi as date))");
        }
        if (ors.isEmpty()) {
            where.append("ready".equals(ready) ? " and false " : " and true ");
        } else {
            String pred = "(" + String.join(" or ", ors) + ")";
            where.append(" and ").append("ready".equals(ready) ? pred : "not " + pred).append(" ");
        }
    }

    /**
     * เติมเงื่อนไข "ยังไม่อยู่ในตะกร้าที่ฉันเห็น" — ตัดลูกค้าที่อยู่ในตะกร้าที่ owner เป็นเจ้าของ
     * หรือถูกแชร์มาให้ owner · owner == null/ว่าง → ไม่กรอง
     */
    private static void appendNotInMyBaskets(StringBuilder where, Map<String, Object> params, String owner) {
        if (owner == null || owner.isBlank()) return;
        params.put("bowner", owner.trim());
        where.append(" and not exists (select 1 from basket_item bi join basket b on b.id = bi.basket_id ")
             .append("where b.company_id = c.company_id and bi.customer_ref = c.code and (b.owner = :bowner ")
             .append("or exists (select 1 from basket_share s where s.basket_id = b.id and s.shared_with = :bowner))) ");
    }

    @Override
    public GroupMembers groupMembers(UUID companyId, String field, String value, String ready,
                                     Integer sinceContactMonths, Integer calendarDays, String excludeBasketOwner, int limit) {
        String expr = groupExpr(field);
        if (expr == null || value == null) return new GroupMembers(0, List.of(), List.of());

        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        params.put("gval", value);
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status = 'ACTIVE' and " + expr + " = :gval ");
        appendReady(where, params, ready, sinceContactMonths, calendarDays);
        appendNotInMyBaskets(where, params, excludeBasketOwner);
        String base = " from customer c " + where;

        Query countQ = em.createNativeQuery("select count(*) " + base);
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        String valueExpr = rawExpr(field);
        List<Member> head, tail;
        if (total <= 2L * limit) {
            head = memberPage(base, params, false, (int) Math.min(total, 2L * limit), valueExpr);
            tail = List.of();
        } else {
            head = memberPage(base, params, false, limit, valueExpr);
            tail = memberPage(base, params, true, limit, valueExpr);
            Collections.reverse(tail);   // ท้ายตาราง → เรียงขึ้นเหมือน head
        }
        return new GroupMembers(total, head, tail);
    }

    /** ติดต่อล่าสุด (comm ก่อน ไม่มีค่อย call) — อ่านจากคอลัมน์ denormalize (ไม่ subquery) */
    private static final String LAST_CONTACT_EXPR = "coalesce(c.last_comm_at, c.last_call_at)";
    /** กำหนดติดตามล่าสุด — นัดในปฏิทินที่ยังไม่เสร็จ และไม่เก่ากว่า 2 เดือน */
    private static final String FOLLOWUP_EXPR =
            "(select max(ce.activity_date) from calendar_event ce where ce.company_id=c.company_id and ce.customer_ref=c.code "
            + "and ce.status <> 'DONE' and ce.activity_date >= current_date - interval '2 months')";

    private List<Member> memberPage(String base, Map<String, Object> params, boolean desc, int limit, String valueExpr) {
        if (limit <= 0) return new ArrayList<>();
        Query q = em.createNativeQuery("select c.code, c.name, " + LAST_CONTACT_EXPR + " as last_contact, "
                + valueExpr + " as gval, " + FOLLOWUP_EXPR + " as follow_up " + base + " order by c.code " + (desc ? "desc" : "asc"));
        params.forEach(q::setParameter);
        q.setMaxResults(limit);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<Member> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new Member((String) r[0], (String) r[1], toInstant(r[2]), (String) r[3], toLocalDate(r[4])));
        return out;
    }

    private static Instant toInstant(Object o) {
        if (o == null) return null;
        if (o instanceof Instant i) return i;
        if (o instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (o instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        return null;
    }

    private static java.time.LocalDate toLocalDate(Object o) {
        if (o == null) return null;
        if (o instanceof java.time.LocalDate d) return d;
        if (o instanceof java.sql.Date d) return d.toLocalDate();
        return null;
    }

    // ---------- "ตามงานขาย" (sales buckets) ----------

    @Override
    public SalesBuckets salesBuckets(UUID companyId, int years, String ready, Integer months, Integer days, String excludeBasketOwner) {
        int cy = java.time.Year.now().getValue();
        int firstYear = cy - years + 1;

        // เงื่อนไข "พร้อมใช้" + "ยังไม่อยู่ในตะกร้าที่ฉันเห็น" (อ้าง alias c) — ใช้ซ้ำทุก query
        StringBuilder rb = new StringBuilder();
        Map<String, Object> rp = new HashMap<>();
        appendReady(rb, rp, ready, months, days);
        appendNotInMyBaskets(rb, rp, excludeBasketOwner);
        String rf = rb.toString();

        Query q = em.createNativeQuery(
                "select s.doc_type, cast(extract(year from s.created_at) as int) as yr, count(distinct s.customer_ref) "
                + "from sales_document s join customer c on c.company_id=s.company_id and c.code=s.customer_ref and c.status='ACTIVE' "
                + "where s.company_id = cast(:cid as uuid) and s.doc_type in ('FO','QT','SO') "
                + "and s.customer_ref is not null and extract(year from s.created_at) >= :fy " + rf
                + "group by s.doc_type, yr");
        q.setParameter("cid", companyId.toString());
        q.setParameter("fy", firstYear);
        rp.forEach(q::setParameter);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        Map<String, Map<Integer, Long>> by = new HashMap<>();
        for (Object[] r : rows) {
            by.computeIfAbsent((String) r[0], k -> new HashMap<>())
              .put(((Number) r[1]).intValue(), ((Number) r[2]).longValue());
        }

        long contactedNotClosed = countScalar(companyId, rp,
                "select count(*) from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' "
                + "and (c.last_comm_at is not null or c.last_call_at is not null) "
                + "and not exists (select 1 from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code and s.doc_type='SO') " + rf);
        long neverContacted = countScalar(companyId, rp,
                "select count(*) from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' "
                + "and c.last_comm_at is null and c.last_call_at is null " + rf);
        long calendarAhead = countScalar(companyId, rp,
                "select count(distinct ce.customer_ref) from calendar_event ce "
                + "join customer c on c.company_id=ce.company_id and c.code=ce.customer_ref and c.status='ACTIVE' "
                + "where ce.company_id=cast(:cid as uuid) and ce.customer_ref is not null and ce.status <> 'DONE' and ce.activity_date >= current_date " + rf);

        return new SalesBuckets(yearList(by.get("FO"), cy, years), yearList(by.get("QT"), cy, years),
                yearList(by.get("SO"), cy, years), contactedNotClosed, neverContacted, calendarAhead);
    }

    private static List<YearCount> yearList(Map<Integer, Long> m, int currentYear, int years) {
        List<YearCount> out = new ArrayList<>(years);
        for (int i = 0; i < years; i++) {
            int y = currentYear - i;
            out.add(new YearCount(y, m == null ? 0L : m.getOrDefault(y, 0L)));
        }
        return out;
    }

    private long countScalar(UUID companyId, Map<String, Object> readyParams, String sql) {
        Query q = em.createNativeQuery(sql);
        q.setParameter("cid", companyId.toString());
        readyParams.forEach(q::setParameter);
        return ((Number) q.getSingleResult()).longValue();
    }

    /** เติมเงื่อนไขของ bucket ลง where (+ params) · คืน valueExpr สำหรับ members ("" = bucket ไม่ถูกต้อง) */
    private static String appendBucket(StringBuilder where, Map<String, Object> params, String bucket, Integer year) {
        switch (bucket) {
            case "FO", "QT", "SO" -> {
                if (year == null) return "";
                params.put("yr", year);
                where.append(" and exists (select 1 from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code "
                        + "and s.doc_type='").append(bucket).append("' and extract(year from s.created_at) = :yr) ");
                return "'" + year + "'";
            }
            case "contactedNotClosed" -> {
                where.append(" and (c.last_comm_at is not null or c.last_call_at is not null) "
                        + "and not exists (select 1 from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code and s.doc_type='SO') ");
                return "null";
            }
            case "neverContacted" -> {
                where.append(" and c.last_comm_at is null and c.last_call_at is null ");
                return "null";
            }
            case "calendarAhead" -> {
                where.append(" and exists (select 1 from calendar_event ce where ce.company_id=c.company_id and ce.customer_ref=c.code "
                        + "and ce.status <> 'DONE' and ce.activity_date >= current_date) ");
                return "null";
            }
            default -> { return ""; }
        }
    }

    @Override
    public GroupMembers bucketMembers(UUID companyId, String bucket, Integer year, String field, String value,
                                      String ready, Integer months, Integer days, String excludeBasketOwner, int limit) {
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status='ACTIVE' ");
        String valueExpr = appendBucket(where, params, bucket, year);
        if (valueExpr.isEmpty()) return new GroupMembers(0, List.of(), List.of());

        // เจาะลึกตามกลุ่ม (เช่น businessType=อาหาร) → โชว์ค่ากลุ่มในคอลัมน์ value แทน
        String groupExpr = field == null ? null : groupExpr(field);
        if (groupExpr != null && value != null) {
            where.append(" and ").append(groupExpr).append(" = :gval ");
            params.put("gval", value);
            valueExpr = rawExpr(field);
        }
        appendReady(where, params, ready, months, days);
        appendNotInMyBaskets(where, params, excludeBasketOwner);
        String base = " from customer c " + where;

        Query countQ = em.createNativeQuery("select count(*) " + base);
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        List<Member> head, tail;
        if (total <= 2L * limit) {
            head = memberPage(base, params, false, (int) Math.min(total, 2L * limit), valueExpr);
            tail = List.of();
        } else {
            head = memberPage(base, params, false, limit, valueExpr);
            tail = memberPage(base, params, true, limit, valueExpr);
            Collections.reverse(tail);
        }
        return new GroupMembers(total, head, tail);
    }

    @Override
    public List<GroupCount> bucketBreakdown(UUID companyId, String bucket, Integer year, String field,
                                            String ready, Integer months, Integer days, String excludeBasketOwner) {
        String expr = groupExpr(field);
        if (expr == null) return List.of();
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status='ACTIVE' ");
        if (appendBucket(where, params, bucket, year).isEmpty()) return List.of();
        appendReady(where, params, ready, months, days);
        appendNotInMyBaskets(where, params, excludeBasketOwner);

        Query q = em.createNativeQuery("select " + expr + " as value, count(*) as cnt from customer c " + where + " group by 1 order by cnt desc");
        params.forEach(q::setParameter);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<GroupCount> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new GroupCount(r[0] == null ? null : r[0].toString(), ((Number) r[1]).longValue()));
        return out;
    }

    // ---------- ตะกร้า ----------

    @Override
    public List<String> resolveCodes(UUID companyId, String field, String value, String bucket, Integer year,
                                     String ready, Integer months, Integer days, UUID excludeBasketId,
                                     boolean excludeInProgressCl, int limit) {
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status='ACTIVE' ");
        if (bucket != null && !bucket.isBlank()) {
            if (appendBucket(where, params, bucket, year).isEmpty()) return List.of();
        }
        if (field != null && groupExpr(field) != null && value != null) {
            where.append(" and ").append(groupExpr(field)).append(" = :gval ");
            params.put("gval", value);
        }
        appendExcludeBasket(where, params, excludeBasketId);
        appendExcludeInProgressCl(where, excludeInProgressCl);
        appendReady(where, params, ready, months, days);

        Query q = em.createNativeQuery("select c.code from customer c " + where + " order by c.code asc");
        params.forEach(q::setParameter);
        q.setMaxResults(Math.max(1, limit));
        @SuppressWarnings("unchecked")
        List<String> codes = q.getResultList();
        return codes;
    }

    /** เอาเฉพาะที่ยังไม่อยู่ในตะกร้าที่ระบุ */
    private static void appendExcludeBasket(StringBuilder where, Map<String, Object> params, UUID excludeBasketId) {
        if (excludeBasketId == null) return;
        params.put("exclBid", excludeBasketId.toString());
        where.append(" and not exists (select 1 from basket_item bi where bi.basket_id = cast(:exclBid as uuid) and bi.customer_ref = c.code) ");
    }

    /** กันซ้ำข้าม CL: ลูกค้าที่อยู่ในตะกร้า CL ที่ยังไม่ปิด (phase <> DONE) ดึงลงใบอื่นไม่ได้ */
    private static void appendExcludeInProgressCl(StringBuilder where, boolean on) {
        if (!on) return;
        where.append(" and not exists (select 1 from basket_item bi "
                + "join basket b on b.id = bi.basket_id and b.company_id = c.company_id and b.ref_type = 'CL' "
                + "join sales_document sd on sd.company_id = c.company_id and sd.doc_type = 'CL' and sd.code = b.ref_code and sd.phase <> 'DONE' "
                + "where bi.customer_ref = c.code) ");
    }

    @Override
    public List<String> resolveSearchCodes(UUID companyId, String q, Map<String, String> filters,
                                           String ready, Integer months, Integer days,
                                           UUID excludeBasketId, boolean excludeInProgressCl, int limit) {
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status='ACTIVE' ");
        if (q != null && !q.isBlank()) {
            where.append(" and (lower(c.code) like :q or lower(c.name) like :q ")
                 .append(" or lower(coalesce(c.group_name,'')) like :q or lower(c.attributes::text) like :q) ");
            params.put("q", "%" + q.trim().toLowerCase() + "%");
        }
        int i = 0;
        if (filters != null) {
            for (Map.Entry<String, String> e : filters.entrySet()) {
                String k = e.getKey(), val = e.getValue();
                if (val == null || val.isBlank() || !safeKey(k)) continue;
                String p = "sf" + (i++);
                String col = columnExpr(k);
                if (col != null) where.append(" and lower(cast(").append(col).append(" as text)) like :").append(p).append(" ");
                else where.append(" and lower(c.attributes->>'").append(k).append("') like :").append(p).append(" ");
                params.put(p, "%" + val.trim().toLowerCase() + "%");
            }
        }
        appendExcludeBasket(where, params, excludeBasketId);
        appendExcludeInProgressCl(where, excludeInProgressCl);
        appendReady(where, params, ready, months, days);

        Query query = em.createNativeQuery("select c.code from customer c " + where + " order by c.code asc");
        params.forEach(query::setParameter);
        query.setMaxResults(Math.max(1, limit));
        @SuppressWarnings("unchecked")
        List<String> codes = query.getResultList();
        return codes;
    }

    @Override
    public List<LeadPreview> leadPreviewByCodes(UUID companyId, List<String> codes,
                                                Integer months, Integer days, String currentClCode) {
        if (codes == null || codes.isEmpty()) return List.of();
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        params.put("codes", codes.size() > 1000 ? codes.subList(0, 1000) : codes);
        params.put("clcode", currentClCode == null ? "" : currentClCode);

        // นิพจน์ "พร้อมใช้" (ไม่ตั้งเกณฑ์ = ถือว่าพร้อมใช้ทุกราย)
        List<String> ors = new ArrayList<>();
        if (months != null && months > 0) {
            params.put("scCut", ZonedDateTime.now(ZoneId.systemDefault()).minusMonths(months).toInstant().toString());
            ors.add("(coalesce(c.last_comm_at, c.last_call_at) is null or coalesce(c.last_comm_at, c.last_call_at) <= cast(:scCut as timestamptz))");
        }
        if (days != null && days > 0) {
            params.put("calLo", LocalDate.now().minusDays(days).toString());
            params.put("calHi", LocalDate.now().plusDays(days).toString());
            ors.add("exists (select 1 from calendar_event ce where ce.company_id=c.company_id and ce.customer_ref=c.code "
                    + "and ce.status <> 'DONE' and ce.activity_date between cast(:calLo as date) and cast(:calHi as date))");
        }
        String readyExpr = ors.isEmpty() ? "true" : "(" + String.join(" or ", ors) + ")";
        String inOther = "exists (select 1 from basket_item bi join basket b on b.id=bi.basket_id and b.company_id=c.company_id "
                + "and b.ref_type='CL' and b.ref_code <> :clcode join sales_document sd on sd.company_id=c.company_id "
                + "and sd.doc_type='CL' and sd.code=b.ref_code and sd.phase <> 'DONE' where bi.customer_ref=c.code)";

        String usedExpr = "(select count(*) from customer_use_log u where u.company_id=c.company_id and u.customer_code=c.code)";
        Query q = em.createNativeQuery(
                "select c.code, c.name, c.group_name, coalesce(c.last_comm_at, c.last_call_at) as lc, "
                + readyExpr + " as ready, " + inOther + " as in_other, " + usedExpr + " as used_cnt "
                + "from customer c where c.company_id=cast(:cid as uuid) and c.status='ACTIVE' and c.code in (:codes) order by c.code asc");
        params.forEach(q::setParameter);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<LeadPreview> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new LeadPreview((String) r[0], (String) r[1], (String) r[2], toInstant(r[3]),
                    Boolean.TRUE.equals(r[4]), Boolean.TRUE.equals(r[5]), ((Number) r[6]).longValue()));
        }
        return out;
    }

    @Override
    public List<MovementRow> recentMovements(UUID companyId, int limit) {
        // หาวัน "เคลื่อนไหวล่าสุด" ต่อลูกค้าจาก 3 แหล่ง (Tool/เอกสาร/ปฏิทิน) แล้วเอา 200 รายล่าสุด
        // distinct on แต่ละแหล่ง = ล่าสุดต่อลูกค้า (ใช้ index) ก่อน union → เบากว่าสแกนรวมทั้งหมด
        String sql = "with tool as ("
                + "  select distinct on (customer_code) customer_code as code, occurred_at as moved_at, 'TOOL' as source, kind as detail"
                + "  from activity where company_id = cast(:cid as uuid) and status = 'ACTIVE' and customer_code is not null"
                // จำกัดช่วง 12 เดือน: 'เคลื่อนไหวล่าสุด' ที่เก่ากว่านี้ไม่นับ + กันสแกน activity ทั้งตาราง (ใช้ index idx_activity_customer)
                + "    and occurred_at >= now() - interval '12 months'"
                + "  order by customer_code, occurred_at desc), "
                + "doc as ("
                + "  select distinct on (customer_ref) customer_ref as code, updated_at as moved_at, doc_type as source, doc_type as detail"
                + "  from sales_document where company_id = cast(:cid as uuid) and customer_ref is not null"
                + "  order by customer_ref, updated_at desc), "
                + "cal as ("
                + "  select distinct on (customer_ref) customer_ref as code, updated_at as moved_at, 'CALENDAR' as source, title as detail"
                + "  from calendar_event where company_id = cast(:cid as uuid) and customer_ref is not null"
                + "  order by customer_ref, updated_at desc), "
                + "mv as (select * from tool union all select * from doc union all select * from cal), "
                + "latest as (select distinct on (code) code, moved_at, source, detail from mv order by code, moved_at desc) "
                + "select cast(c.id as text) as id, l.code, c.name, c.status, l.moved_at, l.source, l.detail "
                + "from latest l join customer c on c.company_id = cast(:cid as uuid) and c.code = l.code and c.status = 'ACTIVE' "
                + "order by l.moved_at desc limit :lim";
        Query q = em.createNativeQuery(sql);
        q.setParameter("cid", companyId.toString());
        q.setParameter("lim", Math.max(1, Math.min(limit, 500)));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<MovementRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new MovementRow((String) r[0], (String) r[1], (String) r[2], (String) r[3],
                    toInstant(r[4]), (String) r[5], (String) r[6]));
        }
        return out;
    }

    @Override
    public List<BasketRow> basketItems(UUID companyId, UUID basketId) {
        Query q = em.createNativeQuery(
                "select c.code, c.name, c.group_name, coalesce(c.last_comm_at, c.last_call_at) as last_contact, "
                + "(select count(*) from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code and s.doc_type='FO') as fo, "
                + "(select count(*) from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code and s.doc_type='QT') as qt, "
                + "(select count(*) from sales_document s where s.company_id=c.company_id and s.customer_ref=c.code and s.doc_type='SO') as so, "
                + "bi.reason, bi.remove_by, bi.added_at "
                + "from basket_item bi join customer c on c.company_id = cast(:cid as uuid) and c.code = bi.customer_ref and c.status='ACTIVE' "
                + "where bi.basket_id = cast(:bid as uuid) order by bi.added_at desc");
        q.setParameter("cid", companyId.toString());
        q.setParameter("bid", basketId.toString());
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<BasketRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            java.time.LocalDate removeBy = r[8] instanceof java.sql.Date d ? d.toLocalDate()
                    : (r[8] instanceof java.time.LocalDate ld ? ld : null);
            out.add(new BasketRow((String) r[0], (String) r[1], (String) r[2], toInstant(r[3]),
                    ((Number) r[4]).longValue(), ((Number) r[5]).longValue(), ((Number) r[6]).longValue(),
                    (String) r[7], removeBy, toInstant(r[9])));
        }
        return out;
    }
}

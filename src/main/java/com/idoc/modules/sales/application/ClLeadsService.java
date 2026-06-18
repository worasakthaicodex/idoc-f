package com.idoc.modules.sales.application;

import com.idoc.modules.customer.api.CustomerInsightApi;
import com.idoc.modules.customer.domain.Basket;
import com.idoc.modules.customer.domain.BasketItem;
import com.idoc.modules.customer.domain.BasketItemRepository;
import com.idoc.modules.customer.domain.BasketRepository;
import com.idoc.modules.customer.domain.Customer;
import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.BasketRow;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.LeadPreview;
import com.idoc.modules.sales.domain.ClCallLog;
import com.idoc.modules.sales.domain.ClCallLogRepository;
import com.idoc.modules.sales.domain.ClPullLog;
import com.idoc.modules.sales.domain.ClPullLogRepository;
import com.idoc.modules.sales.domain.CustomerUseLog;
import com.idoc.modules.sales.domain.CustomerUseLogRepository;
import com.idoc.shared.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * รายชื่อในชุด CL — ใช้ "ตะกร้าซื้อจริง" (ตะกร้าซ่อน ref_type=CL) เก็บรายชื่อที่ดึงมา
 *  - ดึงได้เฉพาะลูกค้า "พร้อมใช้" (readiness) · จำกัดจำนวน (ดีฟอลต์ 60)
 *  - กันซ้ำ: ลูกค้าที่อยู่ใน CL อื่นที่ยังไม่ปิด (phase<>DONE) ดึงซ้ำไม่ได้
 *  - ทุกครั้งที่ดึง บันทึก Log (วิธี/รายละเอียด/จำนวน/ผู้ดึง)
 */
@Service
@RequiredArgsConstructor
public class ClLeadsService {

    private static final String REF = "CL";

    private final BasketRepository basketRepository;
    private final BasketItemRepository basketItemRepository;
    private final CustomerRepository customerRepository;
    private final ClPullLogRepository logRepository;
    private final CustomerUseLogRepository useLogRepository;
    private final ClCallLogRepository callLogRepository;
    private final CustomerInsightApi insightApi;   // ดึง/ลบรายชื่อใน CL = basket_item เปลี่ยน → ตัวกรอง "ไม่อยู่ในตะกร้า" เปลี่ยน

    @PersistenceContext
    private EntityManager em;

    /** ตะกร้าซ่อนของ CL นั้น (สร้างครั้งแรกที่ใช้) */
    @Transactional
    public Basket ensureBasket(UUID tenant, String clCode, String by) {
        return basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode)
                .orElseGet(() -> {
                    Basket b = new Basket();
                    b.setCompanyId(tenant);
                    b.setOwner(by == null || by.isBlank() ? clCode : by.trim());
                    b.setName(clCode);
                    b.setRefType(REF);
                    b.setRefCode(clCode);
                    return basketRepository.save(b);
                });
    }

    /** ดึงรายชื่อลงตะกร้า CL → คืนจำนวนที่ดึงได้จริง
     *  แหล่ง: ค้น (q/filters เหมือน /customer) ถ้ามี · ไม่งั้นใช้ field/value (กลุ่ม) หรือ bucket (ตามงานขาย) */
    @Transactional
    public int pull(String clCode, String q, Map<String, String> filters,
                    String field, String value, String bucket, Integer year,
                    String ready, Integer months, Integer days, int limit,
                    String method, String detail, String by) {
        UUID tenant = TenantContext.required();
        Basket basket = ensureBasket(tenant, clCode, by);
        Integer m = months, d = days;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        int lim = limit < 1 ? 60 : Math.min(limit, 500);
        boolean isSearch = (q != null && !q.isBlank()) || (filters != null && !filters.isEmpty());
        List<String> codes = isSearch
                ? customerRepository.resolveSearchCodes(tenant, q, filters, ready, m, d, basket.getId(), true, lim)
                : customerRepository.resolveCodes(tenant, field, value, bucket, year, ready, m, d, basket.getId(), true, lim);
        int added = 0;
        for (String code : codes) {
            if (code == null || code.isBlank()) continue;
            if (!basketItemRepository.existsByBasketIdAndCustomerRef(basket.getId(), code)) {
                BasketItem it = new BasketItem();
                it.setBasketId(basket.getId());
                it.setCustomerRef(code.trim());
                it.setAddedAt(Instant.now());
                basketItemRepository.save(it);
                added++;
            }
        }
        ClPullLog log = new ClPullLog();
        log.setCompanyId(tenant);
        log.setClCode(clCode);
        log.setMethod(method == null || method.isBlank() ? "FILTER" : method);
        log.setDetail(detail);
        log.setCnt(added);
        log.setPulledBy(by);
        logRepository.save(log);
        if (added > 0) insightApi.invalidate(tenant);
        return added;
    }

    /** พรีวิวรายชื่อตามเกณฑ์ (ยังไม่ลง DB) — auto: เฉพาะพร้อมใช้+ไม่ติด CL อื่น · basket: ทุกราย ติดธงให้เลือก */
    @Transactional(readOnly = true)
    public List<LeadPreview> resolve(String clCode, boolean fromBasket, UUID basketId,
                                     String q, Map<String, String> filters, String field, String value,
                                     String bucket, Integer year, String ready, Integer months, Integer days, int limit) {
        UUID tenant = TenantContext.required();
        Integer m = months, d = days;
        if (ready == null || "all".equals(ready)) { m = null; d = null; }
        List<String> codes;
        if (fromBasket) {
            if (basketId == null) return List.of();
            codes = customerRepository.basketItems(tenant, basketId).stream().map(BasketRow::code).toList();
        } else {
            UUID clBasket = basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode).map(Basket::getId).orElse(null);
            int lim = limit < 1 ? 60 : Math.min(limit, 500);
            boolean isSearch = (q != null && !q.isBlank()) || (filters != null && !filters.isEmpty());
            codes = isSearch
                    ? customerRepository.resolveSearchCodes(tenant, q, filters, ready, m, d, clBasket, true, lim)
                    : customerRepository.resolveCodes(tenant, field, value, bucket, year, ready, m, d, clBasket, true, lim);
        }
        // basket: ใช้เกณฑ์พร้อมใช้ของบริษัทมาติดธง (แม้ ready=all ก็ยังอยากเห็นธง) → ส่ง months/days ตามที่ตั้ง
        return customerRepository.leadPreviewByCodes(tenant, codes, m, d, clCode);
    }

    /** บันทึกชุด (คอมมิต): ตั้งรายชื่อในตะกร้า CL = codes + บันทึก Log ที่ค้างไว้ */
    @Transactional
    public int save(String clCode, List<String> codes, List<LogEntry> logs, String by) {
        UUID tenant = TenantContext.required();
        Basket basket = ensureBasket(tenant, clCode, by);
        basketItemRepository.deleteByBasketId(basket.getId());
        if (codes != null) {
            for (String code : codes.stream().filter(c -> c != null && !c.isBlank()).distinct().toList()) {
                BasketItem it = new BasketItem();
                it.setBasketId(basket.getId());
                it.setCustomerRef(code.trim());
                it.setAddedAt(Instant.now());
                basketItemRepository.save(it);
            }
        }
        if (logs != null) {
            for (LogEntry e : logs) {
                ClPullLog log = new ClPullLog();
                log.setCompanyId(tenant);
                log.setClCode(clCode);
                log.setMethod(e.method() == null ? "FILTER" : e.method());
                log.setDetail(e.detail());
                log.setCnt(e.cnt());
                log.setPulledBy(e.by() == null ? by : e.by());
                logRepository.save(log);
            }
        }
        insightApi.invalidate(tenant);
        return codes == null ? 0 : codes.size();
    }

    public record LogEntry(String method, String detail, int cnt, String by) {}

    /** รายชื่อในตะกร้า CL (พร้อมจำนวนรอบที่เคยถูกใช้) */
    @Transactional(readOnly = true)
    public List<LeadPreview> leads(String clCode) {
        UUID tenant = TenantContext.required();
        return basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode)
                .map(b -> {
                    List<String> codes = customerRepository.basketItems(tenant, b.getId()).stream().map(BasketRow::code).toList();
                    return customerRepository.leadPreviewByCodes(tenant, codes, null, null, clCode);
                })
                .orElseGet(List::of);
    }

    /** ทำชุดจนจบ (DONE) → บันทึกว่าลูกค้าทุกรายในชุดถูกใช้ +1 รอบ (กันซ้ำในชุดเดียว) → คืนจำนวนที่บันทึก */
    @Transactional
    public int complete(String clCode) {
        UUID tenant = TenantContext.required();
        var basket = basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode);
        if (basket.isEmpty()) return 0;
        int n = 0;
        for (BasketRow r : customerRepository.basketItems(tenant, basket.get().getId())) {
            if (useLogRepository.existsByCompanyIdAndClCodeAndCustomerCode(tenant, clCode, r.code())) continue;
            CustomerUseLog u = new CustomerUseLog();
            u.setCompanyId(tenant);
            u.setCustomerCode(r.code());
            u.setClCode(clCode);
            u.setUsedAt(Instant.now());
            useLogRepository.save(u);
            n++;
        }
        return n;
    }

    /** เอารายชื่อออกจากตะกร้า CL + บันทึก Log การนำออก (ใคร/อันไหน) เพื่อให้ประวัติตรวจยอดได้ */
    @Transactional
    public void removeLead(String clCode, String customerRef, String by) {
        UUID tenant = TenantContext.required();
        basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode).ifPresent(b -> {
            int n = basketItemRepository.deleteByBasketIdAndCustomerRef(b.getId(), customerRef);
            if (n > 0) {
                ClPullLog log = new ClPullLog();
                log.setCompanyId(tenant);
                log.setClCode(clCode);
                log.setMethod("REMOVE");
                log.setDetail(customerRef);
                log.setCnt(n);
                log.setPulledBy(by);
                logRepository.save(log);
            }
        });
        insightApi.invalidate(tenant);
    }

    /** Log การดึงของ CL นั้น */
    @Transactional(readOnly = true)
    public List<ClPullLog> logs(String clCode) {
        return logRepository.findByCompanyIdAndClCodeOrderByCreatedAtDesc(TenantContext.required(), clCode);
    }

    /** ===== Worklist: รายชื่อในชุด + ข้อมูลติดต่อ + สถานะ/ประวัติการโทร ===== */

    public record CallEntry(String result, Integer minutes, String note, String by, Instant at) {}
    public record WorkLead(String code, String name, String contactPerson, String position,
                           String phone, String email, String status, List<CallEntry> calls) {}

    private static String attr(Customer c, String... keys) {
        Map<String, String> a = c.getAttributes();
        if (a == null) return null;
        for (String k : keys) {
            String v = a.get(k);
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    /** รายชื่อในชุด CL พร้อมข้อมูลติดต่อ + สถานะล่าสุด/ประวัติการโทร (เรียงตามรหัส) */
    @Transactional(readOnly = true)
    public List<WorkLead> worklist(String clCode) {
        UUID tenant = TenantContext.required();
        var basket = basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode);
        if (basket.isEmpty()) return List.of();
        List<String> codes = customerRepository.basketItems(tenant, basket.get().getId())
                .stream().map(BasketRow::code).toList();
        if (codes.isEmpty()) return List.of();

        // ข้อมูลติดต่อจากลูกค้า
        Map<String, Customer> byCode = new LinkedHashMap<>();
        for (Customer c : customerRepository.findByCompanyIdAndCodeIn(tenant, codes)) byCode.put(c.getCode(), c);

        // ประวัติการโทร (ใหม่ → เก่า) จัดกลุ่มต่อรายคน
        Map<String, List<CallEntry>> callsByCode = new LinkedHashMap<>();
        for (ClCallLog l : callLogRepository.findByCompanyIdAndClCodeOrderByCalledAtDesc(tenant, clCode)) {
            callsByCode.computeIfAbsent(l.getCustomerCode(), k -> new ArrayList<>())
                    .add(new CallEntry(l.getResult(), l.getMinutes(), l.getNote(), l.getCalledBy(), l.getCalledAt()));
        }

        List<WorkLead> out = new ArrayList<>(codes.size());
        for (String code : codes) {
            Customer c = byCode.get(code);
            List<CallEntry> calls = callsByCode.getOrDefault(code, List.of());
            String status = calls.isEmpty() ? "NEW" : calls.get(0).result();
            out.add(new WorkLead(
                    code,
                    c != null ? c.getName() : code,
                    c != null ? attr(c, "contactPerson") : null,
                    c != null ? attr(c, "personPosition") : null,
                    c != null ? attr(c, "phone", "mobile", "personNumber") : null,
                    c != null ? attr(c, "email", "personEmail") : null,
                    status, calls));
        }
        return out;
    }

    /** ===== สรุปภาพรวม: ข้อมูลการขายย้อนหลังของลูกค้าทั้งหมดในชุด CL ===== */
    public record NameCount(String name, long count) {}
    public record Summary(double salesTotal, long qtCount, long foCount, long soCount,
                          List<NameCount> groups, List<NameCount> grades,
                          List<String> systems, List<String> techniques, List<String> services) {}

    private static Summary emptySummary() {
        return new Summary(0, 0, 0, 0, List.of(), List.of(), List.of(), List.of(), List.of());
    }

    @Transactional(readOnly = true)
    public Summary summary(String clCode) {
        UUID tenant = TenantContext.required();
        var basket = basketRepository.findByCompanyIdAndRefTypeAndRefCode(tenant, REF, clCode);
        if (basket.isEmpty()) return emptySummary();
        List<String> codes = customerRepository.basketItems(tenant, basket.get().getId())
                .stream().map(BasketRow::code).toList();
        if (codes.isEmpty()) return emptySummary();
        String cid = tenant.toString();

        // 1) ยอดขายรวมจาก SO (ช่อง data->>'saleAmount')
        double salesTotal = ((Number) em.createNativeQuery(
                "select coalesce(sum(nullif(d.data->>'saleAmount','')::numeric),0) from sales_document d "
                + "where d.company_id=cast(:cid as uuid) and d.doc_type='SO' and d.customer_ref in (:codes)")
                .setParameter("cid", cid).setParameter("codes", codes).getSingleResult()).doubleValue();

        long qtCount = countDocs("QT", cid, codes);   // จำนวนใบเสนอราคา
        long foCount = countDocs("FO", cid, codes);   // เปิดใบเสนอราคา/ติดตามกี่ครั้ง
        long soCount = countDocs("SO", cid, codes);   // ปิดไปกี่ครั้ง

        List<NameCount> groups = nameCounts(em.createNativeQuery(
                "select coalesce(nullif(c.group_name,''),'ไม่ระบุ') g, count(*) from customer c "
                + "where c.company_id=cast(:cid as uuid) and c.code in (:codes) group by g order by count(*) desc")
                .setParameter("cid", cid).setParameter("codes", codes).getResultList());

        List<NameCount> grades = nameCounts(em.createNativeQuery(
                "select coalesce(nullif(c.attributes->>'grade',''),'ไม่ระบุ') g, count(*) from customer c "
                + "where c.company_id=cast(:cid as uuid) and c.code in (:codes) group by g order by g")
                .setParameter("cid", cid).setParameter("codes", codes).getResultList());

        List<String> systems = strings(em.createNativeQuery(
                "select distinct a.payload->>'system' s from activity a "
                + "where a.company_id=cast(:cid as uuid) and a.kind='CUSTOMER_SYSTEM' and a.status='ACTIVE' "
                + "and a.customer_code in (:codes) and nullif(a.payload->>'system','') is not null order by s")
                .setParameter("cid", cid).setParameter("codes", codes).getResultList());

        List<String> techniques = soDistinct("salesTechnique", cid, codes);
        List<String> services = soDistinct("closedService", cid, codes);

        return new Summary(salesTotal, qtCount, foCount, soCount, groups, grades, systems, techniques, services);
    }

    /** เอกสารสายงานที่ต่อจาก CL นี้ (FO/QT/SO อ้างอิงด้วย src_cl) — ไว้ทำต้นไม้แม่-ลูก */
    public record ChainDoc(String docType, String code, String title, String srcFo, String srcQt) {}

    @Transactional(readOnly = true)
    public List<ChainDoc> chain(String clCode) {
        UUID tenant = TenantContext.required();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(
                "select doc_type, code, coalesce(title,''), coalesce(src_fo,''), coalesce(src_qt,'') "
                + "from sales_document where company_id=cast(:cid as uuid) and src_cl=:cl "
                + "and doc_type in ('FO','QT','SO') order by doc_type, code")
                .setParameter("cid", tenant.toString()).setParameter("cl", clCode).getResultList();
        List<ChainDoc> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) out.add(new ChainDoc((String) r[0], (String) r[1], (String) r[2], (String) r[3], (String) r[4]));
        return out;
    }

    /** ===== ข้อมูลเสริมต่อ CL สำหรับกล่องงาน /sales/cl (คิวรีแบบรวบ ไม่ยิงรายใบ) ===== */
    public record BoxRow(String code, double salesEstimate, String conditions,
                         Instant lastContact, String nextAppt,
                         long foCount, long qtCount, long soCount) {}

    private static Instant toInstant(Object o) {
        if (o instanceof Instant i) return i;
        if (o instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (o instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        return null;
    }

    @Transactional(readOnly = true)
    public List<BoxRow> boxRows() {
        UUID tenant = TenantContext.required();
        String cid = tenant.toString();

        // ยอดขายย้อนหลังต่อ CL (ผ่านลูกค้าในชุด) → ประมาณการ = × 50%
        Map<String, Double> est = new LinkedHashMap<>();
        for (Object row : em.createNativeQuery(
                "select b.ref_code, coalesce(sum(nullif(so.data->>'saleAmount','')::numeric),0) "
                + "from basket b join basket_item bi on bi.basket_id=b.id "
                + "join sales_document so on so.company_id=b.company_id and so.doc_type='SO' and so.customer_ref=bi.customer_ref "
                + "where b.company_id=cast(:cid as uuid) and b.ref_type='CL' group by b.ref_code")
                .setParameter("cid", cid).getResultList()) {
            Object[] r = (Object[]) row; est.put((String) r[0], ((Number) r[1]).doubleValue() * 0.5);
        }
        // เงื่อนไขที่เลือก (ประวัติการดึง — ไม่เอา REMOVE)
        Map<String, String> cond = new LinkedHashMap<>();
        for (Object row : em.createNativeQuery(
                "select cl_code, string_agg(distinct detail, ' · ') from cl_pull_log "
                + "where company_id=cast(:cid as uuid) and method<>'REMOVE' and nullif(detail,'') is not null group by cl_code")
                .setParameter("cid", cid).getResultList()) {
            Object[] r = (Object[]) row; cond.put((String) r[0], (String) r[1]);
        }
        // วันติดต่อล่าสุด (CALL_RESULT subject=CL)
        Map<String, Instant> last = new LinkedHashMap<>();
        for (Object row : em.createNativeQuery(
                "select subject_code, max(occurred_at) from activity "
                + "where company_id=cast(:cid as uuid) and subject_type='CL' and kind='CALL_RESULT' group by subject_code")
                .setParameter("cid", cid).getResultList()) {
            Object[] r = (Object[]) row; last.put((String) r[0], toInstant(r[1]));
        }
        // วันที่นัด (เร็วสุดที่ยังไม่เสร็จ) ref_type=CL
        Map<String, String> appt = new LinkedHashMap<>();
        for (Object row : em.createNativeQuery(
                "select ref_code, min(activity_date) from calendar_event "
                + "where company_id=cast(:cid as uuid) and ref_type='CL' and status<>'DONE' group by ref_code")
                .setParameter("cid", cid).getResultList()) {
            Object[] r = (Object[]) row; appt.put((String) r[0], r[1] == null ? null : String.valueOf(r[1]));
        }
        Map<String, Long> fo = countBySrcCl("FO", cid), qt = countBySrcCl("QT", cid), so = countBySrcCl("SO", cid);

        java.util.Set<String> codes = new java.util.LinkedHashSet<>();
        codes.addAll(est.keySet()); codes.addAll(cond.keySet()); codes.addAll(last.keySet());
        codes.addAll(appt.keySet()); codes.addAll(fo.keySet()); codes.addAll(qt.keySet()); codes.addAll(so.keySet());

        List<BoxRow> out = new ArrayList<>(codes.size());
        for (String c : codes) {
            out.add(new BoxRow(c, est.getOrDefault(c, 0.0), cond.get(c), last.get(c), appt.get(c),
                    fo.getOrDefault(c, 0L), qt.getOrDefault(c, 0L), so.getOrDefault(c, 0L)));
        }
        return out;
    }

    private Map<String, Long> countBySrcCl(String docType, String cid) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Object row : em.createNativeQuery(
                "select src_cl, count(*) from sales_document where company_id=cast(:cid as uuid) and doc_type=:dt and src_cl is not null group by src_cl")
                .setParameter("cid", cid).setParameter("dt", docType).getResultList()) {
            Object[] r = (Object[]) row; m.put((String) r[0], ((Number) r[1]).longValue());
        }
        return m;
    }

    /** ===== ผลดำเนินการ: เฉพาะที่ "อ้างอิง CL นี้" (src_cl / subject=CL) ===== */
    public record OpsSummary(long callCount, long callDistinct,
                             long foCount, long qtCount, long soCount,
                             double qtEstimate, double soSales) {}

    @Transactional(readOnly = true)
    public OpsSummary ops(String clCode) {
        UUID tenant = TenantContext.required();
        String cid = tenant.toString();

        // "โทรแล้ว" = ผลโทร (CALL_RESULT) หรือการสื่อสาร (COMMUNICATION) ที่บันทึกในชุด CL นี้
        long callCount = ((Number) em.createNativeQuery(
                "select count(*) from activity where company_id=cast(:cid as uuid) "
                + "and kind in ('CALL_RESULT','COMMUNICATION') and subject_type='CL' and subject_code=:cl")
                .setParameter("cid", cid).setParameter("cl", clCode).getSingleResult()).longValue();
        long callDistinct = ((Number) em.createNativeQuery(
                "select count(distinct customer_code) from activity where company_id=cast(:cid as uuid) "
                + "and kind in ('CALL_RESULT','COMMUNICATION') and subject_type='CL' and subject_code=:cl and customer_code is not null")
                .setParameter("cid", cid).setParameter("cl", clCode).getSingleResult()).longValue();

        long foCount = srcClCount("FO", cid, clCode);
        long qtCount = srcClCount("QT", cid, clCode);
        long soCount = srcClCount("SO", cid, clCode);
        double qtEstimate = srcClSum("QT", "netAmount", cid, clCode);   // ราคาเสนอใน QT
        double soSales = srcClSum("SO", "saleAmount", cid, clCode);     // ยอดขายใน SO

        return new OpsSummary(callCount, callDistinct, foCount, qtCount, soCount, qtEstimate, soSales);
    }

    private long srcClCount(String docType, String cid, String clCode) {
        return ((Number) em.createNativeQuery(
                "select count(*) from sales_document where company_id=cast(:cid as uuid) and doc_type=:dt and src_cl=:cl")
                .setParameter("cid", cid).setParameter("dt", docType).setParameter("cl", clCode).getSingleResult()).longValue();
    }

    private double srcClSum(String docType, String key, String cid, String clCode) {
        return ((Number) em.createNativeQuery(
                "select coalesce(sum(nullif(d.data->>'" + key + "','')::numeric),0) from sales_document d "
                + "where d.company_id=cast(:cid as uuid) and d.doc_type=:dt and d.src_cl=:cl")
                .setParameter("cid", cid).setParameter("dt", docType).setParameter("cl", clCode).getSingleResult()).doubleValue();
    }

    /** ลูกค้าที่มี FO อ้างอิง CL นี้ (เจาะจงด้วย src_cl) — ไม่โหลด FO ทั้งบริษัทมา filter ที่ client */
    @Transactional(readOnly = true)
    public List<String> foCustomers(String clCode) {
        UUID tenant = TenantContext.required();
        @SuppressWarnings("unchecked")
        List<String> r = em.createNativeQuery(
                "select distinct customer_ref from sales_document where company_id=cast(:cid as uuid) "
                + "and doc_type='FO' and src_cl=:cl and customer_ref is not null")
                .setParameter("cid", tenant.toString()).setParameter("cl", clCode).getResultList();
        return r;
    }

    private long countDocs(String docType, String cid, List<String> codes) {
        return ((Number) em.createNativeQuery(
                "select count(*) from sales_document where company_id=cast(:cid as uuid) and doc_type=:dt and customer_ref in (:codes)")
                .setParameter("cid", cid).setParameter("dt", docType).setParameter("codes", codes).getSingleResult()).longValue();
    }

    private List<String> soDistinct(String key, String cid, List<String> codes) {
        // key มาจากชุดคงที่ (salesTechnique/closedService) — ไม่มีค่าจากผู้ใช้
        @SuppressWarnings("unchecked")
        List<String> r = em.createNativeQuery(
                "select distinct d.data->>'" + key + "' v from sales_document d "
                + "where d.company_id=cast(:cid as uuid) and d.doc_type='SO' and d.customer_ref in (:codes) "
                + "and nullif(d.data->>'" + key + "','') is not null order by v")
                .setParameter("cid", cid).setParameter("codes", codes).getResultList();
        return r;
    }

    private static List<NameCount> nameCounts(List<?> rows) {
        List<NameCount> out = new ArrayList<>(rows.size());
        for (Object row : rows) { Object[] r = (Object[]) row; out.add(new NameCount((String) r[0], ((Number) r[1]).longValue())); }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<String> strings(List<?> rows) { return (List<String>) rows; }

    /** บันทึกผลการโทร 1 ครั้ง → ใช้ผลล่าสุดเป็นสถานะของรายคน */
    @Transactional
    public void saveCall(String clCode, String customerRef, String result, Integer minutes, String note, String by) {
        UUID tenant = TenantContext.required();
        ClCallLog l = new ClCallLog();
        l.setCompanyId(tenant);
        l.setClCode(clCode);
        l.setCustomerCode(customerRef);
        l.setResult(result == null || result.isBlank() ? "NOANSWER" : result.trim());
        l.setMinutes(minutes);
        l.setNote(note);
        l.setCalledBy(by);
        l.setCalledAt(Instant.now());
        callLogRepository.save(l);
    }
}

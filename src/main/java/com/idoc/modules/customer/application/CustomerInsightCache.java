package com.idoc.modules.customer.application;

import com.idoc.modules.customer.api.CustomerInsightApi;
import com.idoc.shared.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Cache สรุป/รายงานลูกค้า — ของหนัก (สแกนลูกค้าทั้งบริษัท) ที่ "ไม่เปลี่ยนบ่อย"
 *
 * เก็บผลลัพธ์ใน heap ของแต่ละ instance (เร็ว) แต่ความถูกต้องข้าม instance อาศัย
 * "เลขเวอร์ชันต่อบริษัท" ที่เก็บใน Postgres (ตาราง cache_version) — ทุก instance อ่านเลขเดียวกัน
 *
 * ความสด 3 แกน:
 *  - แก้ข้อมูล: write path เรียก invalidate(companyId) → version+1 "ในทรานแซกชันเดียวกับการแก้"
 *    → commit แล้วทุก instance เห็นเลขใหม่ พอ key เปลี่ยนก็คำนวณใหม่รอบเดียว (rollback ก็ไม่ค้าง)
 *  - ข้าม instance: เพราะ version อยู่ที่ DB กลาง ไม่ใช่ RAM ของ instance ใคร instance มัน
 *  - ข้ามวัน: ตัวกรอง "พร้อมใช้" อิงวันนี้ (เกิน N เดือน / นัด ±D วัน) → ฝัง today ในถัง พอข้ามวันสร้างถังใหม่
 *
 * ราคาที่จ่าย: อ่าน version 1 ครั้งต่อ request (PK lookup ~ไมโครวิ) แทนการสแกนลูกค้าทั้งตาราง
 */
@Component
public class CustomerInsightCache implements CustomerInsightApi {

    @PersistenceContext
    private EntityManager em;

    /** ถังของบริษัทหนึ่ง ผูกกับ (เวอร์ชัน, วัน) — version หรือวันเปลี่ยน = ถังหมดอายุทั้งใบ */
    private record Bucket(long version, String day, Map<String, Object> entries) {}

    private final Map<UUID, Bucket> byCompany = new ConcurrentHashMap<>();

    /**
     * อ่านจาก cache (ของบริษัทปัจจุบันตาม TenantContext) — ไม่มี/เวอร์ชันเก่า ค่อยคำนวณด้วย loader
     * เรียกจากเมธอด @Transactional(readOnly) เสมอ → มี EntityManager ให้ query version
     * @param name   ชื่อชุดข้อมูล (เช่น "groupCounts", "salesBuckets", "recentMovements")
     * @param params ลายเซ็นพารามิเตอร์ที่ทำให้ผลต่างกัน (filter ต่าง = key ต่าง)
     */
    @SuppressWarnings("unchecked")
    public <T> T get(String name, String params, Supplier<T> loader) {
        UUID company = TenantContext.required();
        long ver = currentVersion(company);
        String today = LocalDate.now().toString();
        Bucket b = byCompany.compute(company, (k, cur) ->
                (cur != null && cur.version() == ver && cur.day().equals(today))
                        ? cur : new Bucket(ver, today, new ConcurrentHashMap<>()));
        return (T) b.entries().computeIfAbsent(name + "|" + params, k -> loader.get());
    }

    @Override
    public void invalidate(UUID companyId) {
        if (companyId == null) return;
        // version+1 ในทรานแซกชันของการเขียนเอง → commit พร้อมข้อมูล ทุก instance เห็นพร้อมกัน
        em.createNativeQuery(
                "insert into cache_version (company_id, version) values (cast(?1 as uuid), 1) "
                + "on conflict (company_id) do update set version = cache_version.version + 1")
          .setParameter(1, companyId.toString())
          .executeUpdate();
    }

    /** เวอร์ชันปัจจุบันของบริษัท (ยังไม่เคยมี write = 0) */
    private long currentVersion(UUID company) {
        List<?> r = em.createNativeQuery("select version from cache_version where company_id = cast(?1 as uuid)")
                .setParameter(1, company.toString())
                .getResultList();
        return r.isEmpty() ? 0L : ((Number) r.get(0)).longValue();
    }
}

package com.idoc.modules.product.domain;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

/**
 * ค้นหาสินค้า/บริการด้วย native SQL (รองรับ JSONB attributes) — สร้าง where แบบไดนามิก
 * ค่าที่ค้นเป็น parameter เสมอ (กัน SQL injection) · key ของ attributes ผ่าน whitelist [A-Za-z0-9_]
 */
public class ProductRepositoryImpl implements ProductRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

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
    public Page<Product> search(UUID companyId, String q, Map<String, String> filters, Pageable pageable) {
        // สถานะคุมด้วยฟิลเตอร์ status (แท็บในหน้า list) — ไม่ฮาร์ดโค้ด ACTIVE แล้ว
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) ");
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());

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

        String base = " from product c " + where;

        Query countQ = em.createNativeQuery("select count(*) " + base);
        params.forEach(countQ::setParameter);
        long total = ((Number) countQ.getSingleResult()).longValue();

        Query dataQ = em.createNativeQuery("select c.* " + base + " order by c.created_at desc", Product.class);
        params.forEach(dataQ::setParameter);
        dataQ.setFirstResult((int) pageable.getOffset());
        dataQ.setMaxResults(pageable.getPageSize());
        @SuppressWarnings("unchecked")
        List<Product> content = dataQ.getResultList();

        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public List<Product> lookup(UUID companyId, String q, int limit) {
        String s = q == null ? "" : q.trim().toLowerCase();
        StringBuilder where = new StringBuilder(" where c.company_id = cast(:cid as uuid) and c.status = 'ACTIVE' ");
        Map<String, Object> params = new HashMap<>();
        params.put("cid", companyId.toString());
        if (!s.isEmpty()) {
            // substring (%q%) ของรหัส/ชื่อ — พิมพ์คำกลางชื่อก็เจอ (เช่น "GMP" เจอ "อบรม GMP")
            where.append(" and (lower(c.code) like :p or lower(c.name) like :p) ");
            params.put("p", "%" + s + "%");
        }
        Query dataQ = em.createNativeQuery("select c.* from product c " + where + " order by c.name asc", Product.class);
        params.forEach(dataQ::setParameter);
        dataQ.setMaxResults(Math.max(1, Math.min(limit, 50)));
        @SuppressWarnings("unchecked")
        List<Product> content = dataQ.getResultList();
        return content;
    }
}

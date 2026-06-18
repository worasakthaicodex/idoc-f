package com.idoc.modules.customer.application;

import com.idoc.modules.customer.application.dto.AddBasketResult;
import com.idoc.modules.customer.application.dto.AddToBasketRequest;
import com.idoc.modules.customer.application.dto.BasketDto;
import com.idoc.modules.customer.domain.Basket;
import com.idoc.modules.customer.domain.BasketItem;
import com.idoc.modules.customer.domain.BasketItemRepository;
import com.idoc.modules.customer.domain.BasketRepository;
import com.idoc.modules.customer.domain.BasketShare;
import com.idoc.modules.customer.domain.BasketShareRepository;
import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.BasketRow;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.tenant.TenantContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class BasketServiceImpl implements BasketService {

    private final BasketRepository basketRepository;
    private final BasketItemRepository basketItemRepository;
    private final BasketShareRepository basketShareRepository;
    private final CustomerRepository customerRepository;
    private final CustomerInsightCache insightCache;   // ตะกร้าเปลี่ยน → ตัวกรอง "ไม่อยู่ในตะกร้าฉัน" บนหน้า groups เปลี่ยน

    @Override
    @Transactional(readOnly = true)
    public List<BasketDto> list(String owner) {
        UUID tenant = TenantContext.required();
        return basketRepository.findVisible(tenant, safeOwner(owner)).stream()
                .map(b -> new BasketDto(b.getId(), b.getName(), basketItemRepository.countByBasketId(b.getId()), b.getOwner(), b.getNote()))
                .toList();
    }

    @Override
    public BasketDto create(String owner, String name) {
        Basket b = new Basket();
        b.setCompanyId(TenantContext.required());
        b.setOwner(safeOwner(owner));
        b.setName(name == null || name.isBlank() ? "ตะกร้าใหม่" : name.trim());
        b = basketRepository.save(b);
        return new BasketDto(b.getId(), b.getName(), 0, b.getOwner(), b.getNote());
    }

    @Override
    public BasketDto update(UUID basketId, String name, String note) {
        Basket b = require(basketId);
        if (name != null && !name.isBlank()) b.setName(name.trim());
        b.setNote(note == null || note.isBlank() ? null : note.trim());
        b = basketRepository.save(b);
        return new BasketDto(b.getId(), b.getName(), basketItemRepository.countByBasketId(b.getId()), b.getOwner(), b.getNote());
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> shares(UUID basketId) {
        require(basketId);
        return basketShareRepository.findByBasketId(basketId).stream().map(BasketShare::getSharedWith).toList();
    }

    @Override
    public void setShares(UUID basketId, List<String> users) {
        Basket b = require(basketId);
        basketShareRepository.deleteByBasketId(basketId);
        if (users != null) {
            users.stream().map(u -> u == null ? "" : u.trim()).filter(u -> !u.isBlank()).distinct().forEach(u -> {
                BasketShare s = new BasketShare();
                s.setBasketId(basketId);
                s.setSharedWith(u);
                basketShareRepository.save(s);
            });
        }
        insightCache.invalidate(b.getCompanyId());   // ผู้ที่แชร์ให้เปลี่ยน → ตะกร้าที่ "ฉันเห็น" เปลี่ยน
    }

    @Override
    public void delete(UUID basketId) {
        Basket b = require(basketId);
        basketRepository.delete(b);   // basket_item ลบตาม (on delete cascade)
        insightCache.invalidate(b.getCompanyId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BasketRow> items(UUID basketId) {
        Basket b = require(basketId);
        return customerRepository.basketItems(b.getCompanyId(), b.getId());
    }

    @Override
    public AddBasketResult add(UUID basketId, AddToBasketRequest req) {
        Basket b = require(basketId);
        List<String> codes;
        if (req.codes() != null && !req.codes().isEmpty()) {
            codes = req.codes();
        } else {
            Integer m = req.sinceContactMonths(), d = req.calendarDays();
            if (req.ready() == null || "all".equals(req.ready())) { m = null; d = null; }
            int limit = req.limit() == null || req.limit() < 1 ? 60 : req.limit();
            UUID excl = Boolean.TRUE.equals(req.onlyNew()) ? basketId : null;   // เฉพาะที่ยังไม่อยู่ในตะกร้านี้
            codes = customerRepository.resolveCodes(b.getCompanyId(), req.field(), req.value(),
                    req.bucket(), req.year(), req.ready(), m, d, excl, false, limit);
        }
        LocalDate removeBy = parseDate(req.removeBy());
        String reason = req.reason() == null || req.reason().isBlank() ? null : req.reason().trim();

        // ใครถือลูกค้าเหล่านี้ไว้แล้ว (ทั้งบริษัท) — 1 ราย อยู่ได้ตะกร้าเดียว
        Map<String, Object[]> holders = new HashMap<>();
        List<String> trimmed = codes.stream().filter(c -> c != null && !c.isBlank()).map(String::trim).distinct().toList();
        if (!trimmed.isEmpty()) {
            for (Object[] r : basketItemRepository.findHolders(b.getCompanyId(), trimmed)) {
                holders.putIfAbsent((String) r[0], r);   // [code, basketId, owner, name]
            }
        }

        List<AddBasketResult.Held> conflicts = new ArrayList<>();
        int added = 0;
        for (String code : trimmed) {
            Object[] h = holders.get(code);
            if (h != null) {
                if (basketId.equals(h[1])) continue;     // อยู่ในตะกร้านี้อยู่แล้ว — ข้ามเฉย ๆ
                conflicts.add(new AddBasketResult.Held(code, (String) h[2], (String) h[3]));   // คนอื่นถือไว้
                continue;
            }
            BasketItem it = new BasketItem();
            it.setBasketId(basketId);
            it.setCustomerRef(code);
            it.setAddedAt(Instant.now());
            it.setReason(reason);
            it.setRemoveBy(removeBy);
            basketItemRepository.save(it);
            added++;
        }
        if (added > 0) insightCache.invalidate(b.getCompanyId());   // มีคนเข้าตะกร้า → ยอดกลุ่มฝั่ง "ไม่อยู่ในตะกร้า" เปลี่ยน
        return new AddBasketResult(added, conflicts);
    }

    @Override
    public void removeItem(UUID basketId, String customerRef) {
        Basket b = require(basketId);
        basketItemRepository.deleteByBasketIdAndCustomerRef(basketId, customerRef);
        insightCache.invalidate(b.getCompanyId());
    }

    @Override
    public void updateItem(UUID basketId, String customerRef, String reason, String removeBy) {
        require(basketId);
        BasketItem it = basketItemRepository.findByBasketIdAndCustomerRef(basketId, customerRef)
                .orElseThrow(() -> new BusinessException("ไม่พบรายการในตะกร้า"));
        it.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        it.setRemoveBy(parseDate(removeBy));
        basketItemRepository.save(it);
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDate.parse(s.trim()); } catch (Exception e) { return null; }
    }

    private Basket require(UUID basketId) {
        return basketRepository.findByIdAndCompanyId(basketId, TenantContext.required())
                .orElseThrow(() -> new BusinessException("ไม่พบตะกร้า"));
    }

    private static String safeOwner(String owner) {
        return owner == null || owner.isBlank() ? "-" : owner.trim();
    }
}

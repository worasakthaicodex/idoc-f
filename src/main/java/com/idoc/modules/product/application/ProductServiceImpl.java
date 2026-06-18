package com.idoc.modules.product.application;

import com.idoc.modules.company.api.CompanyApi;
import com.idoc.modules.product.application.dto.CreateProductRequest;
import com.idoc.modules.product.application.dto.ProductResponse;
import com.idoc.modules.product.application.dto.UpdateProductRequest;
import com.idoc.modules.product.domain.Product;
import com.idoc.modules.product.domain.ProductRepository;
import com.idoc.modules.product.domain.ProductSequence;
import com.idoc.modules.product.domain.ProductSequenceRepository;
import com.idoc.modules.product.domain.ProductStatus;
import com.idoc.modules.revision.api.RevisionApi;
import com.idoc.shared.exception.BusinessException;
import com.idoc.shared.exception.ResourceNotFoundException;
import com.idoc.shared.tenant.TenantContext;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    private static final String ENTITY = "PRODUCT";

    private final ProductRepository productRepository;
    private final ProductSequenceRepository sequenceRepository;
    private final CompanyApi companyApi;
    private final RevisionApi revisionApi;

    @Override
    public ProductResponse create(CreateProductRequest request) {
        UUID tenant = TenantContext.required();
        if (!companyApi.isActive(tenant)) {
            throw new BusinessException("บริษัทนี้ไม่พร้อมใช้งาน (ถูกระงับ/หมดอายุ)");
        }
        String code = nextProductCode(tenant);
        Product p = Product.create(tenant, code, request.name(), request.groupName());
        p.setStatus(request.status());
        p.setAttributes(request.attributes());
        productRepository.save(p);
        revisionApi.record(ENTITY, p.getId(), p.getCode(), "CREATE", request.changedBy(), snapshot(p));
        return ProductMapper.toResponse(p);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse get(UUID id) {
        return ProductMapper.toResponse(findScoped(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponse> search(String q, Map<String, String> filters, Pageable pageable) {
        return productRepository.search(TenantContext.required(), q, filters, pageable)
                .map(ProductMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<ProductResponse> lookup(String q, int limit) {
        return productRepository.lookup(TenantContext.required(), q, limit)
                .stream().map(ProductMapper::toResponse).toList();
    }

    @Override
    public ProductResponse update(UUID id, UpdateProductRequest request) {
        Product p = findScoped(id);
        p.updateProfile(request.name(), request.groupName());
        p.setStatus(request.status());
        p.setAttributes(request.attributes());
        revisionApi.record(ENTITY, p.getId(), p.getCode(), "UPDATE", request.changedBy(), snapshot(p));
        return ProductMapper.toResponse(p);
    }

    @Override
    public void delete(UUID id) {
        productRepository.delete(findScoped(id));
    }

    @Override
    public ProductResponse revert(UUID id, UUID revisionId, String changedBy) {
        Product p = findScoped(id);
        Map<String, Object> snap = revisionApi.snapshot(revisionId);
        p.updateProfile(str(snap.get("name")), str(snap.get("groupName")));
        Object st = snap.get("status");
        if (st != null) p.setStatus(ProductStatus.valueOf(st.toString()));
        Map<String, String> attrs = new HashMap<>();
        if (snap.get("attributes") instanceof Map<?, ?> m) {
            m.forEach((k, v) -> attrs.put(String.valueOf(k), v == null ? null : String.valueOf(v)));
        }
        p.setAttributes(attrs);
        revisionApi.record(ENTITY, p.getId(), p.getCode(), "REVERT", changedBy, snapshot(p));
        return ProductMapper.toResponse(p);
    }

    private Map<String, Object> snapshot(Product p) {
        Map<String, Object> s = new HashMap<>();
        s.put("name", p.getName());
        s.put("groupName", p.getGroupName());
        s.put("status", p.getStatus().name());
        s.put("attributes", p.getAttributes());
        return s;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private Product findScoped(UUID id) {
        return productRepository.findByIdAndCompanyId(id, TenantContext.required())
                .orElseThrow(() -> ResourceNotFoundException.of("Product", id));
    }

    /** ออกรหัสสินค้าแบบรันต่อบริษัท: PRD{ปีเดือน}-{เลขรัน} เช่น PRD202606-1 */
    private String nextProductCode(UUID tenant) {
        ProductSequence seq = sequenceRepository.findForUpdate(tenant)
                .orElseGet(() -> sequenceRepository.save(new ProductSequence(tenant)));
        long n = seq.nextProduct();
        return "PRD" + LocalDate.now().format(YM) + "-" + n;
    }
}

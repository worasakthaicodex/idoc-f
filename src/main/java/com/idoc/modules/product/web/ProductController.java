package com.idoc.modules.product.web;

import com.idoc.modules.product.application.ProductService;
import com.idoc.modules.product.application.dto.CreateProductRequest;
import com.idoc.modules.product.application.dto.ProductResponse;
import com.idoc.modules.product.application.dto.UpdateProductRequest;
import com.idoc.shared.access.AccessGuard;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** tenant มาจาก header X-Company-Id (ผ่าน TenantFilter -> TenantContext) */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    /** ค้นหา/รายการสินค้า (ค้นจริงที่ DB) — q = ค้นง่าย, พารามิเตอร์อื่น ๆ = ค้นเต็มพิกัดรายฟิลด์ */
    @GetMapping
    public Page<ProductResponse> list(@RequestParam(required = false) String q,
                                      @RequestParam Map<String, String> params,
                                      Pageable pageable) {
        Map<String, String> filters = new HashMap<>(params);
        filters.remove("q");
        filters.remove("page");
        filters.remove("size");
        filters.remove("sort");
        return productService.search(q, filters, pageable);
    }

    /** ค้นเร็วสำหรับ dropdown (prefix รหัส/ชื่อ ส่วนหน้า) — ใช้กับช่องเลือกสินค้าในตารางย่อย QT รองรับสินค้าจำนวนมาก */
    @GetMapping("/lookup")
    public java.util.List<ProductResponse> lookup(@RequestParam(required = false) String q,
                                                  @RequestParam(defaultValue = "20") int limit) {
        return productService.lookup(q, limit);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable UUID id) {
        return productService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request) {
        AccessGuard.requireAdmin(AccessGuard.PRODUCT);
        return productService.create(request);
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateProductRequest request) {
        AccessGuard.requireAdmin(AccessGuard.PRODUCT);
        return productService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        productService.delete(id);
    }

    @PostMapping("/{id}/revert/{revisionId}")
    public ProductResponse revert(@PathVariable UUID id, @PathVariable UUID revisionId,
                                  @RequestParam(required = false) String by) {
        AccessGuard.requireAdmin(AccessGuard.PRODUCT);
        return productService.revert(id, revisionId, by);
    }
}

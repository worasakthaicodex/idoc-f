package com.idoc.modules.customer.web;

import com.idoc.modules.customer.application.BasketService;
import com.idoc.modules.customer.application.dto.AddBasketResult;
import com.idoc.modules.customer.application.dto.AddToBasketRequest;
import com.idoc.modules.customer.application.dto.BasketDto;
import com.idoc.modules.customer.domain.CustomerRepositoryCustom.BasketRow;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** ตะกร้ารายชื่อลูกค้า — owner = รหัสพนักงาน (ผู้ใช้) · tenant จาก X-Company-Id */
@RestController
@RequestMapping("/api/baskets")
@RequiredArgsConstructor
public class BasketController {

    private final BasketService basketService;

    @GetMapping
    public List<BasketDto> list(@RequestParam String owner) {
        return basketService.list(owner);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BasketDto create(@RequestParam String owner, @RequestBody Map<String, String> body) {
        return basketService.create(owner, body.get("name"));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        basketService.delete(id);
    }

    /** แก้ชื่อ/เหตุผลรวมของตะกร้า */
    @org.springframework.web.bind.annotation.PatchMapping("/{id}")
    public BasketDto update(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return basketService.update(id, body.get("name"), body.get("note"));
    }

    @GetMapping("/{id}/items")
    public List<BasketRow> items(@PathVariable UUID id) {
        return basketService.items(id);
    }

    /** ใส่ลงตะกร้า (codes / ยกก้อนจากกลุ่ม-bucket) — คืน {added, conflicts:[{code,owner,basketName}]} */
    @PostMapping("/{id}/add")
    public AddBasketResult add(@PathVariable UUID id, @RequestBody AddToBasketRequest req) {
        return basketService.add(id, req);
    }

    @DeleteMapping("/{id}/items/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable UUID id, @PathVariable String code) {
        basketService.removeItem(id, code);
    }

    /** แก้เหตุผล/วันที่ต้องหยิบออกของรายการในตะกร้า */
    @org.springframework.web.bind.annotation.PatchMapping("/{id}/items/{code}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateItem(@PathVariable UUID id, @PathVariable String code, @RequestBody Map<String, String> body) {
        basketService.updateItem(id, code, body.get("reason"), body.get("removeBy"));
    }

    /** ผู้ใช้ที่ตะกร้านี้แชร์ให้ (รหัสพนักงาน) */
    @GetMapping("/{id}/shares")
    public List<String> shares(@PathVariable UUID id) {
        return basketService.shares(id);
    }

    /** ตั้งรายชื่อผู้ที่แชร์ให้ (แทนที่ทั้งหมด) */
    @org.springframework.web.bind.annotation.PutMapping("/{id}/shares")
    public Map<String, Integer> setShares(@PathVariable UUID id, @RequestBody Map<String, List<String>> body) {
        List<String> users = body.getOrDefault("users", List.of());
        basketService.setShares(id, users);
        return Map.of("shared", users == null ? 0 : users.size());
    }
}

package com.idoc.modules.appmodule.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** โมดูลของระบบ (global catalog) — ใช้ให้ตำแหน่งเลือกผูกสิทธิ์ */
@Entity
@Table(name = "app_module")
@Getter
@NoArgsConstructor
public class AppModule extends BaseEntity {

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "name_en", length = 120)
    private String nameEn;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active = true;

    public static AppModule create(String code, String name, String nameEn, int sortOrder) {
        AppModule m = new AppModule();
        m.code = code;
        m.name = name;
        m.nameEn = nameEn;
        m.sortOrder = sortOrder;
        m.active = true;
        return m;
    }

    public void updateDetails(String name, String nameEn, Integer sortOrder, Boolean active) {
        if (name != null && !name.isBlank()) this.name = name;
        this.nameEn = nameEn;
        if (sortOrder != null) this.sortOrder = sortOrder;
        if (active != null) this.active = active;
    }
}

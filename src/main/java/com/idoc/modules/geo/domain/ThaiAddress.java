package com.idoc.modules.geo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;

/** ตารางอ้างอิงที่อยู่ไทย (global reference, ไม่ผูก tenant) */
@Entity
@Table(name = "thai_address")
@Getter
public class ThaiAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "sub_district", nullable = false)
    private String subDistrict;

    @Column(nullable = false)
    private String district;

    @Column(nullable = false)
    private String province;

    @Column(nullable = false)
    private String zipcode;
}

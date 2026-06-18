package com.idoc.modules.company.api;

import java.util.Optional;
import java.util.UUID;

/**
 * สัญญา (published API) ของ Company module ที่ module อื่นเรียกใช้ได้
 *
 * กติกาการคุยข้าม module: import ได้เฉพาะ package `api` ของ module อื่นเท่านั้น
 * ห้าม import domain/application/web ของ module อื่นโดยตรง → ผูกกันหลวม เพิ่ม/แก้ module ไม่กระทบกัน
 */
public interface CompanyApi {

    Optional<CompanyView> findById(UUID id);

    boolean isActive(UUID id);
}

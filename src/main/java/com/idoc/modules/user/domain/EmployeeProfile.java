package com.idoc.modules.user.domain;

import java.time.LocalDate;

/**
 * ข้อมูลพนักงานที่แก้ไขได้ (รวมเป็นก้อนเดียว เพราะฟิลด์เยอะ)
 * domain carrier — ไม่ผูกกับ DTO ของ web
 */
public record EmployeeProfile(
        // ทั่วไป
        String fullName,
        LocalDate birthday,
        String idCard,
        String position,
        // ติดต่อ
        String email,
        String tel,
        String mobile,
        String line,
        // ที่อยู่
        String houseNumber,
        String building,
        String village,
        String alley,
        String road,
        String subDistrict,
        String province,
        String zip,
        String address,
        String addressFull,
        // เอกสาร/พาสปอร์ต
        String passportNo,
        LocalDate passportDate,
        String passportCountry,
        String passportDistrict
) {
}

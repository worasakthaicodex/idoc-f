package com.idoc.modules.user.application.dto;

import com.idoc.modules.user.domain.EmployeeRole;
import com.idoc.modules.user.domain.EmployeeStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record EmployeeResponse(
        UUID id,
        UUID companyId,
        String code,
        EmployeeRole role,
        EmployeeStatus status,
        boolean canLogin,
        boolean googleEnabled,
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
        // เอกสาร
        String passportNo,
        LocalDate passportDate,
        String passportCountry,
        String passportDistrict,
        Map<String, String> attributes,
        Instant createdAt
) {
}

package com.idoc.modules.user.application;

import com.idoc.modules.user.application.dto.CreateEmployeeRequest;
import com.idoc.modules.user.application.dto.EmployeeResponse;
import com.idoc.modules.user.application.dto.UpdateEmployeeRequest;
import com.idoc.modules.user.domain.Employee;
import com.idoc.modules.user.domain.EmployeeProfile;

final class EmployeeMapper {

    private EmployeeMapper() {
    }

    static EmployeeResponse toResponse(Employee e) {
        return new EmployeeResponse(
                e.getId(), e.getCompanyId(), e.getCode(), e.getRole(), e.getStatus(),
                e.getPasswordHash() != null,
                e.isGoogleEnabled(),
                e.getFullName(), e.getBirthday(), e.getIdCard(), e.getPosition(),
                e.getEmail(), e.getTel(), e.getMobile(), e.getLine(),
                e.getHouseNumber(), e.getBuilding(), e.getVillage(), e.getAlley(), e.getRoad(),
                e.getSubDistrict(), e.getProvince(), e.getZip(), e.getAddress(), e.getAddressFull(),
                e.getPassportNo(), e.getPassportDate(), e.getPassportCountry(), e.getPassportDistrict(),
                e.getAttributes(),
                e.getCreatedAt());
    }

    static EmployeeProfile profile(CreateEmployeeRequest r) {
        return new EmployeeProfile(
                r.fullName(), r.birthday(), r.idCard(), r.position(),
                r.email(), r.tel(), r.mobile(), r.line(),
                r.houseNumber(), r.building(), r.village(), r.alley(), r.road(),
                r.subDistrict(), r.province(), r.zip(), r.address(), r.addressFull(),
                r.passportNo(), r.passportDate(), r.passportCountry(), r.passportDistrict());
    }

    static EmployeeProfile profile(UpdateEmployeeRequest r) {
        return new EmployeeProfile(
                r.fullName(), r.birthday(), r.idCard(), r.position(),
                r.email(), r.tel(), r.mobile(), r.line(),
                r.houseNumber(), r.building(), r.village(), r.alley(), r.road(),
                r.subDistrict(), r.province(), r.zip(), r.address(), r.addressFull(),
                r.passportNo(), r.passportDate(), r.passportCountry(), r.passportDistrict());
    }
}

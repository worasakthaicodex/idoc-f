package com.idoc.modules.companymodule.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyModuleRepository extends JpaRepository<CompanyModule, UUID> {

    List<CompanyModule> findByCompanyId(UUID companyId);
}

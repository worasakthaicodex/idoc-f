package com.idoc.modules.appmodule.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppModuleRepository extends JpaRepository<AppModule, UUID> {

    List<AppModule> findByActiveTrueOrderBySortOrderAscNameAsc();

    List<AppModule> findAllByOrderBySortOrderAscNameAsc();

    boolean existsByCode(String code);
}

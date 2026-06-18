package com.idoc.modules.workflow.domain;

import com.idoc.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * เอกสารสิทธิ์ (authorities/กรอบ) ของวงจรชีวิตเอกสาร — 1 แถวต่อ (บริษัท + ประเภทเอกสาร)
 * เก็บเป็น JSONB list (โครงยืดหยุ่น: name/note/assigns ฯลฯ) ไม่ต้อง migration ต่อฟิลด์
 */
@Entity
@Table(name = "workflow_authority_config")
@Getter
@NoArgsConstructor
public class WorkflowAuthorityConfig extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "doc_type", nullable = false, length = 40)
    private String docType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> authorities = new ArrayList<>();

    public static WorkflowAuthorityConfig create(UUID companyId, String docType, List<Map<String, Object>> authorities) {
        WorkflowAuthorityConfig c = new WorkflowAuthorityConfig();
        c.companyId = companyId;
        c.docType = docType;
        c.authorities = authorities != null ? authorities : new ArrayList<>();
        return c;
    }

    public void setAuthorities(List<Map<String, Object>> authorities) {
        this.authorities = authorities != null ? authorities : new ArrayList<>();
    }
}

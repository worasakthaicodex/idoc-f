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
 * ตั้งค่าขั้นตอน (stages) ของวงจรชีวิตเอกสาร — 1 แถวต่อ (บริษัท + ประเภทเอกสาร)
 * เก็บ stages เป็น JSONB (โครงยืดหยุ่น: id/name/kind/pinned/group/outcome ฯลฯ) ไม่ต้อง migration ต่อฟิลด์
 */
@Entity
@Table(name = "workflow_stage_config")
@Getter
@NoArgsConstructor
public class WorkflowStageConfig extends BaseEntity {

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "doc_type", nullable = false, length = 40)
    private String docType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> stages = new ArrayList<>();

    public static WorkflowStageConfig create(UUID companyId, String docType, List<Map<String, Object>> stages) {
        WorkflowStageConfig c = new WorkflowStageConfig();
        c.companyId = companyId;
        c.docType = docType;
        c.stages = stages != null ? stages : new ArrayList<>();
        return c;
    }

    public void setStages(List<Map<String, Object>> stages) {
        this.stages = stages != null ? stages : new ArrayList<>();
    }
}

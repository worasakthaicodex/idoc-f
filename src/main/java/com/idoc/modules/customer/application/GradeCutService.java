package com.idoc.modules.customer.application;

import com.idoc.modules.customer.domain.Customer;
import com.idoc.modules.customer.domain.CustomerRepository;
import com.idoc.modules.sales.domain.SalesDocument;
import com.idoc.modules.sales.domain.SalesDocumentRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ตัดเกรดลูกค้าของบริษัทหนึ่ง — คำนวณจากจำนวนครั้งที่เปิด SO (ใบสั่งขาย) ตามเกณฑ์ GradeConfig
 * แล้วอัปเดต attributes.grade ของลูกค้าที่เกรดเปลี่ยน (1 transaction ต่อบริษัท)
 */
@Service
@RequiredArgsConstructor
public class GradeCutService {

    private final CustomerRepository customerRepository;
    private final SalesDocumentRepository salesDocumentRepository;

    /** คืนจำนวนลูกค้าที่เกรดถูกเปลี่ยน */
    @Transactional
    public int cutForCompany(UUID companyId, GradeConfig cfg) {
        // วันเปิด SO ต่อรหัสลูกค้า
        Map<String, List<Long>> soDates = new HashMap<>();
        for (SalesDocument d : salesDocumentRepository.findByCompanyIdAndDocTypeOrderBySavedAtDesc(companyId, "SO")) {
            String ref = d.getCustomerRef();
            if (ref == null || ref.isBlank()) continue;
            soDates.computeIfAbsent(ref, k -> new ArrayList<>())
                    .add(d.getSavedAt() != null ? d.getSavedAt() : System.currentTimeMillis());
        }
        // ลูกค้าที่เคยมีเอกสารใด ๆ = "เคยติดต่อ"
        Set<String> contacted = new HashSet<>(salesDocumentRepository.findDistinctCustomerRefByCompanyId(companyId));

        int changed = 0;
        for (Customer c : customerRepository.findByCompanyId(companyId)) {
            String grade = cfg.gradeOf(soDates.get(c.getCode()), contacted.contains(c.getCode()));
            Map<String, String> attrs = c.getAttributes();
            String cur = attrs == null ? null : attrs.get("grade");
            if (grade.equals(cur)) continue;
            Map<String, String> copy = attrs == null ? new HashMap<>() : new HashMap<>(attrs);
            copy.put("grade", grade);
            c.setAttributes(copy);
            customerRepository.save(c);
            changed++;
        }
        return changed;
    }
}

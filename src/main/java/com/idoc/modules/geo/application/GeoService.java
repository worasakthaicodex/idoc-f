package com.idoc.modules.geo.application;

import com.idoc.modules.geo.application.dto.ThaiAddressResponse;
import com.idoc.modules.geo.domain.ThaiAddressRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GeoService {

    private final ThaiAddressRepository repository;

    @Transactional(readOnly = true)
    public List<ThaiAddressResponse> searchThaiAddress(String q) {
        if (q == null || q.trim().length() < 2) return List.of();
        return repository.search(q.trim(), PageRequest.of(0, 20)).stream()
                .map(a -> new ThaiAddressResponse(a.getSubDistrict(), a.getDistrict(), a.getProvince(), a.getZipcode()))
                .toList();
    }
}

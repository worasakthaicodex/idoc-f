package com.idoc.modules.geo.web;

import com.idoc.modules.geo.application.GeoService;
import com.idoc.modules.geo.application.dto.ThaiAddressResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** ค้นที่อยู่ไทย (global reference) — ไม่ต้องมี tenant */
@RestController
@RequestMapping("/api/geo")
@RequiredArgsConstructor
public class GeoController {

    private final GeoService geoService;

    @GetMapping("/thai-address")
    public List<ThaiAddressResponse> thaiAddress(@RequestParam(defaultValue = "") String q) {
        return geoService.searchThaiAddress(q);
    }
}

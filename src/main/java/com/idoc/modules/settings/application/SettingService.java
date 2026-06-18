package com.idoc.modules.settings.application;

import java.util.Map;

public interface SettingService {

    /** ค่าตั้งทั้งหมดของบริษัทปัจจุบัน (skey → value) */
    Map<String, Object> getAll();

    /** ตั้ง/แก้ค่า 1 key */
    void put(String key, Object value);
}

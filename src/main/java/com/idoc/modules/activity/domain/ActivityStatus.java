package com.idoc.modules.activity.domain;

/** ACTIVE = ใช้งาน · VOID = ขีดออก (รอ purge 6 เดือน, ยกเลิกได้) */
public enum ActivityStatus {
    ACTIVE,
    VOID
}

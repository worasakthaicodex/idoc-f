package com.idoc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * iDoc ERP — Modular Monolith (DDD)
 *
 * วางที่ package ราก com.idoc เพื่อให้ component scan / entity scan / repository scan
 * ครอบคลุมทุก module ใต้ com.idoc.modules.* และของกลาง com.idoc.shared.*
 */
@SpringBootApplication
public class IdocApplication {
    public static void main(String[] args) {
        SpringApplication.run(IdocApplication.class, args);
    }
}

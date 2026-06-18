package com.idoc.modules.division.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDivisionRequest(@NotBlank @Size(max = 120) String name) {
}

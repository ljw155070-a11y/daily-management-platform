package com.home.platform.finance.dto;

import java.math.BigDecimal;

public record MonthlyTrendDto(
        Integer year,
        Integer month,
        BigDecimal income,
        BigDecimal expense
) {
}

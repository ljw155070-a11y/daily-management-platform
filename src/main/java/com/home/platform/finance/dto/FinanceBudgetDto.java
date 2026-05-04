package com.home.platform.finance.dto;

import java.math.BigDecimal;

public record FinanceBudgetDto(
        Long id,
        Long categoryId,
        String categoryName,
        Integer budgetYear,
        Integer budgetMonth,
        BigDecimal amount,
        BigDecimal spent
) {
}

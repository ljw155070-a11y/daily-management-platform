package com.home.platform.finance.dto;

import java.math.BigDecimal;

public record FinanceBudgetSaveRequest(
        Long categoryId,
        Integer budgetYear,
        Integer budgetMonth,
        BigDecimal amount
) {
}

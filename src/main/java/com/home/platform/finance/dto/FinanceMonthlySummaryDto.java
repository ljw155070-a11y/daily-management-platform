package com.home.platform.finance.dto;

import java.math.BigDecimal;
import java.util.List;

public record FinanceMonthlySummaryDto(
        Integer year,
        Integer month,
        BigDecimal totalIncome,
        BigDecimal totalExpense,
        BigDecimal balance,
        List<CategorySummary> expenseByCategory
) {
    public record CategorySummary(
            Long categoryId,
            String categoryName,
            String icon,
            BigDecimal amount,
            double percentage
    ) {
    }
}

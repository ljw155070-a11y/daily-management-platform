package com.home.platform.finance.dto;

import java.math.BigDecimal;
import java.util.List;

public record FinanceMonthlySummaryDto(
        Integer year,
        Integer month,
        BigDecimal totalIncome,
        BigDecimal totalExpense,
        BigDecimal fixedExpense,
        BigDecimal variableExpense,
        BigDecimal dailyAverage,
        BigDecimal balance,
        List<MonthlyTrendDto> trend,
        List<MonthlyTrendDto> yearlyReport,
        List<CategorySummary> incomeByCategory,
        List<CategorySummary> expenseByCategory
) {
    public record CategorySummary(
            Long categoryId,
            String categoryName,
            String icon,
            BigDecimal amount,
            double percentage,
            Double changePercent
    ) {
    }
}

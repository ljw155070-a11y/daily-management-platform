package com.home.platform.finance.dto;

import java.math.BigDecimal;

public record FinanceTxDto(
        Long id,
        String txType,
        Long categoryId,
        String categoryName,
        String categoryIcon,
        BigDecimal amount,
        String txDate,
        String description,
        String paymentMethod,
        String isFixed,
        String isRecurring,
        String createdAt
) {
}

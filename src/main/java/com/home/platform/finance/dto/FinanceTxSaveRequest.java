package com.home.platform.finance.dto;

import java.math.BigDecimal;

public record FinanceTxSaveRequest(
        String txType,
        Long categoryId,
        BigDecimal amount,
        String txDate,
        String description,
        String paymentMethod,
        String isFixed,
        String isRecurring
) {
}

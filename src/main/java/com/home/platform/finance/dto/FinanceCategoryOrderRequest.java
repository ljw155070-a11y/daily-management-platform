package com.home.platform.finance.dto;

import java.util.List;

public record FinanceCategoryOrderRequest(
        String catType,
        List<Long> categoryIds
) {
}
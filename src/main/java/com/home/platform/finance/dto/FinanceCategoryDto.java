package com.home.platform.finance.dto;

import com.home.platform.finance.FinanceCategory;

public record FinanceCategoryDto(
        Long id,
        String catType,
        String catName,
        String icon,
        Integer sortOrder,
        String isDefault
) {
    public static FinanceCategoryDto from(FinanceCategory entity) {
        return new FinanceCategoryDto(
                entity.getId(),
                entity.getCatType(),
                entity.getCatName(),
                entity.getIcon(),
                entity.getSortOrder(),
                entity.getIsDefault()
        );
    }
}

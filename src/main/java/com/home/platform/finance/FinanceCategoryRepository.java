package com.home.platform.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FinanceCategoryRepository extends JpaRepository<FinanceCategory, Long> {
    List<FinanceCategory> findByUserIdAndCatTypeOrderBySortOrderAsc(String userId, String catType);

    List<FinanceCategory> findByUserIdOrderBySortOrderAsc(String userId);

    boolean existsByUserIdAndCatTypeAndCatName(String userId, String catType, String catName);
}

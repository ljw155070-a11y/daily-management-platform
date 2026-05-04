package com.home.platform.finance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FinanceBudgetRepository extends JpaRepository<FinanceBudget, Long> {
    List<FinanceBudget> findByUserIdAndBudgetYearAndBudgetMonthOrderByCategoryIdAsc(
            String userId, Integer budgetYear, Integer budgetMonth);

    Optional<FinanceBudget> findByIdAndUserId(Long id, String userId);

    Optional<FinanceBudget> findByUserIdAndCategoryIdAndBudgetYearAndBudgetMonth(
            String userId, Long categoryId, Integer budgetYear, Integer budgetMonth);

    Optional<FinanceBudget> findByUserIdAndCategoryIdIsNullAndBudgetYearAndBudgetMonth(
            String userId, Integer budgetYear, Integer budgetMonth);

    long countByCategoryId(Long categoryId);
}

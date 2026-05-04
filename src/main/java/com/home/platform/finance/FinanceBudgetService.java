package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceBudgetDto;
import com.home.platform.finance.dto.FinanceBudgetSaveRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@Transactional
public class FinanceBudgetService {

    private final FinanceBudgetRepository budgetRepository;
    private final FinanceCategoryRepository categoryRepository;
    private final FinanceTxRepository txRepository;

    public FinanceBudgetService(
            FinanceBudgetRepository budgetRepository,
            FinanceCategoryRepository categoryRepository,
            FinanceTxRepository txRepository
    ) {
        this.budgetRepository = budgetRepository;
        this.categoryRepository = categoryRepository;
        this.txRepository = txRepository;
    }

    @Transactional(readOnly = true)
    public List<FinanceBudgetDto> getBudgets(String userId, Integer year, Integer month) {
        String normalizedUserId = normalizeUserId(userId);
        YearMonth yearMonth = normalizeYearMonth(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();
        Map<Long, FinanceCategory> categoryMap = getCategoryMap(normalizedUserId);
        Map<Long, BigDecimal> spentMap = txRepository.sumByCategoryAndPeriod(normalizedUserId, "EXPENSE", startDate, endDate)
                .stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> defaultIfNull((BigDecimal) row[1])));
        BigDecimal totalExpense = defaultIfNull(txRepository.sumByTypeAndPeriod(normalizedUserId, "EXPENSE", startDate, endDate));

        return budgetRepository.findByUserIdAndBudgetYearAndBudgetMonthOrderByCategoryIdAsc(
                        normalizedUserId,
                        yearMonth.getYear(),
                        yearMonth.getMonthValue()
                )
                .stream()
                .map(budget -> toDto(budget, categoryMap.get(budget.getCategoryId()), spentMap, totalExpense))
                .toList();
    }

    public FinanceBudgetDto saveBudget(FinanceBudgetSaveRequest req, String userId) {
        String normalizedUserId = normalizeUserId(userId);
        FinanceBudgetSaveRequest validatedRequest = validateRequest(req);
        YearMonth yearMonth = normalizeYearMonth(validatedRequest.budgetYear(), validatedRequest.budgetMonth());
        FinanceCategory category = getOwnedExpenseCategory(validatedRequest.categoryId(), normalizedUserId);

        FinanceBudget budget = findExistingBudget(normalizedUserId, validatedRequest.categoryId(), yearMonth)
                .orElseGet(FinanceBudget::new);

        budget.setUserId(normalizedUserId);
        budget.setCategoryId(validatedRequest.categoryId());
        budget.setBudgetYear(yearMonth.getYear());
        budget.setBudgetMonth(yearMonth.getMonthValue());
        budget.setAmount(normalizeAmount(validatedRequest.amount()));

        FinanceBudget saved = budgetRepository.save(budget);
        BigDecimal spent = calculateSpent(normalizedUserId, validatedRequest.categoryId(), yearMonth);

        return new FinanceBudgetDto(
                saved.getId(),
                saved.getCategoryId(),
                category != null ? category.getCatName() : null,
                saved.getBudgetYear(),
                saved.getBudgetMonth(),
                saved.getAmount(),
                spent
        );
    }

    public void deleteBudget(Long id, String userId) {
        FinanceBudget budget = budgetRepository.findByIdAndUserId(normalizeId(id), normalizeUserId(userId))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Budget not found."));
        budgetRepository.delete(budget);
    }

    private FinanceBudgetDto toDto(
            FinanceBudget budget,
            FinanceCategory category,
            Map<Long, BigDecimal> spentMap,
            BigDecimal totalExpense
    ) {
        BigDecimal spent = budget.getCategoryId() == null
                ? totalExpense
                : spentMap.getOrDefault(budget.getCategoryId(), BigDecimal.ZERO);

        return new FinanceBudgetDto(
                budget.getId(),
                budget.getCategoryId(),
                category != null ? category.getCatName() : null,
                budget.getBudgetYear(),
                budget.getBudgetMonth(),
                budget.getAmount(),
                spent
        );
    }

    private BigDecimal calculateSpent(String userId, Long categoryId, YearMonth yearMonth) {
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        if (categoryId == null) {
            return defaultIfNull(txRepository.sumByTypeAndPeriod(userId, "EXPENSE", startDate, endDate));
        }

        return txRepository.sumByCategoryAndPeriod(userId, "EXPENSE", startDate, endDate)
                .stream()
                .filter(row -> categoryId.equals(row[0]))
                .map(row -> defaultIfNull((BigDecimal) row[1]))
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private java.util.Optional<FinanceBudget> findExistingBudget(String userId, Long categoryId, YearMonth yearMonth) {
        if (categoryId == null) {
            return budgetRepository.findByUserIdAndCategoryIdIsNullAndBudgetYearAndBudgetMonth(
                    userId,
                    yearMonth.getYear(),
                    yearMonth.getMonthValue()
            );
        }

        return budgetRepository.findByUserIdAndCategoryIdAndBudgetYearAndBudgetMonth(
                userId,
                categoryId,
                yearMonth.getYear(),
                yearMonth.getMonthValue()
        );
    }

    private Map<Long, FinanceCategory> getCategoryMap(String userId) {
        return categoryRepository.findByUserIdOrderBySortOrderAsc(userId)
                .stream()
                .collect(Collectors.toMap(FinanceCategory::getId, Function.identity()));
    }

    private FinanceCategory getOwnedExpenseCategory(Long categoryId, String userId) {
        if (categoryId == null) {
            return null;
        }

        FinanceCategory category = categoryRepository.findById(normalizeId(categoryId))
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Category is invalid."));

        if (!userId.equals(category.getUserId()) || !"EXPENSE".equals(category.getCatType())) {
            throw new ResponseStatusException(BAD_REQUEST, "Category is invalid.");
        }

        return category;
    }

    private FinanceBudgetSaveRequest validateRequest(FinanceBudgetSaveRequest req) {
        if (req == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Request is required.");
        }

        Long normalizedCategoryId = req.categoryId() == null ? null : normalizeId(req.categoryId());
        YearMonth yearMonth = normalizeYearMonth(req.budgetYear(), req.budgetMonth());
        BigDecimal normalizedAmount = normalizeAmount(req.amount());

        return new FinanceBudgetSaveRequest(
                normalizedCategoryId,
                yearMonth.getYear(),
                yearMonth.getMonthValue(),
                normalizedAmount
        );
    }

    private String normalizeUserId(String userId) {
        if (userId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "User id is required.");
        }

        String normalized = userId.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw new ResponseStatusException(BAD_REQUEST, "User id is invalid.");
        }

        return normalized;
    }

    private YearMonth normalizeYearMonth(Integer year, Integer month) {
        if (year == null || month == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Year and month are required.");
        }
        if (year < 1900 || year > 9999 || month < 1 || month > 12) {
            throw new ResponseStatusException(BAD_REQUEST, "Year or month is invalid.");
        }
        return YearMonth.of(year, month);
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Amount is invalid.");
        }
        return amount;
    }

    private Long normalizeId(Long id) {
        if (id == null || id <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Id is invalid.");
        }
        return id;
    }

    private BigDecimal defaultIfNull(BigDecimal amount) {
        return amount != null ? amount : BigDecimal.ZERO;
    }
}

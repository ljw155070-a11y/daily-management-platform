package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceMonthlySummaryDto;
import com.home.platform.finance.dto.FinanceTxDto;
import com.home.platform.finance.dto.FinanceTxSaveRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@Transactional
public class FinanceTxService {

    private static final DateTimeFormatter TX_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter CREATED_AT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final FinanceTxRepository txRepository;
    private final FinanceCategoryRepository categoryRepository;

    public FinanceTxService(FinanceTxRepository txRepository, FinanceCategoryRepository categoryRepository) {
        this.txRepository = txRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<FinanceTxDto> getTransactions(String userId, Integer year, Integer month) {
        String normalizedUserId = normalizeUserId(userId);
        YearMonth yearMonth = normalizeYearMonth(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();
        Map<Long, FinanceCategory> categoryMap = getCategoryMap(normalizedUserId);

        return txRepository.findByUserIdAndTxDateBetweenOrderByTxDateDescCreatedAtDesc(normalizedUserId, startDate, endDate)
                .stream()
                .map(tx -> toDto(tx, categoryMap.get(tx.getCategoryId())))
                .toList();
    }

    public FinanceTxDto save(FinanceTxSaveRequest req, String userId) {
        String normalizedUserId = normalizeUserId(userId);
        FinanceTxSaveRequest validatedRequest = validateRequest(req);
        FinanceCategory category = getOwnedCategory(validatedRequest.categoryId(), normalizedUserId, validatedRequest.txType());

        FinanceTx tx = new FinanceTx();
        tx.setUserId(normalizedUserId);
        tx.setTxType(validatedRequest.txType());
        tx.setCategoryId(category.getId());
        tx.setAmount(validatedRequest.amount());
        tx.setTxDate(parseTxDate(validatedRequest.txDate()));
        tx.setDescription(normalizeDescription(validatedRequest.description()));
        tx.setPaymentMethod(normalizePaymentMethod(validatedRequest.paymentMethod()));
        tx.setIsFixed(normalizeIsFixed(validatedRequest.isFixed(), validatedRequest.txType()));

        return toDto(txRepository.save(tx), category);
    }

    public FinanceTxDto update(Long id, FinanceTxSaveRequest req, String userId) {
        Long normalizedId = normalizeId(id);
        String normalizedUserId = normalizeUserId(userId);
        FinanceTxSaveRequest validatedRequest = validateRequest(req);
        FinanceCategory category = getOwnedCategory(validatedRequest.categoryId(), normalizedUserId, validatedRequest.txType());

        FinanceTx tx = txRepository.findByIdAndUserId(normalizedId, normalizedUserId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Transaction not found."));

        tx.setTxType(validatedRequest.txType());
        tx.setCategoryId(category.getId());
        tx.setAmount(validatedRequest.amount());
        tx.setTxDate(parseTxDate(validatedRequest.txDate()));
        tx.setDescription(normalizeDescription(validatedRequest.description()));
        tx.setPaymentMethod(normalizePaymentMethod(validatedRequest.paymentMethod()));
        tx.setIsFixed(normalizeIsFixed(validatedRequest.isFixed(), validatedRequest.txType()));

        return toDto(txRepository.save(tx), category);
    }

    public void delete(Long id, String userId) {
        FinanceTx tx = txRepository.findByIdAndUserId(normalizeId(id), normalizeUserId(userId))
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Transaction not found."));
        txRepository.delete(tx);
    }

    @Transactional(readOnly = true)
    public FinanceMonthlySummaryDto getMonthlySummary(String userId, Integer year, Integer month) {
        String normalizedUserId = normalizeUserId(userId);
        YearMonth yearMonth = normalizeYearMonth(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();
        Map<Long, FinanceCategory> categoryMap = getCategoryMap(normalizedUserId);
        YearMonth prevMonth = yearMonth.minusMonths(1);
        LocalDate prevStartDate = prevMonth.atDay(1);
        LocalDate prevEndDate = prevMonth.atEndOfMonth();
        Map<Long, BigDecimal> previousExpenseMap = txRepository
                .sumByCategoryAndPeriod(normalizedUserId, "EXPENSE", prevStartDate, prevEndDate)
                .stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> defaultIfNull((BigDecimal) row[1])));

        BigDecimal totalIncome = defaultIfNull(txRepository.sumByTypeAndPeriod(normalizedUserId, "INCOME", startDate, endDate));
        BigDecimal totalExpense = defaultIfNull(txRepository.sumByTypeAndPeriod(normalizedUserId, "EXPENSE", startDate, endDate));
        BigDecimal fixedExpense = defaultIfNull(txRepository.sumExpenseByFixed(normalizedUserId, "Y", startDate, endDate));
        BigDecimal variableExpense = defaultIfNull(txRepository.sumExpenseByFixed(normalizedUserId, "N", startDate, endDate));
        int elapsedDays = calculateElapsedDays(yearMonth);
        BigDecimal dailyAverage = totalExpense.divide(BigDecimal.valueOf(elapsedDays), 0, RoundingMode.HALF_UP);
        BigDecimal balance = totalIncome.subtract(totalExpense);

        List<FinanceMonthlySummaryDto.CategorySummary> expenseByCategory = txRepository
                .sumByCategoryAndPeriod(normalizedUserId, "EXPENSE", startDate, endDate)
                .stream()
                .map(row -> toCategorySummary(row, categoryMap, totalExpense, previousExpenseMap))
                .toList();

        return new FinanceMonthlySummaryDto(
                yearMonth.getYear(),
                yearMonth.getMonthValue(),
                totalIncome,
                totalExpense,
                fixedExpense,
                variableExpense,
                dailyAverage,
                balance,
                expenseByCategory
        );
    }

    private int calculateElapsedDays(YearMonth yearMonth) {
        LocalDate today = LocalDate.now();
        YearMonth currentYearMonth = YearMonth.from(today);

        if (yearMonth.equals(currentYearMonth)) {
            return today.getDayOfMonth();
        }
        if (yearMonth.isBefore(currentYearMonth)) {
            return yearMonth.lengthOfMonth();
        }
        return 1;
    }
    private FinanceTxDto toDto(FinanceTx tx, FinanceCategory category) {
        return new FinanceTxDto(
                tx.getId(),
                tx.getTxType(),
                tx.getCategoryId(),
                category != null ? category.getCatName() : null,
                category != null ? category.getIcon() : null,
                tx.getAmount(),
                formatTxDate(tx.getTxDate()),
                tx.getDescription(),
                tx.getPaymentMethod(),
                tx.getIsFixed(),
                formatCreatedAt(tx.getCreatedAt())
        );
    }

    private FinanceMonthlySummaryDto.CategorySummary toCategorySummary(
            Object[] row,
            Map<Long, FinanceCategory> categoryMap,
            BigDecimal totalExpense,
            Map<Long, BigDecimal> previousExpenseMap
    ) {
        Long categoryId = (Long) row[0];
        BigDecimal amount = defaultIfNull((BigDecimal) row[1]);
        FinanceCategory category = categoryMap.get(categoryId);
        BigDecimal previousAmount = defaultIfNull(previousExpenseMap.get(categoryId));
        Double changePercent = previousAmount.compareTo(BigDecimal.ZERO) == 0
                ? null
                : amount.subtract(previousAmount)
                .multiply(BigDecimal.valueOf(100))
                .divide(previousAmount, 2, RoundingMode.HALF_UP)
                .doubleValue();
        double percentage = BigDecimal.ZERO.compareTo(totalExpense) == 0
                ? 0d
                : amount.multiply(BigDecimal.valueOf(100))
                .divide(totalExpense, 2, java.math.RoundingMode.HALF_UP)
                .doubleValue();

        return new FinanceMonthlySummaryDto.CategorySummary(
                categoryId,
                category != null ? category.getCatName() : null,
                category != null ? category.getIcon() : null,
                amount,
                percentage,
                changePercent
        );
    }

    private Map<Long, FinanceCategory> getCategoryMap(String userId) {
        return categoryRepository.findByUserIdOrderBySortOrderAsc(userId)
                .stream()
                .collect(Collectors.toMap(FinanceCategory::getId, Function.identity()));
    }

    private FinanceCategory getOwnedCategory(Long categoryId, String userId, String txType) {
        Long normalizedCategoryId = normalizeId(categoryId);
        FinanceCategory category = categoryRepository.findById(normalizedCategoryId)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Category is invalid."));

        if (!userId.equals(category.getUserId()) || !txType.equals(category.getCatType())) {
            throw new ResponseStatusException(BAD_REQUEST, "Category is invalid.");
        }

        return category;
    }

    private FinanceTxSaveRequest validateRequest(FinanceTxSaveRequest req) {
        if (req == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Request is required.");
        }

        String normalizedTxType = normalizeTxType(req.txType());
        Long normalizedCategoryId = normalizeId(req.categoryId());
        BigDecimal normalizedAmount = normalizeAmount(req.amount());
        String normalizedTxDate = normalizeTxDateText(req.txDate());
        String normalizedDescription = normalizeDescription(req.description());
        String normalizedPaymentMethod = normalizePaymentMethod(req.paymentMethod());
        String normalizedIsFixed = normalizeIsFixed(req.isFixed(), normalizedTxType);

        return new FinanceTxSaveRequest(
                normalizedTxType,
                normalizedCategoryId,
                normalizedAmount,
                normalizedTxDate,
                normalizedDescription,
                normalizedPaymentMethod,
                normalizedIsFixed
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

    private String normalizeTxType(String txType) {
        if (txType == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Transaction type is required.");
        }

        String normalized = txType.trim().toUpperCase();
        if (!"INCOME".equals(normalized) && !"EXPENSE".equals(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "Transaction type is invalid.");
        }

        return normalized;
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Amount is invalid.");
        }
        return amount;
    }

    private String normalizeTxDateText(String txDate) {
        if (txDate == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Transaction date is required.");
        }

        String normalized = txDate.trim();
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "Transaction date is invalid.");
        }

        try {
            LocalDate.parse(normalized, TX_DATE_FORMATTER);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(BAD_REQUEST, "Transaction date is invalid.");
        }

        return normalized;
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }

        String normalized = description.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > 500) {
            throw new ResponseStatusException(BAD_REQUEST, "Description is invalid.");
        }

        return normalized;
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null) {
            return null;
        }

        String normalized = paymentMethod.trim().toUpperCase();
        if (normalized.isEmpty()) {
            return null;
        }
        if (!List.of("CASH", "CARD", "TRANSFER", "OTHER").contains(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "Payment method is invalid.");
        }

        return normalized;
    }

    private String normalizeIsFixed(String isFixed, String txType) {
        if (!"EXPENSE".equals(txType)) {
            return "N";
        }
        if (isFixed == null) {
            return "N";
        }

        String normalized = isFixed.trim().toUpperCase();
        if (normalized.isEmpty()) {
            return "N";
        }
        if (!"Y".equals(normalized) && !"N".equals(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "Fixed expense flag is invalid.");
        }

        return normalized;
    }

    private Long normalizeId(Long id) {
        if (id == null || id <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "Id is invalid.");
        }
        return id;
    }

    private LocalDate parseTxDate(String txDate) {
        return LocalDate.parse(txDate, TX_DATE_FORMATTER);
    }

    private String formatTxDate(LocalDate txDate) {
        return txDate != null ? txDate.format(TX_DATE_FORMATTER) : null;
    }

    private String formatCreatedAt(LocalDateTime createdAt) {
        return createdAt != null ? createdAt.format(CREATED_AT_FORMATTER) : null;
    }

    private BigDecimal defaultIfNull(BigDecimal amount) {
        return amount != null ? amount : BigDecimal.ZERO;
    }
}
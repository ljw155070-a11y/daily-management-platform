package com.home.platform.finance;

import com.home.platform.finance.dto.MonthlyTrendDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FinanceTxServiceTest {

    @Test
    void 최근_6개월_수입지출_추이를_오래된_월부터_반환한다() {
        FinanceTxRepository txRepository = mock(FinanceTxRepository.class);
        FinanceCategoryRepository categoryRepository = mock(FinanceCategoryRepository.class);
        FinanceTxService service = new FinanceTxService(txRepository, categoryRepository);

        stubMonthlySum(txRepository, "homehub", "INCOME", 2025, 12, 100000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2025, 12, 50000);
        stubMonthlySum(txRepository, "homehub", "INCOME", 2026, 1, 110000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, 1, 60000);
        stubMonthlySum(txRepository, "homehub", "INCOME", 2026, 2, 120000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, 2, 70000);
        stubMonthlySum(txRepository, "homehub", "INCOME", 2026, 3, 130000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, 3, 80000);
        stubMonthlySum(txRepository, "homehub", "INCOME", 2026, 4, 140000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, 4, 90000);
        stubMonthlySum(txRepository, "homehub", "INCOME", 2026, 5, 150000);
        stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, 5, 100000);

        List<MonthlyTrendDto> trend = service.getMonthlyTrend("homehub", 2026, 5);

        assertEquals(6, trend.size());
        assertEquals(new MonthlyTrendDto(2025, 12, BigDecimal.valueOf(100000), BigDecimal.valueOf(50000)), trend.get(0));
        assertEquals(new MonthlyTrendDto(2026, 5, BigDecimal.valueOf(150000), BigDecimal.valueOf(100000)), trend.get(5));
    }

    @Test
    void 연간_결산은_1월부터_12월까지_월별_수입지출을_반환한다() {
        FinanceTxRepository txRepository = mock(FinanceTxRepository.class);
        FinanceCategoryRepository categoryRepository = mock(FinanceCategoryRepository.class);
        FinanceTxService service = new FinanceTxService(txRepository, categoryRepository);

        for (int month = 1; month <= 12; month++) {
            stubMonthlySum(txRepository, "homehub", "INCOME", 2026, month, month * 10000);
            stubMonthlySum(txRepository, "homehub", "EXPENSE", 2026, month, month * 5000);
        }

        List<MonthlyTrendDto> yearlyReport = service.getYearlyReport("homehub", 2026);

        assertEquals(12, yearlyReport.size());
        assertEquals(new MonthlyTrendDto(2026, 1, BigDecimal.valueOf(10000), BigDecimal.valueOf(5000)), yearlyReport.get(0));
        assertEquals(new MonthlyTrendDto(2026, 12, BigDecimal.valueOf(120000), BigDecimal.valueOf(60000)), yearlyReport.get(11));
    }

    @Test
    void 반복_거래는_중복을_건너뛰고_다음달로_복사한다() {
        FinanceTxRepository txRepository = mock(FinanceTxRepository.class);
        FinanceCategoryRepository categoryRepository = mock(FinanceCategoryRepository.class);
        FinanceTxService service = new FinanceTxService(txRepository, categoryRepository);

        FinanceTx recurring = new FinanceTx();
        recurring.setUserId("homehub");
        recurring.setTxType("EXPENSE");
        recurring.setCategoryId(10L);
        recurring.setAmount(BigDecimal.valueOf(50000));
        recurring.setTxDate(LocalDate.of(2026, 1, 31));
        recurring.setDescription("월세");
        recurring.setPaymentMethod("TRANSFER");
        recurring.setIsFixed("Y");
        recurring.setIsRecurring("Y");

        FinanceTx duplicateExisting = new FinanceTx();
        duplicateExisting.setUserId("homehub");
        duplicateExisting.setTxType("EXPENSE");
        duplicateExisting.setCategoryId(20L);
        duplicateExisting.setAmount(BigDecimal.valueOf(15000));
        duplicateExisting.setTxDate(LocalDate.of(2026, 2, 10));
        duplicateExisting.setDescription("구독료");
        duplicateExisting.setPaymentMethod("CARD");
        duplicateExisting.setIsFixed("Y");
        duplicateExisting.setIsRecurring("Y");

        FinanceTx duplicateSource = new FinanceTx();
        duplicateSource.setUserId("homehub");
        duplicateSource.setTxType("EXPENSE");
        duplicateSource.setCategoryId(20L);
        duplicateSource.setAmount(BigDecimal.valueOf(15000));
        duplicateSource.setTxDate(LocalDate.of(2026, 1, 10));
        duplicateSource.setDescription("구독료");
        duplicateSource.setPaymentMethod("CARD");
        duplicateSource.setIsFixed("Y");
        duplicateSource.setIsRecurring("Y");

        when(txRepository.findByUserIdAndIsRecurringAndTxDateBetween(
                "homehub",
                "Y",
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 1, 31)
        )).thenReturn(List.of(recurring, duplicateSource));
        when(txRepository.findByUserIdAndTxDateBetweenOrderByTxDateDescCreatedAtDesc(
                "homehub",
                LocalDate.of(2026, 2, 1),
                LocalDate.of(2026, 2, 28)
        )).thenReturn(List.of(duplicateExisting));

        service.generateRecurringTransactions("homehub", 2026, 2);

        verify(txRepository).saveAll(argThat(items -> {
            List<FinanceTx> list = items == null
                    ? List.of()
                    : StreamSupport.stream(items.spliterator(), false).toList();
            if (list.size() != 1) {
                return false;
            }
            FinanceTx generated = list.get(0);
            return "homehub".equals(generated.getUserId())
                    && "EXPENSE".equals(generated.getTxType())
                    && Long.valueOf(10L).equals(generated.getCategoryId())
                    && BigDecimal.valueOf(50000).compareTo(generated.getAmount()) == 0
                    && LocalDate.of(2026, 2, 28).equals(generated.getTxDate())
                    && "월세".equals(generated.getDescription())
                    && "TRANSFER".equals(generated.getPaymentMethod())
                    && "Y".equals(generated.getIsFixed())
                    && "Y".equals(generated.getIsRecurring());
        }));
    }

    private void stubMonthlySum(FinanceTxRepository repository, String userId, String txType, int year, int month, int amount) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        when(repository.sumByTypeAndPeriod(eq(userId), eq(txType), eq(start), eq(end)))
                .thenReturn(BigDecimal.valueOf(amount));
    }
}

package com.home.platform.finance;

import com.home.platform.finance.dto.MonthlyTrendDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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

    private void stubMonthlySum(FinanceTxRepository repository, String userId, String txType, int year, int month, int amount) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        when(repository.sumByTypeAndPeriod(eq(userId), eq(txType), eq(start), eq(end)))
                .thenReturn(BigDecimal.valueOf(amount));
    }
}

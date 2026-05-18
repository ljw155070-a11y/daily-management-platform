package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceMonthlySummaryDto;
import com.home.platform.finance.dto.MonthlyTrendDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.DefaultCsrfToken;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

@WebMvcTest(FinanceController.class)
@AutoConfigureMockMvc(addFilters = false)
class FinanceControllerViewTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FinanceCategoryService categoryService;

    @MockBean
    private FinanceTxService txService;

    @MockBean
    private FinanceBudgetService budgetService;

    @MockBean
    private FinanceExcelService excelService;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @Test
    void finance_페이지가_정상_렌더링된다() throws Exception {
        Authentication authentication = mock(Authentication.class);
        FinanceMonthlySummaryDto summary = new FinanceMonthlySummaryDto(
                2026,
                5,
                BigDecimal.valueOf(1000000),
                BigDecimal.valueOf(300000),
                BigDecimal.valueOf(100000),
                BigDecimal.valueOf(200000),
                BigDecimal.valueOf(10000),
                BigDecimal.valueOf(700000),
                List.of(new MonthlyTrendDto(2026, 5, BigDecimal.valueOf(1000000), BigDecimal.valueOf(300000))),
                List.of(new MonthlyTrendDto(2026, 1, BigDecimal.valueOf(900000), BigDecimal.valueOf(250000))),
                List.of(),
                List.of()
        );

        when(categoryService.getAllCategories("homehub")).thenReturn(List.of());
        doNothing().when(categoryService).initDefaultCategories("homehub");
        when(categoryService.getAllCategories("homehub")).thenReturn(List.of());
        doNothing().when(txService).generateRecurringTransactions(eq("homehub"), anyInt(), anyInt());
        when(txService.getMonthlySummary("homehub", 2026, 5)).thenReturn(summary);
        when(txService.getTransactions("homehub", 2026, 5)).thenReturn(List.of());
        when(budgetService.getBudgets("homehub", 2026, 5)).thenReturn(List.of());
        when(jdbcTemplate.queryForList("select DISPLAY_NAME from APP_USER where USERNAME = ?", "homehub"))
                .thenReturn(List.of(Map.of("DISPLAY_NAME", "homehub")));
        when(authentication.getName()).thenReturn("homehub");
        when(authentication.isAuthenticated()).thenReturn(true);

        mockMvc.perform(get("/finance")
                        .principal(authentication)
                        .requestAttr("_csrf", new DefaultCsrfToken("X-CSRF-TOKEN", "_csrf", "test-token"))
                        .param("year", "2026")
                        .param("month", "5"))
                .andExpect(status().isOk())
                .andExpect(view().name("finance/index"));
    }
}

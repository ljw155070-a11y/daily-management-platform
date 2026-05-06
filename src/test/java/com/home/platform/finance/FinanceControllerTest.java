package com.home.platform.finance;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FinanceControllerTest {

    @Test
    void 엑셀_다운로드_응답을_반환한다() {
        FinanceCategoryService categoryService = mock(FinanceCategoryService.class);
        FinanceTxService txService = mock(FinanceTxService.class);
        FinanceBudgetService budgetService = mock(FinanceBudgetService.class);
        FinanceExcelService excelService = mock(FinanceExcelService.class);
        Authentication authentication = mock(Authentication.class);

        byte[] excelBytes = "excel".getBytes();
        when(authentication.getName()).thenReturn("homehub");
        when(excelService.exportMonthlyTransactions("homehub", 2026, 5)).thenReturn(excelBytes);

        FinanceController controller = new FinanceController(categoryService, txService, budgetService, excelService);

        ResponseEntity<byte[]> response = controller.exportExcel(authentication, 2026, 5);

        assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
        assertEquals(MediaType.APPLICATION_OCTET_STREAM, response.getHeaders().getContentType());
        assertTrue(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).contains("finance_2026_05.xlsx"));
        assertArrayEquals(excelBytes, response.getBody());
        verify(excelService).exportMonthlyTransactions("homehub", 2026, 5);
    }

    @Test
    void 반복_거래_생성_API를_호출한다() {
        FinanceCategoryService categoryService = mock(FinanceCategoryService.class);
        FinanceTxService txService = mock(FinanceTxService.class);
        FinanceBudgetService budgetService = mock(FinanceBudgetService.class);
        FinanceExcelService excelService = mock(FinanceExcelService.class);
        Authentication authentication = mock(Authentication.class);

        when(authentication.getName()).thenReturn("homehub");

        FinanceController controller = new FinanceController(categoryService, txService, budgetService, excelService);

        ResponseEntity<Void> response = controller.generateRecurring(authentication, 2026, 5);

        assertEquals(HttpStatusCode.valueOf(200), response.getStatusCode());
        verify(txService).generateRecurringTransactions("homehub", 2026, 5);
    }
}

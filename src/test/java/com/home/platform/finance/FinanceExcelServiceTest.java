package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceTxDto;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FinanceExcelServiceTest {

    @Test
    void 월별_거래내역_엑셀을_생성한다() throws Exception {
        FinanceTxService txService = mock(FinanceTxService.class);
        when(txService.getTransactions("homehub", 2026, 5)).thenReturn(List.of(
                new FinanceTxDto(
                        1L,
                        "INCOME",
                        101L,
                        "급여",
                        "💵",
                        new BigDecimal("2500000"),
                        "2026-05-01",
                        "5월 급여",
                        "TRANSFER",
                        "N",
                        "2026-05-01 09:00"
                ),
                new FinanceTxDto(
                        2L,
                        "EXPENSE",
                        201L,
                        "식비",
                        "🍚",
                        new BigDecimal("35000"),
                        "2026-05-02",
                        "점심 식사",
                        "CARD",
                        "Y",
                        "2026-05-02 12:30"
                )
        ));

        FinanceExcelService excelService = new FinanceExcelService(txService);

        byte[] result = excelService.exportMonthlyTransactions("homehub", 2026, 5);

        assertNotNull(result);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(result))) {
            Sheet sheet = workbook.getSheet("2026년 5월 거래내역");
            assertNotNull(sheet);

            Row headerRow = sheet.getRow(0);
            assertEquals("날짜", headerRow.getCell(0).getStringCellValue());
            assertEquals("유형", headerRow.getCell(1).getStringCellValue());
            assertEquals("카테고리", headerRow.getCell(2).getStringCellValue());
            assertEquals("금액", headerRow.getCell(3).getStringCellValue());
            assertEquals("결제수단", headerRow.getCell(4).getStringCellValue());
            assertEquals("고정비", headerRow.getCell(5).getStringCellValue());
            assertEquals("메모", headerRow.getCell(6).getStringCellValue());

            Row incomeRow = sheet.getRow(1);
            assertEquals("2026-05-01", incomeRow.getCell(0).getStringCellValue());
            assertEquals("수입", incomeRow.getCell(1).getStringCellValue());
            assertEquals("급여", incomeRow.getCell(2).getStringCellValue());
            assertEquals(2500000d, incomeRow.getCell(3).getNumericCellValue());
            assertEquals("이체", incomeRow.getCell(4).getStringCellValue());
            assertEquals("", incomeRow.getCell(5).getStringCellValue());
            assertEquals("5월 급여", incomeRow.getCell(6).getStringCellValue());

            Row expenseRow = sheet.getRow(2);
            assertEquals("2026-05-02", expenseRow.getCell(0).getStringCellValue());
            assertEquals("지출", expenseRow.getCell(1).getStringCellValue());
            assertEquals("식비", expenseRow.getCell(2).getStringCellValue());
            assertEquals(-35000d, expenseRow.getCell(3).getNumericCellValue());
            assertEquals("카드", expenseRow.getCell(4).getStringCellValue());
            assertEquals("고정", expenseRow.getCell(5).getStringCellValue());
            assertEquals("점심 식사", expenseRow.getCell(6).getStringCellValue());

            Row totalRow = sheet.getRow(4);
            assertEquals("합계", totalRow.getCell(0).getStringCellValue());
            assertEquals(2465000d, totalRow.getCell(3).getNumericCellValue());

            Row incomeTotalRow = sheet.getRow(5);
            assertEquals("수입 합계", incomeTotalRow.getCell(0).getStringCellValue());
            assertEquals(2500000d, incomeTotalRow.getCell(3).getNumericCellValue());

            Row expenseTotalRow = sheet.getRow(6);
            assertEquals("지출 합계", expenseTotalRow.getCell(0).getStringCellValue());
            assertEquals(-35000d, expenseTotalRow.getCell(3).getNumericCellValue());
        }
    }
}

package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceTxDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

@Service
public class FinanceExcelService {

    private final FinanceTxService txService;

    public FinanceExcelService(FinanceTxService txService) {
        this.txService = txService;
    }

    public byte[] exportMonthlyTransactions(String userId, Integer year, Integer month) {
        List<FinanceTxDto> transactions = txService.getTransactions(userId, year, month);

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(year + "년 " + month + "월 거래내역");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle amountStyle = createAmountStyle(workbook, null);
            CellStyle incomeAmountStyle = createAmountStyle(workbook, new byte[]{(byte) 0x2d, (byte) 0x9d, (byte) 0x5e});
            CellStyle expenseAmountStyle = createAmountStyle(workbook, new byte[]{(byte) 0xd9, (byte) 0x48, (byte) 0x48});
            CellStyle summaryLabelStyle = createSummaryLabelStyle(workbook);
            CellStyle summaryAmountStyle = createAmountStyle(workbook, null);

            createHeaderRow(sheet, headerStyle);
            setColumnWidths(sheet);

            BigDecimal incomeTotal = BigDecimal.ZERO;
            BigDecimal expenseTotal = BigDecimal.ZERO;
            int rowIndex = 1;

            for (FinanceTxDto tx : transactions) {
                Row row = sheet.createRow(rowIndex++);
                boolean income = "INCOME".equalsIgnoreCase(tx.txType());
                BigDecimal signedAmount = income ? defaultIfNull(tx.amount()) : defaultIfNull(tx.amount()).negate();

                if (income) {
                    incomeTotal = incomeTotal.add(defaultIfNull(tx.amount()));
                } else {
                    expenseTotal = expenseTotal.add(defaultIfNull(tx.amount()));
                }

                createCell(row, 0, tx.txDate());
                createCell(row, 1, income ? "수입" : "지출");
                createCell(row, 2, tx.categoryName());
                createAmountCell(row, 3, signedAmount, income ? incomeAmountStyle : expenseAmountStyle);
                createCell(row, 4, toPaymentMethodLabel(tx.paymentMethod()));
                createCell(row, 5, "Y".equalsIgnoreCase(tx.isFixed()) ? "고정" : "");
                createCell(row, 6, tx.description());
            }

            rowIndex++;
            createSummaryRow(sheet.createRow(rowIndex++), "합계", incomeTotal.subtract(expenseTotal), summaryLabelStyle, summaryAmountStyle);
            createSummaryRow(sheet.createRow(rowIndex++), "수입 합계", incomeTotal, summaryLabelStyle, incomeAmountStyle);
            createSummaryRow(sheet.createRow(rowIndex), "지출 합계", expenseTotal.negate(), summaryLabelStyle, expenseAmountStyle);

            workbook.write(outputStream);
            return outputStream.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("엑셀 파일 생성에 실패했습니다.", ex);
        }
    }

    private void createHeaderRow(Sheet sheet, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"날짜", "유형", "카테고리", "금액", "결제수단", "고정비", "메모"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    private void setColumnWidths(Sheet sheet) {
        int[] widths = {14, 8, 14, 15, 12, 8, 30};
        for (int i = 0; i < widths.length; i++) {
            sheet.setColumnWidth(i, widths[i] * 256);
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);

        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private CellStyle createAmountStyle(Workbook workbook, byte[] rgb) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0"));

        Font font = workbook.createFont();
        if (rgb != null && font instanceof XSSFFont xssfFont) {
            xssfFont.setColor(new XSSFColor(rgb, null));
        }
        style.setFont(font);
        return style;
    }

    private CellStyle createSummaryLabelStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        return style;
    }

    private void createSummaryRow(Row row, String label, BigDecimal amount, CellStyle labelStyle, CellStyle amountStyle) {
        Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);
        createAmountCell(row, 3, amount, amountStyle);
    }

    private void createAmountCell(Row row, int columnIndex, BigDecimal amount, CellStyle style) {
        Cell cell = row.createCell(columnIndex);
        cell.setCellValue(defaultIfNull(amount).doubleValue());
        cell.setCellStyle(style);
    }

    private void createCell(Row row, int columnIndex, String value) {
        row.createCell(columnIndex).setCellValue(value != null ? value : "");
    }

    private String toPaymentMethodLabel(String paymentMethod) {
        if (paymentMethod == null) {
            return "";
        }
        return switch (paymentMethod.toUpperCase()) {
            case "CASH" -> "현금";
            case "CARD" -> "카드";
            case "TRANSFER" -> "이체";
            case "OTHER" -> "기타";
            default -> paymentMethod;
        };
    }

    private BigDecimal defaultIfNull(BigDecimal amount) {
        return amount != null ? amount : BigDecimal.ZERO;
    }
}

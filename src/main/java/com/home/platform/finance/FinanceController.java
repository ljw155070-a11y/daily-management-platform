package com.home.platform.finance;

import com.home.platform.finance.dto.FinanceBudgetDto;
import com.home.platform.finance.dto.FinanceBudgetSaveRequest;
import com.home.platform.finance.dto.FinanceCategoryDto;
import com.home.platform.finance.dto.FinanceCategoryOrderRequest;
import com.home.platform.finance.dto.FinanceMonthlySummaryDto;
import com.home.platform.finance.dto.FinanceTxDto;
import com.home.platform.finance.dto.FinanceTxSaveRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.time.YearMonth;
import java.util.List;

@Controller
public class FinanceController {

    private final FinanceCategoryService categoryService;
    private final FinanceTxService txService;
    private final FinanceBudgetService budgetService;

    public FinanceController(
            FinanceCategoryService categoryService,
            FinanceTxService txService,
            FinanceBudgetService budgetService
    ) {
        this.categoryService = categoryService;
        this.txService = txService;
        this.budgetService = budgetService;
    }

    @GetMapping("/finance")
    public String finance(
            Authentication authentication,
            Model model,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month
    ) {
        String userId = authentication.getName();
        List<FinanceCategoryDto> categories = categoryService.getAllCategories(userId);
        if (categories.isEmpty()) {
            categoryService.initDefaultCategories(userId);
            categories = categoryService.getAllCategories(userId);
        }

        YearMonth yearMonth = resolveYearMonth(year, month);
        FinanceMonthlySummaryDto summary = txService.getMonthlySummary(userId, yearMonth.getYear(), yearMonth.getMonthValue());
        List<FinanceTxDto> transactions = txService.getTransactions(userId, yearMonth.getYear(), yearMonth.getMonthValue());
        List<FinanceBudgetDto> budgets = budgetService.getBudgets(userId, yearMonth.getYear(), yearMonth.getMonthValue());

        model.addAttribute("activeTab", "finance");
        model.addAttribute("summary", summary);
        model.addAttribute("transactions", transactions);
        model.addAttribute("categories", categories);
        model.addAttribute("budgets", budgets);
        model.addAttribute("year", yearMonth.getYear());
        model.addAttribute("month", yearMonth.getMonthValue());
        return "finance/index";
    }

    @PostMapping("/finance/transactions")
    @ResponseBody
    public ResponseEntity<FinanceTxDto> saveTransaction(
            Authentication authentication,
            @RequestBody FinanceTxSaveRequest req
    ) {
        return ResponseEntity.ok(txService.save(req, authentication.getName()));
    }

    @PatchMapping("/finance/transactions/{id}")
    @ResponseBody
    public ResponseEntity<FinanceTxDto> updateTransaction(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody FinanceTxSaveRequest req
    ) {
        return ResponseEntity.ok(txService.update(id, req, authentication.getName()));
    }

    @DeleteMapping("/finance/transactions/{id}")
    @ResponseBody
    public ResponseEntity<Void> deleteTransaction(Authentication authentication, @PathVariable Long id) {
        txService.delete(id, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/finance/summary")
    @ResponseBody
    public ResponseEntity<FinanceMonthlySummaryDto> getMonthlySummary(
            Authentication authentication,
            @RequestParam Integer year,
            @RequestParam Integer month
    ) {
        return ResponseEntity.ok(txService.getMonthlySummary(authentication.getName(), year, month));
    }

    @PostMapping("/finance/budgets")
    @ResponseBody
    public ResponseEntity<FinanceBudgetDto> saveBudget(
            Authentication authentication,
            @RequestBody FinanceBudgetSaveRequest req
    ) {
        return ResponseEntity.ok(budgetService.saveBudget(req, authentication.getName()));
    }

    @DeleteMapping("/finance/budgets/{id}")
    @ResponseBody
    public ResponseEntity<Void> deleteBudget(Authentication authentication, @PathVariable Long id) {
        budgetService.deleteBudget(id, authentication.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/finance/categories")
    @ResponseBody
    public ResponseEntity<FinanceCategoryDto> addCategory(
            Authentication authentication,
            @RequestParam String catType,
            @RequestParam String catName,
            @RequestParam(required = false) String icon
    ) {
        return ResponseEntity.ok(categoryService.addCategory(authentication.getName(), catType, catName, icon));
    }

    @DeleteMapping("/finance/categories/{id}")
    @ResponseBody
    public ResponseEntity<Void> deleteCategory(Authentication authentication, @PathVariable Long id) {
        categoryService.deleteCategory(id, authentication.getName());
        return ResponseEntity.ok().build();
    }

    private YearMonth resolveYearMonth(Integer year, Integer month) {
        YearMonth now = YearMonth.now();
        int resolvedYear = year != null ? year : now.getYear();
        int resolvedMonth = month != null ? month : now.getMonthValue();
        return YearMonth.of(resolvedYear, resolvedMonth);
    }
}
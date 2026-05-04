package com.home.platform.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "FINANCE_BUDGET")
public class FinanceBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "financeBudgetSeq")
    @SequenceGenerator(name = "financeBudgetSeq", sequenceName = "FINANCE_BUDGET_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "USER_ID", nullable = false, length = 100)
    private String userId;

    @Column(name = "CATEGORY_ID")
    private Long categoryId;

    @Column(name = "BUDGET_YEAR", nullable = false)
    private Integer budgetYear;

    @Column(name = "BUDGET_MONTH", nullable = false)
    private Integer budgetMonth;

    @Column(name = "AMOUNT", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public FinanceBudget() {}

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public Long getId()                               { return id; }
    public void setId(Long id)                        { this.id = id; }

    public String getUserId()                         { return userId; }
    public void setUserId(String userId)              { this.userId = userId; }

    public Long getCategoryId()                       { return categoryId; }
    public void setCategoryId(Long categoryId)        { this.categoryId = categoryId; }

    public Integer getBudgetYear()                    { return budgetYear; }
    public void setBudgetYear(Integer budgetYear)     { this.budgetYear = budgetYear; }

    public Integer getBudgetMonth()                   { return budgetMonth; }
    public void setBudgetMonth(Integer budgetMonth)   { this.budgetMonth = budgetMonth; }

    public BigDecimal getAmount()                     { return amount; }
    public void setAmount(BigDecimal amount)          { this.amount = amount; }

    public LocalDateTime getCreatedAt()               { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

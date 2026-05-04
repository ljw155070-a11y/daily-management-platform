package com.home.platform.finance;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "FINANCE_TX")
public class FinanceTx {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "financeTxSeq")
    @SequenceGenerator(name = "financeTxSeq", sequenceName = "FINANCE_TX_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "USER_ID", nullable = false, length = 100)
    private String userId;

    @Column(name = "TX_TYPE", nullable = false, length = 10)
    private String txType;

    @Column(name = "CATEGORY_ID", nullable = false)
    private Long categoryId;

    @Column(name = "AMOUNT", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "TX_DATE", nullable = false)
    private LocalDate txDate;

    @Column(name = "DESCRIPTION", length = 500)
    private String description;

    @Column(name = "PAYMENT_METHOD", length = 30)
    private String paymentMethod;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private LocalDateTime updatedAt;

    public FinanceTx() {}

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId()                               { return id; }
    public void setId(Long id)                        { this.id = id; }

    public String getUserId()                         { return userId; }
    public void setUserId(String userId)              { this.userId = userId; }

    public String getTxType()                         { return txType; }
    public void setTxType(String txType)              { this.txType = txType; }

    public Long getCategoryId()                       { return categoryId; }
    public void setCategoryId(Long categoryId)        { this.categoryId = categoryId; }

    public BigDecimal getAmount()                     { return amount; }
    public void setAmount(BigDecimal amount)          { this.amount = amount; }

    public LocalDate getTxDate()                      { return txDate; }
    public void setTxDate(LocalDate txDate)           { this.txDate = txDate; }

    public String getDescription()                    { return description; }
    public void setDescription(String description)    { this.description = description; }

    public String getPaymentMethod()                  { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod){ this.paymentMethod = paymentMethod; }

    public LocalDateTime getCreatedAt()               { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt()               { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

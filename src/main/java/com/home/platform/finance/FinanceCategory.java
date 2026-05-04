package com.home.platform.finance;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "FINANCE_CATEGORY")
public class FinanceCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "financeCategorySeq")
    @SequenceGenerator(name = "financeCategorySeq", sequenceName = "FINANCE_CATEGORY_SEQ", allocationSize = 1)
    @Column(name = "ID")
    private Long id;

    @Column(name = "USER_ID", nullable = false, length = 100)
    private String userId;

    @Column(name = "CAT_TYPE", nullable = false, length = 10)
    private String catType;

    @Column(name = "CAT_NAME", nullable = false, length = 100)
    private String catName;

    @Column(name = "ICON", length = 50)
    private String icon;

    @Column(name = "SORT_ORDER", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "IS_DEFAULT", nullable = false, length = 1)
    private String isDefault = "N";

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public FinanceCategory() {}

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public Long getId()                         { return id; }
    public void setId(Long id)                  { this.id = id; }

    public String getUserId()                   { return userId; }
    public void setUserId(String userId)        { this.userId = userId; }

    public String getCatType()                  { return catType; }
    public void setCatType(String catType)      { this.catType = catType; }

    public String getCatName()                  { return catName; }
    public void setCatName(String catName)      { this.catName = catName; }

    public String getIcon()                     { return icon; }
    public void setIcon(String icon)            { this.icon = icon; }

    public Integer getSortOrder()               { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public String getIsDefault()                { return isDefault; }
    public void setIsDefault(String isDefault)  { this.isDefault = isDefault; }

    public LocalDateTime getCreatedAt()         { return createdAt; }
    public void setCreatedAt(LocalDateTime t)   { this.createdAt = t; }
}

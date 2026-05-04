package com.home.platform.finance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FinanceTxRepository extends JpaRepository<FinanceTx, Long> {
    List<FinanceTx> findByUserIdAndTxDateBetweenOrderByTxDateDescCreatedAtDesc(
            String userId, LocalDate startDate, LocalDate endDate);

    Optional<FinanceTx> findByIdAndUserId(Long id, String userId);

    @Query("""
            SELECT t.categoryId, SUM(t.amount)
            FROM FinanceTx t
            WHERE t.userId = :userId
              AND t.txType = :txType
              AND t.txDate BETWEEN :startDate AND :endDate
            GROUP BY t.categoryId
            """)
    List<Object[]> sumByCategoryAndPeriod(
            @Param("userId") String userId,
            @Param("txType") String txType,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
            SELECT COALESCE(SUM(t.amount), 0)
            FROM FinanceTx t
            WHERE t.userId = :userId
              AND t.txType = :txType
              AND t.txDate BETWEEN :startDate AND :endDate
            """)
    BigDecimal sumByTypeAndPeriod(
            @Param("userId") String userId,
            @Param("txType") String txType,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}

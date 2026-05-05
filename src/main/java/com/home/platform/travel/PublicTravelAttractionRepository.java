package com.home.platform.travel;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PublicTravelAttractionRepository extends JpaRepository<PublicTravelAttraction, Long> {
    List<PublicTravelAttraction> findByActiveFlagOrderByTitleAsc(String activeFlag);

    List<PublicTravelAttraction> findByAreaCodeAndActiveFlagOrderByTitleAsc(String areaCode, String activeFlag);

    @Query(value = """
            SELECT * FROM (
                SELECT * FROM public_travel_attraction
                WHERE area_code = :areaCode AND active_flag = :activeFlag
                ORDER BY title
            ) WHERE ROWNUM <= 300
            """, nativeQuery = true)
    List<PublicTravelAttraction> findTop300ByAreaCodeAndActiveFlag(
            @Param("areaCode") String areaCode,
            @Param("activeFlag") String activeFlag);

    Optional<PublicTravelAttraction> findByExternalContentId(String externalContentId);

    long countByActiveFlag(String activeFlag);
}

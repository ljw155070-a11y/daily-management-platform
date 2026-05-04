package com.home.platform.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TravelPlaceRepository extends JpaRepository<TravelPlace, Long> {
    List<TravelPlace> findByUserIdOrderByCreatedAtDesc(String userId);

    boolean existsByIdAndUserId(Long id, String userId);

    Optional<TravelPlace> findByIdAndUserId(Long id, String userId);
}

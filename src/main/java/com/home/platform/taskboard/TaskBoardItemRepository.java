package com.home.platform.taskboard;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskBoardItemRepository extends JpaRepository<TaskBoardItem, Long> {

    List<TaskBoardItem> findByUserIdAndPageKeyOrderByCreatedAtDesc(String userId, String pageKey);

    Optional<TaskBoardItem> findByIdAndUserIdAndPageKey(Long id, String userId, String pageKey);

    void deleteByUserIdAndPageKeyAndStatus(String userId, String pageKey, String status);
}

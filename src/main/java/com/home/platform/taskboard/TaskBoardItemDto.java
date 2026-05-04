package com.home.platform.taskboard;

import java.time.LocalDateTime;

public record TaskBoardItemDto(
        Long id,
        String pageKey,
        String taskText,
        String status,
        LocalDateTime createdAt
) {
    public static TaskBoardItemDto from(TaskBoardItem item) {
        return new TaskBoardItemDto(
                item.getId(),
                item.getPageKey(),
                item.getTaskText(),
                item.getStatus(),
                item.getCreatedAt()
        );
    }
}

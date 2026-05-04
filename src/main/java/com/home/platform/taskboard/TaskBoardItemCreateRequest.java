package com.home.platform.taskboard;

public record TaskBoardItemCreateRequest(
        String pageKey,
        String taskText,
        String status
) {
}

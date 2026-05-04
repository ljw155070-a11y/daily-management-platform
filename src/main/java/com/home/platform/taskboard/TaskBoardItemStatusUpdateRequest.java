package com.home.platform.taskboard;

public record TaskBoardItemStatusUpdateRequest(
        String pageKey,
        String status
) {
}

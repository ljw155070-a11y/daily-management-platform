package com.home.platform.taskboard;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class TaskBoardService {

    private static final Set<String> ALLOWED_STATUSES = Set.of("todo", "doing", "done");

    private final TaskBoardItemRepository repository;

    public TaskBoardService(TaskBoardItemRepository repository) {
        this.repository = repository;
    }

    public List<TaskBoardItemDto> getItems(String userId, String pageKey) {
        String normalizedPageKey = normalizePageKey(pageKey);
        return repository.findByUserIdAndPageKeyOrderByCreatedAtDesc(userId, normalizedPageKey)
                .stream()
                .map(TaskBoardItemDto::from)
                .toList();
    }

    @Transactional
    public TaskBoardItemDto create(String userId, TaskBoardItemCreateRequest request) {
        String normalizedPageKey = normalizePageKey(request.pageKey());
        String normalizedStatus = normalizeStatus(request.status());
        String normalizedText = normalizeTaskText(request.taskText());

        TaskBoardItem item = new TaskBoardItem();
        item.setUserId(userId);
        item.setPageKey(normalizedPageKey);
        item.setTaskText(normalizedText);
        item.setStatus(normalizedStatus);

        return TaskBoardItemDto.from(repository.save(item));
    }

    @Transactional
    public TaskBoardItemDto updateStatus(String userId, Long id, TaskBoardItemStatusUpdateRequest request) {
        String normalizedPageKey = normalizePageKey(request.pageKey());
        String normalizedStatus = normalizeStatus(request.status());

        TaskBoardItem item = repository.findByIdAndUserIdAndPageKey(id, userId, normalizedPageKey)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Task board item not found."));

        item.setStatus(normalizedStatus);
        return TaskBoardItemDto.from(repository.save(item));
    }

    @Transactional
    public void delete(String userId, Long id, String pageKey) {
        String normalizedPageKey = normalizePageKey(pageKey);
        TaskBoardItem item = repository.findByIdAndUserIdAndPageKey(id, userId, normalizedPageKey)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Task board item not found."));
        repository.delete(item);
    }

    @Transactional
    public void clearDone(String userId, String pageKey) {
        repository.deleteByUserIdAndPageKeyAndStatus(userId, normalizePageKey(pageKey), "done");
    }

    private String normalizePageKey(String pageKey) {
        if (pageKey == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Page key is required.");
        }

        String normalized = pageKey.trim();
        if (normalized.isEmpty() || normalized.length() > 100) {
            throw new ResponseStatusException(BAD_REQUEST, "Page key is invalid.");
        }

        return normalized;
    }

    private String normalizeTaskText(String taskText) {
        if (taskText == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Task text is required.");
        }

        String normalized = taskText.trim();
        if (normalized.isEmpty() || normalized.length() > 200) {
            throw new ResponseStatusException(BAD_REQUEST, "Task text is invalid.");
        }

        return normalized;
    }

    private String normalizeStatus(String status) {
        if (status == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Task status is required.");
        }

        String normalized = status.trim().toLowerCase();
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "Task status is invalid.");
        }

        return normalized;
    }
}

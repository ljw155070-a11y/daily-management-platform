package com.home.platform.taskboard;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/task-board/items")
public class TaskBoardController {

    private final TaskBoardService service;

    public TaskBoardController(TaskBoardService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<TaskBoardItemDto>> list(Authentication authentication, @RequestParam String pageKey) {
        return ResponseEntity.ok(service.getItems(authentication.getName(), pageKey));
    }

    @PostMapping
    public ResponseEntity<TaskBoardItemDto> create(Authentication authentication,
                                                   @RequestBody TaskBoardItemCreateRequest request) {
        return ResponseEntity.ok(service.create(authentication.getName(), request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<TaskBoardItemDto> updateStatus(Authentication authentication,
                                                         @PathVariable Long id,
                                                         @RequestBody TaskBoardItemStatusUpdateRequest request) {
        return ResponseEntity.ok(service.updateStatus(authentication.getName(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(Authentication authentication,
                                       @PathVariable Long id,
                                       @RequestParam String pageKey) {
        service.delete(authentication.getName(), id, pageKey);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/completed")
    public ResponseEntity<Void> clearDone(Authentication authentication, @RequestParam String pageKey) {
        service.clearDone(authentication.getName(), pageKey);
        return ResponseEntity.ok().build();
    }
}

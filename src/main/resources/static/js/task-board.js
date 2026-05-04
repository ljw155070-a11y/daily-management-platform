(function () {
    const config = window.TASK_BOARD_CONFIG;
    if (!config) {
        return;
    }

    const STATUS_LABEL = config.labels || {
        todo: "Planned",
        doing: "Doing",
        done: "Done",
        empty: "No tasks added for this page.",
        count: "Total {total} · Open {todo}"
    };
    const NEXT_STATUS = { todo: "doing", doing: "done", done: "todo" };
    const pageKey = config.pageKey;
    const csrfHeader = config.csrfHeader;
    const csrfToken = config.csrfToken;

    let tasks = [];
    let currentFilter = "all";

    function readCsrfToken() {
        const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : csrfToken;
    }

    function requestHeaders(includeJson) {
        const value = { [csrfHeader]: readCsrfToken() };
        if (includeJson) {
            value["Content-Type"] = "application/json";
        }
        return value;
    }

    function esc(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function countLabel(total, todo) {
        return STATUS_LABEL.count
            .replace("{total}", total)
            .replace("{todo}", todo);
    }

    function render() {
        const list = document.getElementById("tb-list");
        if (!list) {
            return;
        }

        const filtered = currentFilter === "all"
            ? tasks
            : tasks.filter((task) => task.status === currentFilter);

        if (!filtered.length) {
            list.innerHTML = `<li class="tb-empty">${esc(STATUS_LABEL.empty)}</li>`;
        } else {
            list.innerHTML = filtered.map((task) => `
                <li class="tb-item">
                    <span class="tb-item-status">${esc(STATUS_LABEL[task.status])}</span>
                    <span class="tb-item-text${task.status === "done" ? " done-text" : ""}">${esc(task.taskText)}</span>
                    <button type="button" class="tb-item-change" onclick="tbCycle(${task.id}, '${task.status}')">${esc(STATUS_LABEL[NEXT_STATUS[task.status]])}</button>
                    <button type="button" class="tb-item-del" onclick="tbDel(${task.id})" aria-label="${esc(STATUS_LABEL.deleteLabel || "Delete")}">&times;</button>
                </li>
            `).join("");
        }

        const todoCount = tasks.filter((task) => task.status !== "done").length;
        const badge = document.getElementById("tb-badge");
        if (todoCount > 0) {
            badge.textContent = String(todoCount);
            badge.style.display = "";
        } else {
            badge.style.display = "none";
        }

        document.getElementById("tb-count").textContent = countLabel(tasks.length, todoCount);
    }

    async function parseError(response, fallbackMessage) {
        try {
            const text = await response.text();
            return text || fallbackMessage;
        } catch (error) {
            return fallbackMessage;
        }
    }

    async function loadTasks() {
        const response = await fetch(`/task-board/items?pageKey=${encodeURIComponent(pageKey)}`, {
            method: "GET",
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error(await parseError(response, "Failed to load task board items."));
        }

        tasks = await response.json();
        render();
    }

    async function createTask(taskText, status) {
        const response = await fetch("/task-board/items", {
            method: "POST",
            credentials: "same-origin",
            headers: requestHeaders(true),
            body: JSON.stringify({ pageKey, taskText, status })
        });

        if (!response.ok) {
            throw new Error(await parseError(response, "Failed to create task board item."));
        }

        const created = await response.json();
        tasks.unshift(created);
        render();
    }

    async function updateTaskStatus(id, status) {
        const response = await fetch(`/task-board/items/${id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: requestHeaders(true),
            body: JSON.stringify({ pageKey, status })
        });

        if (!response.ok) {
            throw new Error(await parseError(response, "Failed to update task board item."));
        }

        const updated = await response.json();
        tasks = tasks.map((task) => task.id === updated.id ? updated : task);
        render();
    }

    async function deleteTask(id) {
        const response = await fetch(`/task-board/items/${id}?pageKey=${encodeURIComponent(pageKey)}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: requestHeaders(false)
        });

        if (!response.ok) {
            throw new Error(await parseError(response, "Failed to delete task board item."));
        }

        tasks = tasks.filter((task) => task.id !== id);
        render();
    }

    async function clearDoneTasks() {
        const response = await fetch(`/task-board/items/completed?pageKey=${encodeURIComponent(pageKey)}`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: requestHeaders(false)
        });

        if (!response.ok) {
            throw new Error(await parseError(response, "Failed to clear completed task board items."));
        }

        tasks = tasks.filter((task) => task.status !== "done");
        render();
    }

    function showError(error) {
        console.error(error);
        window.alert(error.message || "Task board request failed.");
    }

    window.tbOpen = async function () {
        try {
            const drawer = document.getElementById("tb-drawer");
            drawer.classList.add("open");
            drawer.setAttribute("aria-hidden", "false");
            document.getElementById("tb-overlay").style.display = "block";
            document.getElementById("tb-toggle").style.display = "none";
            await loadTasks();
            document.getElementById("tb-input").focus();
        } catch (error) {
            showError(error);
        }
    };

    window.tbClose = function () {
        const drawer = document.getElementById("tb-drawer");
        drawer.classList.remove("open");
        drawer.setAttribute("aria-hidden", "true");
        document.getElementById("tb-overlay").style.display = "none";
        document.getElementById("tb-toggle").style.display = "";
    };

    window.tbAdd = async function () {
        const input = document.getElementById("tb-input");
        const taskText = input.value.trim();
        if (!taskText) {
            input.focus();
            return;
        }

        try {
            const status = document.getElementById("tb-sel").value;
            await createTask(taskText, status);
            input.value = "";
            input.focus();
        } catch (error) {
            showError(error);
        }
    };

    window.tbDel = async function (id) {
        try {
            await deleteTask(id);
        } catch (error) {
            showError(error);
        }
    };

    window.tbCycle = async function (id, currentStatus) {
        try {
            await updateTaskStatus(id, NEXT_STATUS[currentStatus]);
        } catch (error) {
            showError(error);
        }
    };

    window.tbFilter = function (button) {
        document.querySelectorAll(".tb-filter").forEach((filterButton) => filterButton.classList.remove("active"));
        button.classList.add("active");
        currentFilter = button.dataset.filter;
        render();
    };

    window.tbClearDone = async function () {
        try {
            await clearDoneTasks();
        } catch (error) {
            showError(error);
        }
    };

    document.addEventListener("keydown", function (event) {
        const drawer = document.getElementById("tb-drawer");
        if (event.key === "Escape" && drawer && drawer.classList.contains("open")) {
            tbClose();
        }
    });

    document.addEventListener("DOMContentLoaded", function () {
        render();
        loadTasks().catch(function (error) {
            console.error(error);
        });
    });
})();

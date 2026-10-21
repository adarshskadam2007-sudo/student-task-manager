const STORAGE_KEY = "studyflow_tasks_v1";
const $ = (selector) => document.querySelector(selector);
const taskList = $("#taskList");
const taskDialog = $("#taskDialog");
const taskForm = $("#taskForm");
const searchInput = $("#searchInput");
const priorityFilter = $("#priorityFilter");
const sortSelect = $("#sortSelect");
const navButtons = [...document.querySelectorAll(".nav-item")];
let currentFilter = "all";
let toastTimer;
let tasks = loadTasks();

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}
function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter(isValidTask) : [];
  } catch {
    return [];
  }
}
function isValidTask(task) {
  return task && typeof task.id === "string" && typeof task.title === "string"
    && typeof task.dueDate === "string" && typeof task.completed === "boolean";
}
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast("Could not save tasks in this browser.");
  }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function formatDate(dateString) {
  if (!dateString) return "No due date";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function getDueLabel(task) {
  const today = localDateString();
  if (task.completed) return { text: `Due ${formatDate(task.dueDate)}`, className: "" };
  if (task.dueDate < today) return { text: `Overdue · ${formatDate(task.dueDate)}`, className: "overdue" };
  if (task.dueDate === today) return { text: "Due today", className: "today" };
  if (task.dueDate === shiftDate(1)) return { text: "Due tomorrow", className: "" };
  return { text: `Due ${formatDate(task.dueDate)}`, className: "" };
}
function renderStats() {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  $("#totalStat").textContent = total;
  $("#progressStat").textContent = total - completed;
  $("#completedStat").textContent = completed;
  $("#completionStat").textContent = `${percent}%`;
  $("#completionBar").style.width = `${percent}%`;
  $("#allCount").textContent = total;
}
function matchesFilter(task) {
  const today = localDateString();
  if (currentFilter === "today") return !task.completed && task.dueDate === today;
  if (currentFilter === "upcoming") return !task.completed && task.dueDate > today;
  if (currentFilter === "completed") return task.completed;
  return true;
}
function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const priority = priorityFilter.value;
  const filtered = tasks.filter(task => matchesFilter(task)
    && (priority === "all" || task.priority === priority)
    && (!query || `${task.title} ${task.description || ""} ${task.category || ""}`.toLowerCase().includes(query)));
  const rank = { High: 0, Medium: 1, Low: 2 };
  filtered.sort((a, b) => {
    if (sortSelect.value === "priority") return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || a.dueDate.localeCompare(b.dueDate);
    if (sortSelect.value === "created") return (b.createdAt || 0) - (a.createdAt || 0);
    return a.dueDate.localeCompare(b.dueDate) || (b.createdAt || 0) - (a.createdAt || 0);
  });
  return filtered;
}
function renderTasks() {
  const visible = getVisibleTasks();
  taskList.innerHTML = visible.map(task => {
    const due = getDueLabel(task);
    const priorityClass = String(task.priority || "Medium").toLowerCase();
    return `<article class="task-card ${task.completed ? "is-completed" : ""}">
      <input class="task-check" type="checkbox" data-action="toggle" data-id="${escapeHTML(task.id)}" aria-label="Mark ${escapeHTML(task.title)} completed" ${task.completed ? "checked" : ""}>
      <div class="task-info">
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ""}
        <div class="task-meta"><span class="category-pill">${escapeHTML(task.category || "Study")}</span><span class="priority-pill ${priorityClass}">${escapeHTML(task.priority || "Medium")} priority</span><span class="due-date ${due.className}">${escapeHTML(due.text)}</span></div>
      </div>
      <div class="task-actions"><button class="icon-btn" data-action="edit" data-id="${escapeHTML(task.id)}" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">✎</button><button class="icon-btn" data-action="delete" data-id="${escapeHTML(task.id)}" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">⌫</button></div>
    </article>`;
  }).join("");
  $("#visibleCount").textContent = `${visible.length} ${visible.length === 1 ? "task" : "tasks"}`;
  $("#emptyState").classList.toggle("hidden", visible.length > 0);
  taskList.classList.toggle("hidden", visible.length === 0);
  if (!visible.length) {
    const hasTasks = tasks.length > 0;
    $("#emptyTitle").textContent = hasTasks ? "No tasks match this view" : "Your space is clear";
    $("#emptyText").textContent = hasTasks ? "Try another filter or search, or add a new task." : "Add a task to get started with your study plan.";
  }
}
function render() {
  renderStats();
  renderTasks();
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function openCreateDialog() {
  taskForm.reset();
  $("#taskId").value = "";
  $("#taskDue").value = localDateString();
  $("#dialogTitle").textContent = "Create a task";
  $("#saveTaskBtn").textContent = "Save task";
  taskDialog.showModal();
  $("#taskTitle").focus();
}
function openEditDialog(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  $("#taskId").value = task.id;
  $("#taskTitle").value = task.title;
  $("#taskDescription").value = task.description || "";
  $("#taskDue").value = task.dueDate;
  $("#taskPriority").value = task.priority || "Medium";
  $("#taskCategory").value = task.category || "Study";
  $("#dialogTitle").textContent = "Edit task";
  $("#saveTaskBtn").textContent = "Save changes";
  taskDialog.showModal();
  $("#taskTitle").focus();
}
function updateFilter(filter) {
  currentFilter = filter;
  navButtons.forEach(button => button.classList.toggle("active", button.dataset.filter === filter));
  const titles = { all: "All tasks", today: "Due today", upcoming: "Upcoming", completed: "Completed" };
  $("#listTitle").textContent = titles[filter] || "All tasks";
  renderTasks();
}
$("#openAddBtn").addEventListener("click", openCreateDialog);
$("#emptyAddBtn").addEventListener("click", openCreateDialog);
$("#closeDialogBtn").addEventListener("click", () => taskDialog.close());
$("#cancelBtn").addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("click", event => {
  if (event.target === taskDialog) taskDialog.close();
});
navButtons.forEach(button => button.addEventListener("click", () => updateFilter(button.dataset.filter)));
[searchInput, priorityFilter, sortSelect].forEach(element => element.addEventListener("input", renderTasks));

taskForm.addEventListener("submit", event => {
  event.preventDefault();
  const title = $("#taskTitle").value.trim();
  if (!title) {
    $("#taskTitle").focus();
    return;
  }
  const id = $("#taskId").value;
  const existing = tasks.find(task => task.id === id);
  const task = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title,
    description: $("#taskDescription").value.trim(),
    dueDate: $("#taskDue").value,
    priority: $("#taskPriority").value,
    category: $("#taskCategory").value,
    completed: existing ? existing.completed : false,
    createdAt: existing ? existing.createdAt : Date.now()
  };
  if (existing) {
    tasks = tasks.map(item => item.id === id ? task : item);
    showToast("Task updated successfully.");
  } else {
    tasks.push(task);
    showToast("Task added successfully.");
  }
  saveTasks();
  taskDialog.close();
  render();
});
taskList.addEventListener("change", event => {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;
  const task = tasks.find(item => item.id === checkbox.dataset.id);
  if (!task) return;
  task.completed = checkbox.checked;
  saveTasks();
  render();
  showToast(task.completed ? "Nice work — task completed!" : "Task moved back to your list.");
});
taskList.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || button.dataset.action === "toggle") return;
  const { action, id } = button.dataset;
  if (action === "edit") openEditDialog(id);
  if (action === "delete") {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    tasks = tasks.filter(item => item.id !== id);
    saveTasks();
    render();
    showToast("Task deleted.");
  }
});

const now = new Date();
$("#dateLabel").textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const hour = now.getHours();
$("#greeting").textContent = hour < 12 ? "Good morning. Let's make today count." : hour < 17 ? "Good afternoon. Let's make today count." : "Good evening. Let's make today count.";
render();

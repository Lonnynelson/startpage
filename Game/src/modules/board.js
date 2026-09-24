import { escapeHtml } from "../utils.js";

const STORAGE_KEY = "dmBoardItems";
const COLUMN_WIDTH_KEY = "dmBoardColumnWidths";
const MAX_TITLE_LENGTH = 60;
const MAX_CONTENT_LENGTH = 20000;
const COLUMN_COUNT = 4;

function autoLink(escapedText) {
  return escapedText.replace(
    /(https?:\/\/[^\s<]+)/g,
    (match) => {
      const trailingPunctuation = match.match(/[).,!?]+$/)?.[0] || "";
      const url = trailingPunctuation
        ? match.slice(0, -trailingPunctuation.length)
        : match;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailingPunctuation}`;
    },
  );
}

let uidCounter = 0;
function makeId() {
  uidCounter += 1;
  return `box-${Date.now()}-${uidCounter}`;
}

// Ensures every item has a valid column/order, assigning missing ones
// round-robin so existing boards migrate into the fixed column layout.
function normalizeItems(items) {
  let changed = false;
  const columnCounts = new Array(COLUMN_COUNT).fill(0);

  const normalized = items.map((item, index) => {
    let { column, order } = item;
    if (
      !Number.isInteger(column) ||
      column < 0 ||
      column >= COLUMN_COUNT
    ) {
      column = index % COLUMN_COUNT;
      changed = true;
    }
    if (!Number.isFinite(order)) {
      order = columnCounts[column];
      changed = true;
    }
    columnCounts[column] += 1;
    return changed && (item.column !== column || item.order !== order)
      ? { ...item, column, order }
      : item;
  });

  return { items: normalized, changed };
}

export class BoardManager {
  constructor() {
    this.gridContainer = document.getElementById("board-grid");
    this.addButton = document.getElementById("board-add-box-btn");
    if (!this.gridContainer) return;

    this._resizeTimers = new Map();
    this._observers = new Map();
    window.__boardManagerInstance = this;

    this.addButton?.addEventListener("click", () => this.addBox());

    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) this.render();
    });

    // Fallback persistence: catches a completed resize on mouse release,
    // independent of ResizeObserver (which browsers may throttle/delay).
    document.addEventListener("mouseup", () => {
      this._persistAllBoxSizes();
      this._persistAllColumnWidths();
    });

    this.render();
  }

  _persistAllBoxSizes() {
    if (!this.gridContainer) return;
    this.gridContainer.querySelectorAll(".board-box").forEach((box) => {
      if (box.offsetWidth === 0 || box.offsetHeight === 0) return;
      this.persistBoxSize(
        box.dataset.id,
        `${box.offsetWidth}px`,
        `${box.offsetHeight}px`,
      );
    });
  }

  getColumnWidths() {
    try {
      const raw = localStorage.getItem(COLUMN_WIDTH_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  persistColumnWidth(columnIndex, width) {
    const widths = this.getColumnWidths();
    if (widths[columnIndex] === width) return;
    widths[columnIndex] = width;
    localStorage.setItem(COLUMN_WIDTH_KEY, JSON.stringify(widths));
  }

  _persistAllColumnWidths() {
    if (!this.gridContainer) return;
    this.gridContainer.querySelectorAll(".board-column").forEach((column) => {
      if (column.offsetWidth === 0) return;
      this.persistColumnWidth(
        Number(column.dataset.column),
        `${column.offsetWidth}px`,
      );
    });
  }

  getItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const defaults = [
          {
            id: makeId(),
            title: "Welcome",
            type: "text",
            content: "Click the pencil icon to edit this box.\nAdd text with links (https://example.com) or switch to an image.",
            column: 0,
            order: 0,
          },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const { items, changed } = normalizeItems(parsed);
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return items;
    } catch (e) {
      console.error("[BoardManager] Failed to parse dmBoardItems:", e);
      return [];
    }
  }

  saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.render();
  }

  // Persists a box's size without a full grid re-render, so an in-progress
  // resize isn't interrupted and no self-triggering render loop occurs.
  persistBoxSize(id, width, height) {
    const items = this.getItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    if (items[index].width === width && items[index].height === height) return;
    items[index] = { ...items[index], width, height };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  addBox() {
    const items = this.getItems();
    const columnCounts = new Array(COLUMN_COUNT).fill(0);
    let maxOrder = new Array(COLUMN_COUNT).fill(-1);
    items.forEach((item) => {
      columnCounts[item.column] += 1;
      maxOrder[item.column] = Math.max(maxOrder[item.column], item.order);
    });
    const targetColumn = columnCounts.indexOf(Math.min(...columnCounts));

    const newItem = {
      id: makeId(),
      title: "New Box",
      type: "text",
      content: "",
      column: targetColumn,
      order: maxOrder[targetColumn] + 1,
    };
    items.push(newItem);
    this.saveItems(items);
    this.openEditor(newItem.id);
  }

  deleteBox(id) {
    const items = this.getItems().filter((item) => item.id !== id);
    this.saveItems(items);
  }

  updateBox(id, patch) {
    const items = this.getItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    items[index] = { ...items[index], ...patch };
    this.saveItems(items);
  }

  // Moves a box to a target column/position and renumbers order within
  // affected columns so ordering stays consistent.
  moveBox(id, targetColumn, targetIndex) {
    const items = this.getItems();
    const moving = items.find((item) => item.id === id);
    if (!moving) return;

    const remaining = items.filter((item) => item.id !== id);
    const destColumnItems = remaining
      .filter((item) => item.column === targetColumn)
      .sort((a, b) => a.order - b.order);

    const clampedIndex = Math.max(
      0,
      Math.min(targetIndex, destColumnItems.length),
    );
    destColumnItems.splice(clampedIndex, 0, moving);

    destColumnItems.forEach((item, index) => {
      item.column = targetColumn;
      item.order = index;
    });

    const untouched = remaining.filter((item) => item.column !== targetColumn);
    this.saveItems([...untouched, ...destColumnItems]);
  }

  render() {
    if (!this.gridContainer) return;
    this._observers.forEach((observer) => observer.disconnect());
    this._observers.clear();
    this._resizeTimers.forEach((timer) => clearTimeout(timer));
    this._resizeTimers.clear();
    this.gridContainer.innerHTML = "";

    const items = this.getItems();
    const columns = Array.from({ length: COLUMN_COUNT }, () => []);
    items.forEach((item) => columns[item.column].push(item));
    columns.forEach((columnItems) => columnItems.sort((a, b) => a.order - b.order));

    const savedWidths = this.getColumnWidths();

    columns.forEach((columnItems, columnIndex) => {
      const column = document.createElement("div");
      column.className = "board-column";
      column.dataset.column = String(columnIndex);
      column.style.width = savedWidths[columnIndex] ||
        `calc(${100 / COLUMN_COUNT}% - 9px)`;

      column.addEventListener("dragover", (e) => {
        e.preventDefault();
        column.classList.add("is-drop-target");
      });
      column.addEventListener("dragleave", (e) => {
        if (e.target === column) column.classList.remove("is-drop-target");
      });
      column.addEventListener("drop", (e) => {
        e.preventDefault();
        column.classList.remove("is-drop-target");
        const id = e.dataTransfer.getData("text/plain");
        if (!id) return;
        const siblings = Array.from(
          column.querySelectorAll(".board-box:not(.is-dragging)"),
        );
        let targetIndex = siblings.length;
        for (let i = 0; i < siblings.length; i += 1) {
          const rect = siblings[i].getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            targetIndex = i;
            break;
          }
        }
        this.moveBox(id, columnIndex, targetIndex);
      });

      columnItems.forEach((item) => {
        column.appendChild(this.renderBox(item));
      });

      this.gridContainer.appendChild(column);
    });
  }

  renderBox(item) {
    const box = document.createElement("div");
    box.className = "board-box";
    box.dataset.id = item.id;
    box.draggable = true;
    if (item.height) box.style.height = item.height;

    box.addEventListener("dragstart", (e) => {
      box.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", item.id);
    });
    box.addEventListener("dragend", () => {
      box.classList.remove("is-dragging");
      this.gridContainer
        .querySelectorAll(".board-column.is-drop-target")
        .forEach((el) => el.classList.remove("is-drop-target"));
    });

    const header = document.createElement("div");
    header.className = "board-box-header";

    const title = document.createElement("span");
    title.className = "board-box-title board-box-drag-handle";
    title.title = "Drag to move";
    title.textContent = item.title || "Untitled";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "board-box-edit-btn";
    editBtn.setAttribute("aria-label", `Edit ${item.title || "box"}`);
    editBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path opacity="0.4" d="M11 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22H15C20 22 22 20 22 15V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16.0399 3.01976L8.15988 10.8998C7.85988 11.1998 7.55988 11.7898 7.49988 12.2198L7.06988 15.2298C6.90988 16.3198 7.67988 17.0798 8.76988 16.9299L11.7799 16.4998C12.1999 16.4398 12.7899 16.1398 13.0999 15.8398L20.9799 7.95976C22.3399 6.59976 22.9799 5.01976 20.9799 3.01976C18.9799 1.01976 17.3999 1.65976 16.0399 3.01976Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    editBtn.addEventListener("click", () => this.openEditor(item.id));

    header.append(title, editBtn);

    const content = document.createElement("div");
    content.className = "board-box-content";
    this.renderContent(content, item);

    box.append(header, content);

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (!box.isConnected) return;
        clearTimeout(this._resizeTimers.get(item.id));
        this._resizeTimers.set(
          item.id,
          setTimeout(() => {
            if (!box.isConnected || box.offsetWidth === 0 || box.offsetHeight === 0) {
              return;
            }
            this.persistBoxSize(
              item.id,
              `${box.offsetWidth}px`,
              `${box.offsetHeight}px`,
            );
          }, 400),
        );
      });
      resizeObserver.observe(box);
      this._observers.set(item.id, resizeObserver);
    }

    return box;
  }

  renderContent(content, item) {
    content.classList.toggle("is-image", item.type === "image");
    if (item.type === "image" && item.content) {
      content.innerHTML = `<img src="${escapeHtml(item.content)}" alt="${escapeHtml(item.title || "")}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'board-box-empty',textContent:'Image failed to load.'}))" />`;
    } else if (item.type === "text" && item.content) {
      content.innerHTML = autoLink(escapeHtml(item.content));
    } else {
      content.innerHTML = `<span class="board-box-empty">Click the pencil icon to add content.</span>`;
    }
  }

  openEditor(id) {
    const item = this.getItems().find((entry) => entry.id === id);
    if (!item) return;

    const overlay = document.createElement("div");
    overlay.className = "board-edit-overlay";
    overlay.setAttribute("role", "presentation");

    const box = document.createElement("div");
    box.className = "board-edit-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    const heading = document.createElement("h2");
    heading.textContent = "Edit Box";

    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = MAX_TITLE_LENGTH;
    titleInput.value = item.title || "";

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Content Type";
    const typeRow = document.createElement("div");
    typeRow.className = "board-content-type-row";
    const textBtn = document.createElement("button");
    textBtn.type = "button";
    textBtn.textContent = "Text";
    const imageBtn = document.createElement("button");
    imageBtn.type = "button";
    imageBtn.textContent = "Image";
    typeRow.append(textBtn, imageBtn);

    const contentLabel = document.createElement("label");
    const textarea = document.createElement("textarea");
    textarea.maxLength = MAX_CONTENT_LENGTH;
    textarea.placeholder = "Add text. URLs (https://...) become clickable links.";
    textarea.value = item.type === "text" ? item.content || "" : "";

    const imageUrlInput = document.createElement("input");
    imageUrlInput.type = "text";
    imageUrlInput.placeholder = "Image URL, or upload a file below";
    imageUrlInput.value = item.type === "image" ? item.content || "" : "";

    const imageFileInput = document.createElement("input");
    imageFileInput.type = "file";
    imageFileInput.accept = "image/*";
    imageFileInput.style.marginTop = "8px";

    let currentType = item.type === "image" ? "image" : "text";
    const syncTypeUi = () => {
      textBtn.classList.toggle("active", currentType === "text");
      imageBtn.classList.toggle("active", currentType === "image");
      textarea.style.display = currentType === "text" ? "block" : "none";
      imageUrlInput.style.display = currentType === "image" ? "block" : "none";
      imageFileInput.style.display = currentType === "image" ? "block" : "none";
    };
    syncTypeUi();

    textBtn.addEventListener("click", () => {
      currentType = "text";
      syncTypeUi();
    });
    imageBtn.addEventListener("click", () => {
      currentType = "image";
      syncTypeUi();
    });

    imageFileInput.addEventListener("change", () => {
      const file = imageFileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        imageUrlInput.value = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });

    contentLabel.textContent = "Content";
    contentLabel.append();

    const actions = document.createElement("div");
    actions.className = "board-edit-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "settings-button danger-hover";
    deleteBtn.textContent = "Delete";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "settings-button";
    cancelBtn.style.cssText =
      "background-color: var(--bg-interactive); color: var(--text-primary);";
    cancelBtn.textContent = "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "settings-button";
    saveBtn.textContent = "Save";

    actions.append(deleteBtn, cancelBtn, saveBtn);

    box.append(
      heading,
      titleLabel,
      titleInput,
      typeLabel,
      typeRow,
      contentLabel,
      textarea,
      imageUrlInput,
      imageFileInput,
      actions,
    );
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    titleInput.focus();

    const close = () => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    cancelBtn.addEventListener("click", close);

    deleteBtn.addEventListener("click", () => {
      this.deleteBox(item.id);
      close();
    });

    saveBtn.addEventListener("click", () => {
      const newTitle = titleInput.value.trim().slice(0, MAX_TITLE_LENGTH);
      const newContent = currentType === "image"
        ? imageUrlInput.value.trim()
        : textarea.value.slice(0, MAX_CONTENT_LENGTH);
      this.updateBox(item.id, {
        title: newTitle,
        type: currentType,
        content: newContent,
      });
      close();
    });
  }
}

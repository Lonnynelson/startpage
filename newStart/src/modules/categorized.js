import { escapeHtml } from "../utils.js";

export class CategorizedManager {
  constructor() {
    this.gridContainer = document.getElementById("categorized-list-container");
    this.editorList = document.getElementById("categorized-editor-list");
    this.form = document.getElementById("categorized-form");

    if (!this.gridContainer && !this.editorList && !this.form) return;

    window.__categorizedManagerInstance = this;
    this.init();
  }

  getItems() {
    try {
      const raw = localStorage.getItem("userCategorizedList");
      if (raw === null) {
        return [
          { category: "AS", name: "Time Clock", url: "http://asiisi:8080/", icon: "https://www.google.com/s2/favicons?sz=64&domain=asiisi" },
          { category: "AS", name: "AdventSource", url: "https://adventsource.org/", icon: "https://www.google.com/s2/favicons?sz=64&domain=adventsource.org" },
          { category: "Events", name: "Bizzabo", url: "https://accounts.bizzabo.com/", icon: "https://www.google.com/s2/favicons?sz=64&domain=accounts.bizzabo.com" },
          { category: "Events", name: "QR Code Gen", url: "https://lonnystartpage.pages.dev/QR_Code_Gennerator.html", icon: "https://www.google.com/s2/favicons?sz=64&domain=lonnystartpage.pages.dev" }
        ];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[CategorizedManager] Failed to parse userCategorizedList:", e);
      return [];
    }
  }

  saveItems(items) {
    localStorage.setItem("userCategorizedList", JSON.stringify(items));
    this.render();
  }

  init() {
    this.render();

    if (this.form) {
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const catInput = document.getElementById("categorized-category-input");
        const nameInput = document.getElementById("categorized-name-input");
        const urlInput = document.getElementById("categorized-url-input");

        const category = catInput?.value.trim();
        const name = nameInput?.value.trim();
        let url = urlInput?.value.trim();

        if (!category || !name || !url) return;
        if (!/^https?:\/\//i.test(url) && !/^\//.test(url)) {
          url = "https://" + url;
        }

        const items = this.getItems();
        items.push({
          category,
          name,
          url,
          icon: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(url)}`
        });

        this.saveItems(items);

        if (catInput) catInput.value = "";
        if (nameInput) nameInput.value = "";
        if (urlInput) urlInput.value = "";
      });
    }

    window.addEventListener("storage", (e) => {
      if (e.key === "userCategorizedList" || e.key === null) {
        this.render();
      }
    });
  }

  render() {
    const items = this.getItems();
    this.renderGrid(items);
    this.renderEditor(items);
  }

  renderGrid(items) {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = "";

    if (items.length === 0) {
      this.gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No categorized links available.</p>
          <p style="font-size: 0.9rem;">Import your backup file in Settings or add new categorized items.</p>
        </div>
      `;
      return;
    }

    const categoriesMap = new Map();
    items.forEach((item) => {
      const cat = item.category || "General";
      if (!categoriesMap.has(cat)) {
        categoriesMap.set(cat, []);
      }
      categoriesMap.get(cat).push(item);
    });

    categoriesMap.forEach((categoryItems, categoryName) => {
      const dropdown = document.createElement("div");
      dropdown.className = "category-dropdown";

      const header = document.createElement("div");
      header.className = "category-header";
      header.innerHTML = `
        <span>${escapeHtml(categoryName)}</span>
        <span style="font-size: 0.75rem; opacity: 0.7;">▼</span>
      `;

      const menu = document.createElement("div");
      menu.className = "dropdown-menu";

      categoryItems.forEach((linkItem) => {
        const a = document.createElement("a");
        a.href = linkItem.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        const iconSrc = linkItem.customIcon || linkItem.icon || `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(linkItem.url)}`;

        a.innerHTML = `
          <img src="${escapeHtml(iconSrc)}" alt="" style="width: 16px; height: 16px; margin-right: 8px; border-radius: 3px; object-fit: contain; flex-shrink: 0;" onError="this.style.display='none'" />
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(linkItem.name)}</span>
        `;

        menu.appendChild(a);
      });

      dropdown.appendChild(header);
      dropdown.appendChild(menu);
      this.gridContainer.appendChild(dropdown);
    });
  }

  renderEditor(items) {
    if (!this.editorList) return;
    this.editorList.innerHTML = "";

    if (items.length === 0) {
      this.editorList.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem 0;">No categorized items added yet.</p>`;
      return;
    }

    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "setting-row";
      row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color);";

      row.innerHTML = `
        <div style="min-width: 0; flex: 1; margin-right: 8px;">
          <div style="font-weight: 600; font-size: 0.85rem;">[${escapeHtml(item.category)}] ${escapeHtml(item.name)}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.url)}</div>
        </div>
        <button class="settings-button danger" style="padding: 2px 8px; font-size: 0.75rem;">Delete</button>
      `;

      row.querySelector("button").addEventListener("click", () => {
        const next = this.getItems();
        next.splice(index, 1);
        this.saveItems(next);
      });

      this.editorList.appendChild(row);
    });
  }
}

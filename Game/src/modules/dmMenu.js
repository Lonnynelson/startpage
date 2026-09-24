import { escapeHtml } from "../utils.js";

const STORAGE_KEY = "dmScreenMenuList";

export class DmMenuManager {
  constructor() {
    this.gridContainer = document.getElementById("dm-menu-list-container");
    if (!this.gridContainer) return;

    window.__dmMenuManagerInstance = this;
    this.render();

    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY || e.key === null) this.render();
    });
  }

  getItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return [
          {
            category: "Rules",
            name: "Conditions Reference",
            url: "https://www.dndbeyond.com/sources/basic-rules/appendix-a-conditions",
          },
          {
            category: "Rules",
            name: "Combat Actions",
            url: "https://www.dndbeyond.com/sources/basic-rules/combat",
          },
        ];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[DmMenuManager] Failed to parse dmScreenMenuList:", e);
      return [];
    }
  }

  saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.render();
  }

  render() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = "";

    const items = this.getItems();

    if (items.length === 0) {
      this.gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No DM menu links available.</p>
          <p style="font-size: 0.9rem;">Add items in Settings &gt; DM Menu.</p>
        </div>
      `;
      return;
    }

    const categoriesMap = new Map();
    items.forEach((item) => {
      const cat = item.category || "General";
      if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
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

        const iconSrc =
          linkItem.customIcon ||
          linkItem.icon ||
          `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(linkItem.url)}`;

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
}

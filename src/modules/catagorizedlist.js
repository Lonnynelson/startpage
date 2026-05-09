import { state } from "../state.js";
import { getIconUrl } from "../utils.js";
import { CONFIG } from "../config.js";

export class CategorizedList {
  constructor() {
    this.container = document.getElementById("categorized-list-container");
    this.defaults = [
      { category: "Video", name: "YouTube", url: "https://www.youtube.com" },
      { category: "Social", name: "LinkedIn", url: "https://www.linkedin.com/" },
      { category: "Social", name: "Facebook", url: "https://www.facebook.com" },
      { category: "Social", name: "Reddit", url: "https://www.reddit.com" },
      { category: "Shopping", name: "Amazon", url: "https://www.amazon.com" },
    ];

    this.init();
  }

  init() {
    const current = state.get("userCategorizedList");

    if (!current || !Array.isArray(current)) {
      const withIcons = this.defaults.map((s) => ({
        ...s,
        icon: getIconUrl(s.url),
      }));
      state.set("userCategorizedList", withIcons);
    }

    this.render();

    state.subscribe((key) => {
      if (key === "userCategorizedList") {
        this.render();
      }
      if (key === "linkTargets") this.render();
    });
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const items = state.get("userCategorizedList") || [];

    // Group by category
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    Object.keys(grouped).forEach(category => {
      const categoryDiv = document.createElement("div");
      categoryDiv.className = "category-dropdown";

      const categoryHeader = document.createElement("div");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = category;
      categoryDiv.appendChild(categoryHeader);

      const dropdownMenu = document.createElement("div");
      dropdownMenu.className = "dropdown-menu";

      grouped[category].forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "dropdown-item";

        const img = document.createElement("img");
        img.src = item.customIcon || item.icon || getIconUrl(item.url);
        img.alt = item.name;
        img.onerror = () => {
          img.style.display = "none";
          const span = document.createElement("span");
          span.className = "item-fallback-text";
          span.textContent = item.name.charAt(0).toUpperCase();
          div.insertBefore(span, div.firstChild);
        };

        const span = document.createElement("span");
        span.textContent = item.name;

        div.appendChild(img);
        div.appendChild(span);

        div.addEventListener("click", () => {
          window.open(item.url, state.get("linkTargets")?.shortcuts || "_blank");
        });

        dropdownMenu.appendChild(div);
      });

      categoryDiv.appendChild(dropdownMenu);
      this.container.appendChild(categoryDiv);
    });
  }

}
// [src/modules/catagorizedlist.js] YourDynamicDashboard V2.2 (Ditom Baroi Antu - 2025-26)

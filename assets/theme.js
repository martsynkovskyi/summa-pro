"use strict";
(() => {
  const key = "summaAppearanceThemeV1";
  const valid = new Set(["system", "light", "dark"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let choice = "system";
  try {
    const stored = localStorage.getItem(key);
    if (valid.has(stored)) choice = stored;
  } catch (_) {}

  function apply() {
    const effective = choice === "system" ? (media.matches ? "dark" : "light") : choice;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
    const color = effective === "dark" ? "#111c2d" : "#0f3d91";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const tileMeta = document.querySelector('meta[name="msapplication-TileColor"]');
    if (themeMeta) themeMeta.content = color;
    if (tileMeta) tileMeta.content = color;
  }

  window.__SUMMA_THEME__ = {
    get choice() { return choice; },
    set(next) {
      if (!valid.has(next)) return;
      choice = next;
      try { localStorage.setItem(key, choice); } catch (_) {}
      apply();
    }
  };
  media.addEventListener("change", () => { if (choice === "system") apply(); });
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    choice = valid.has(event.newValue) ? event.newValue : "system";
    apply();
    const select = document.getElementById("themeChoice");
    if (select) {
      select.value = choice;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  apply();
  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("themeChoice");
    if (!select) return;
    select.value = choice;
    select.addEventListener("change", () => window.__SUMMA_THEME__.set(select.value));
  });
})();

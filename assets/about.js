"use strict";
(() => {
  const version = "3.1";
  const acknowledgedKey = "summaReleaseAcknowledgedV1";
  const priorKeys = ["summaPropisyuSettingsV2", "summaPropisyuHistoryV1"];

  document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("infoModal");
    const scroll = document.getElementById("infoScroll");
    const title = document.getElementById("infoDialogTitle");
    const subtitle = document.getElementById("infoDialogSubtitle");
    const news = document.getElementById("infoNewsView");
    const about = document.getElementById("infoAboutView");
    const historyButton = document.getElementById("infoHistoryBtn");
    const backButton = document.getElementById("infoBackBtn");
    const doneButton = document.getElementById("infoDoneBtn");
    let opener = null;
    let fromNews = false;
    let contentPromise;

    const element = (tag, value, className) => {
      const node = document.createElement(tag);
      if (value) node.textContent = value;
      if (className) node.className = className;
      return node;
    };
    const appendList = (parent, items) => {
      if (!items.length) return;
      const list = element("ul");
      for (const item of items) list.append(element("li", item));
      parent.append(list);
    };

    function parseReadme(markdown) {
      const parsed = { introduction: [], sections: [], versions: [] };
      let section = null;
      let release = null;
      for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trim().replace(/`/g, "");
        if (!line || line.startsWith("# ")) continue;
        if (line.startsWith("## ")) {
          section = { title: line.slice(3), paragraphs: [], bullets: [] };
          parsed.sections.push(section);
          release = null;
        } else if (line.startsWith("### ") && section?.title === "История версий") {
          release = { title: line.slice(4), bullets: [] };
          parsed.versions.push(release);
        } else if (line.startsWith("- ")) {
          if (release) release.bullets.push(line.slice(2));
          else if (section) section.bullets.push(line.slice(2));
        } else if (section && !release && !line.startsWith("```")) section.paragraphs.push(line);
        else if (!section) parsed.introduction.push(line);
      }
      return parsed;
    }

    function render(parsed) {
      const current = parsed.versions.find(item => item.title.startsWith(`${version} - `));
      if (!current) throw new Error("Current release missing from README");
      news.replaceChildren(element("p", "Главные изменения этого выпуска:", "info-intro"));
      appendList(news, current.bullets);
      about.replaceChildren();
      for (const paragraph of parsed.introduction) about.append(element("p", paragraph, "info-intro"));
      for (const section of parsed.sections) {
        if (!["Возможности", "Хранение данных", "История версий"].includes(section.title)) continue;
        const heading = element("h3", section.title);
        if (section.title === "История версий") heading.id = "infoHistoryHeading";
        about.append(heading);
        if (section.title !== "История версий") {
          for (const paragraph of section.paragraphs) about.append(element("p", paragraph));
          appendList(about, section.bullets);
          continue;
        }
        for (const paragraph of section.paragraphs) about.append(element("p", paragraph));
        for (const [index, release] of parsed.versions.entries()) {
          const details = element("details", "", "info-release");
          if (index === 0) details.open = true;
          details.append(element("summary", release.title));
          appendList(details, release.bullets);
          about.append(details);
        }
      }
      return current.title;
    }

    function loadContent() {
      if (!contentPromise) contentPromise = fetch("./README.md")
        .then(response => { if (!response.ok) throw new Error("README unavailable"); return response.text(); })
        .then(markdown => render(parseReadme(markdown)))
        .catch(() => { contentPromise = null; return null; });
      return contentPromise;
    }

    function showView(view, toHistory = false) {
      const isNews = view === "news";
      news.hidden = !isNews;
      about.hidden = isNews;
      title.textContent = isNews ? "Что нового?" : "О сервисе";
      subtitle.textContent = isNews ? `Версия ${version}` : "Сумма прописью";
      historyButton.hidden = !isNews;
      backButton.hidden = isNews || !fromNews;
      scroll.scrollTop = 0;
      if (toHistory) requestAnimationFrame(() => {
        const heading = document.getElementById("infoHistoryHeading");
        if (heading) scroll.scrollTop = heading.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 8;
      });
    }

    async function open(view, automatic = false) {
      if (!modal.hidden) return;
      const releaseTitle = await loadContent();
      if (!releaseTitle && automatic) return;
      if (!releaseTitle) {
        news.replaceChildren(element("p", "Описание сейчас недоступно. Попробуйте открыть его позже."));
        about.replaceChildren(element("p", "Описание сейчас недоступно. Попробуйте открыть его позже."));
      }
      opener = automatic ? null : document.activeElement;
      fromNews = view === "news";
      showView(view);
      if (releaseTitle && view === "news") subtitle.textContent = `Версия ${releaseTitle}`;
      modal.hidden = false;
      document.body.classList.add("info-open");
      doneButton.focus({ preventScroll: true });
    }

    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.body.classList.remove("info-open");
      if (fromNews) {
        try { localStorage.setItem(acknowledgedKey, version); } catch (_) {}
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    }

    document.getElementById("aboutServiceBtn").addEventListener("click", () => open("about"));
    historyButton.addEventListener("click", () => showView("about", true));
    backButton.addEventListener("click", () => showView("news"));
    doneButton.addEventListener("click", close);
    modal.querySelector("[data-close-info]").addEventListener("click", close);
    document.addEventListener("keydown", event => {
      if (modal.hidden) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...modal.querySelectorAll("button:not([disabled]), summary")].filter(node => !node.hidden && !node.closest("[hidden]") && node.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, true);

    try {
      const seen = localStorage.getItem(acknowledgedKey);
      const returning = priorKeys.some(key => localStorage.getItem(key) !== null) || Boolean(navigator.serviceWorker?.controller);
      if (seen !== version && returning) window.setTimeout(() => open("news", true), 450);
    } catch (_) {}
  });
})();

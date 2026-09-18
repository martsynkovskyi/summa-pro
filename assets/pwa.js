(() => {
  "use strict";

  const installButton = document.getElementById("pwaInstallButton");
  const dialog = document.getElementById("pwaInstallDialog");
  const dialogTitle = document.getElementById("pwaDialogTitle");
  const dialogText = document.getElementById("pwaDialogText");
  const steps = document.getElementById("pwaInstallSteps");
  const dialogCloseButtons = [...document.querySelectorAll("[data-pwa-close]")];
  const appShell = document.querySelector(".app-shell");

  if (!installButton || !dialog || !steps) return;

  const appName = document.querySelector('meta[name="application-name"]')?.content || document.title;
  const secureContext = location.protocol === "https:" || ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const isFirefox = /FxiOS|Firefox/.test(ua);
  const isSafari = /Safari/.test(ua) && !/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Opera|FxiOS|Firefox)/.test(ua);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let deferredPrompt = null;
  let dialogOpener = null;
  let reloadingForUpdate = false;

  function canOfferInstall() {
    if (!secureContext || isStandalone()) return false;
    if (isFirefox && !isIOS) return false;
    return true;
  }

  function updateInstallButton() {
    installButton.hidden = !canOfferInstall();
  }

  function fillInstructions() {
    steps.replaceChildren();
    const list = [];

    if (isIOS) {
      dialogTitle.textContent = "Добавить на экран «Домой»";
      dialogText.textContent = `Браузер установит «${appName}» как отдельное веб-приложение.`;
      list.push("Нажмите кнопку «Поделиться» в панели браузера.");
      list.push("Выберите «На экран Домой».");
      list.push("Подтвердите название и нажмите «Добавить».");
    } else if (isMac && isSafari) {
      dialogTitle.textContent = "Добавить приложение в Dock";
      dialogText.textContent = `Safari создаст отдельное приложение «${appName}» с собственной иконкой.`;
      list.push("Откройте меню «Файл» в Safari.");
      list.push("Выберите «Добавить в Dock…».");
      list.push("Проверьте название и нажмите «Добавить».");
    } else {
      dialogTitle.textContent = "Установить приложение";
      dialogText.textContent = `Добавьте «${appName}» на устройство для быстрого запуска.`;
      list.push("Откройте меню браузера.");
      list.push("Выберите «Установить приложение» или «Добавить на главный экран».");
      list.push("Подтвердите установку.");
    }

    list.forEach(value => {
      const item = document.createElement("li");
      item.textContent = value;
      steps.appendChild(item);
    });
  }

  function getFocusableElements() {
    return [...dialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter(element => !element.hidden);
  }

  function openDialog() {
    dialogOpener = document.activeElement;
    fillInstructions();
    dialog.hidden = false;
    document.body.classList.add("pwa-dialog-open");
    if (appShell) appShell.inert = true;
    dialog.querySelector(".pwa-dialog-close")?.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    document.body.classList.remove("pwa-dialog-open");
    if (appShell) appShell.inert = false;
    if (dialogOpener instanceof HTMLElement) dialogOpener.focus({ preventScroll: true });
    dialogOpener = null;
  }

  async function install() {
    if (!deferredPrompt) {
      openDialog();
      return;
    }

    installButton.disabled = true;
    const label = installButton.querySelector("span");
    const oldText = label?.textContent || "Установить приложение";
    if (label) label.textContent = "Открываем…";

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") installButton.hidden = true;
      deferredPrompt = null;
    } catch (error) {
      console.warn("Не удалось открыть системный диалог установки:", error);
      openDialog();
    } finally {
      installButton.disabled = false;
      if (label) label.textContent = oldText;
    }
  }

  function announceUpdate(registration) {
    if (!registration.waiting || !navigator.serviceWorker.controller) return;
    window.dispatchEvent(new CustomEvent("summa:update-ready", {
      detail: {
        apply: () => {
          reloadingForUpdate = true;
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }
      }
    }));
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !secureContext) return;

    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js?v=3.1-update1", {
        scope: "./",
        updateViaCache: "none"
      });
      announceUpdate(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") announceUpdate(registration);
        });
      });
      registration.update().catch(() => {});
    } catch (error) {
      console.warn("Не удалось включить автономный режим:", error);
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.hidden = true;
  });

  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) location.reload();
  });

  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", updateInstallButton);
  installButton.addEventListener("click", install);
  dialogCloseButtons.forEach(button => button.addEventListener("click", closeDialog));
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener("keydown", event => {
    if (dialog.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  updateInstallButton();
  registerServiceWorker();

  window.__PWA_STATUS__ = Object.freeze({
    appName,
    secureContext,
    isSafari,
    isIOS,
    isMac,
    isFirefox,
    isStandalone
  });
})();

(() => {
  "use strict";

  const Core = window.SummaCore;
  if (!Core) throw new Error("Модуль расчётов не загружен");

  const APP_VERSION = "2.3";
  const STORAGE_KEY = "summaPropisyuSettingsV3";
  const LEGACY_STORAGE_KEYS = ["summaPropisyuSettingsV2"];
  const HISTORY_KEY = "summaPropisyuHistoryV1";
  const MAX_HISTORY = 10;
  const SAVE_DELAY = 280;

  const form = document.getElementById("calculatorForm");
  const amountInput = document.getElementById("amount");
  const amountLabel = document.querySelector('label[for="amount"]');
  const amountError = document.getElementById("amountError");
  const formatSelect = document.getElementById("format");
  const vatReasonSelect = document.getElementById("vatReason");
  const rateField = document.getElementById("rateField");
  const vatReasonField = document.getElementById("vatReasonField");
  const resetButton = document.getElementById("resetBtn");
  const copyAllButton = document.getElementById("copyAllBtn");
  const copyAllLabel = document.getElementById("copyAllLabel");
  const formatExample = document.getElementById("formatExample");
  const calculationBadge = document.getElementById("calculationBadge");

  const baseLine = document.getElementById("baseLine");
  const vatLine = document.getElementById("vatLine");
  const totalLine = document.getElementById("totalLine");
  const fullLineText = document.getElementById("fullLineText");
  const aboveLineText = document.getElementById("aboveLineText");
  const fullLineCard = document.getElementById("fullLineCard");
  const aboveLineCard = document.getElementById("aboveLineCard");
  const fullLineKicker = document.getElementById("fullLineKicker");
  const aboveLineKicker = document.getElementById("aboveLineKicker");
  const fullLineTitle = document.getElementById("fullLineTitle");
  const aboveLineTitle = document.getElementById("aboveLineTitle");
  const copyTargets = [...document.querySelectorAll(".copy-target")];

  const saveIndicator = document.getElementById("saveIndicator");
  const saveStatusText = document.getElementById("saveStatusText");

  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyCount = document.getElementById("historyCount");
  const clearHistoryButton = document.getElementById("clearHistoryBtn");

  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const toastAction = document.getElementById("toastAction");
  const toastClose = document.getElementById("toastClose");

  const allowedSettings = {
    rate: ["22", "5"],
    mode: ["included", "above", "none"],
    format: ["f1", "f2", "f3", "f4"],
    vatReason: ["usn", "npd", "person"]
  };

  const defaults = {
    amount: "0",
    rate: "22",
    mode: "above",
    format: "f1",
    vatReason: "usn"
  };

  let saveTimer = 0;
  let toastTimer = 0;
  let copiedTimer = 0;
  let copyAllTimer = 0;
  let undoSnapshot = null;
  let hasUserInput = false;
  let history = [];

  const current = {
    valid: true,
    amount: 0,
    rate: 22,
    mode: "above",
    format: "f1",
    vatReason: "usn",
    base: 0,
    vat: 0,
    total: 0,
    recommendedKey: "above",
    texts: {
      base: "",
      vat: "",
      total: "",
      full: "",
      above: ""
    }
  };

  function getCheckedValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || defaults[name];
  }

  function setCheckedValue(name, value) {
    const safeValue = allowedSettings[name]?.includes(String(value)) ? String(value) : defaults[name];
    const input = document.querySelector(`input[name="${name}"][value="${safeValue}"]`);
    if (input) input.checked = true;
  }

  function isAllowed(key, value) {
    return allowedSettings[key]?.includes(String(value)) || false;
  }

  function setSaveState(state, text) {
    saveIndicator.dataset.state = state;
    saveStatusText.textContent = text;
  }

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatHistoryDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);

    if (sameDay) return `Сегодня, ${time}`;

    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date).replace(" г.", "");
  }

  function sanitizeSavedAmount(value) {
    return String(value ?? "")
      .slice(0, 32)
      .replace(/[^0-9.,\s\u00a0\u202f']/g, "");
  }

  function snapshot() {
    return {
      amount: amountInput.value,
      rate: getCheckedValue("rate"),
      mode: getCheckedValue("mode"),
      format: formatSelect.value,
      vatReason: vatReasonSelect.value
    };
  }

  function restoreSnapshot(data, { save = true, focus = false } = {}) {
    if (!data) return;

    amountInput.value = sanitizeSavedAmount(data.amount);
    setCheckedValue("rate", data.rate);
    setCheckedValue("mode", data.mode);
    formatSelect.value = isAllowed("format", data.format) ? data.format : defaults.format;
    vatReasonSelect.value = isAllowed("vatReason", data.vatReason) ? data.vatReason : defaults.vatReason;
    hasUserInput = true;
    calculate();

    if (save) scheduleSave();
    if (focus) amountInput.focus();
  }

  function loadSettings() {
    let restored = false;
    let sourceKey = STORAGE_KEY;

    try {
      let raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          raw = localStorage.getItem(legacyKey);
          if (raw) {
            sourceKey = legacyKey;
            break;
          }
        }
      }

      if (raw) {
        const saved = JSON.parse(raw);
        restoreSnapshot({
          amount: saved.amount ?? defaults.amount,
          rate: isAllowed("rate", saved.rate) ? saved.rate : defaults.rate,
          mode: isAllowed("mode", saved.mode) ? saved.mode : defaults.mode,
          format: isAllowed("format", saved.format) ? saved.format : defaults.format,
          vatReason: isAllowed("vatReason", saved.vatReason) ? saved.vatReason : defaults.vatReason
        }, { save: false });
        restored = true;

        if (sourceKey !== STORAGE_KEY) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
        }
      }
    } catch (error) {
      console.warn("Не удалось восстановить черновик:", error);
      setSaveState("error", "Сохранение недоступно");
    }

    if (!restored) {
      restoreSnapshot(defaults, { save: false });
      hasUserInput = false;
      setSaveState("idle", "Черновик не изменён");
    } else {
      hasUserInput = false;
      setSaveState("saved", "Черновик восстановлен");
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
      setSaveState("saved", `Сохранено в ${formatTime()}`);
    } catch (error) {
      console.warn("Не удалось сохранить черновик:", error);
      setSaveState("error", "Сохранение недоступно");
    }
  }

  function scheduleSave() {
    if (!hasUserInput) return;
    clearTimeout(saveTimer);
    setSaveState("saving", "Сохраняем…");
    saveTimer = window.setTimeout(saveSettings, SAVE_DELAY);
  }

  function formatAmount(amount, format = formatSelect.value) {
    return Core.formatAmount(amount, format);
  }

  function setOutputText(element, value) {
    element.textContent = value;
  }

  function setInvalidState(message) {
    amountInput.setAttribute("aria-invalid", "true");
    amountError.textContent = message;
    current.valid = false;

    const placeholder = "Проверьте введённую сумму";
    setOutputText(baseLine, placeholder);
    setOutputText(vatLine, placeholder);
    setOutputText(totalLine, placeholder);
    setOutputText(fullLineText, "Исправьте сумму, чтобы получить готовую формулировку.");
    setOutputText(aboveLineText, "Исправьте сумму, чтобы получить готовую формулировку.");
    copyAllButton.disabled = true;
  }

  function clearInvalidState() {
    amountInput.removeAttribute("aria-invalid");
    amountError.textContent = "";
    current.valid = true;
    copyAllButton.disabled = false;
  }

  function updateModeUi(mode, rate) {
    const noVat = mode === "none";
    rateField.hidden = noVat;
    vatReasonField.hidden = !noVat;

    if (mode === "included") {
      amountLabel.textContent = "Сумма с НДС";
      calculationBadge.textContent = `НДС включён · ${rate}%`;
      fullLineCard.classList.add("is-recommended");
      aboveLineCard.classList.remove("is-recommended");
      fullLineKicker.textContent = "Рекомендуемый вариант";
      aboveLineKicker.textContent = "Дополнительный вариант";
      fullLineTitle.textContent = "Сумма «в том числе НДС»";
      aboveLineTitle.textContent = "Сумма «кроме того НДС»";
      aboveLineCard.hidden = false;
      return;
    }

    if (mode === "above") {
      amountLabel.textContent = "Сумма без НДС";
      calculationBadge.textContent = `НДС сверху · ${rate}%`;
      fullLineCard.classList.remove("is-recommended");
      aboveLineCard.classList.add("is-recommended");
      fullLineKicker.textContent = "Дополнительный вариант";
      aboveLineKicker.textContent = "Рекомендуемый вариант";
      fullLineTitle.textContent = "Сумма «в том числе НДС»";
      aboveLineTitle.textContent = "Сумма «кроме того НДС»";
      aboveLineCard.hidden = false;
      return;
    }

    amountLabel.textContent = "Сумма";
    calculationBadge.textContent = "Без НДС";
    fullLineCard.classList.add("is-recommended");
    aboveLineCard.classList.remove("is-recommended");
    fullLineKicker.textContent = "Готовая формулировка";
    fullLineTitle.textContent = "Сумма без НДС";
    aboveLineCard.hidden = true;
  }

  function calculate() {
    const parsed = Core.parseAmount(amountInput.value);
    const rate = Number(getCheckedValue("rate"));
    const mode = getCheckedValue("mode");
    const format = formatSelect.value;
    const vatReason = vatReasonSelect.value;

    updateModeUi(mode, rate);
    formatExample.textContent = Core.formatAmount(1234.56, format);

    current.amount = parsed.value;
    current.rate = rate;
    current.mode = mode;
    current.format = format;
    current.vatReason = vatReason;
    current.recommendedKey = mode === "above" ? "above" : "full";

    if (!parsed.valid) {
      const limit = new Intl.NumberFormat("ru-RU").format(Math.floor(Core.MAX_AMOUNT)).replace(/\u00a0/g, " ");
      setInvalidState(`Допустима сумма до ${limit} руб.`);
      return;
    }

    clearInvalidState();

    const values = Core.calculateValues(parsed.value, rate, mode);
    current.base = values.base;
    current.vat = values.vat;
    current.total = values.total;
    current.texts.base = Core.formatAmount(values.base, format);
    current.texts.vat = Core.formatAmount(values.vat, format);
    current.texts.total = Core.formatAmount(values.total, format);
    current.texts.full = Core.makeFullLine(values.total, values.vat, rate, mode, format, vatReason);
    current.texts.above = Core.makeAboveLine(values.base, values.vat, values.total, rate, mode, format, vatReason);

    setOutputText(baseLine, current.texts.base);
    setOutputText(vatLine, current.texts.vat);
    setOutputText(totalLine, current.texts.total);
    setOutputText(fullLineText, current.texts.full);
    setOutputText(aboveLineText, current.texts.above);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Clipboard API unavailable");
  }

  function markCopied(element) {
    clearTimeout(copiedTimer);
    copyTargets.forEach(target => target.removeAttribute("data-copied"));
    element.dataset.copied = "true";
    copiedTimer = window.setTimeout(() => element.removeAttribute("data-copied"), 1400);
  }

  function modeDescription(mode, rate) {
    if (mode === "included") return `НДС ${rate}% включён`;
    if (mode === "above") return `НДС ${rate}% сверху`;
    return "Без НДС";
  }

  function buildCopyAllText(entry = current) {
    if (entry.mode === "none") {
      return [
        `Сумма: ${entry.texts.total}`,
        "",
        "Готовая формулировка:",
        entry.texts.full
      ].join("\n");
    }

    return [
      `Сумма без НДС: ${entry.texts.base}`,
      `НДС ${entry.rate}%: ${entry.texts.vat}`,
      `Сумма с НДС: ${entry.texts.total}`,
      "",
      "Рекомендуемая формулировка:",
      entry.texts[entry.recommendedKey]
    ].join("\n");
  }

  function makeHistoryEntry() {
    const parsed = Core.parseAmount(amountInput.value);
    if (!current.valid || !parsed.valid || parsed.value <= 0) return null;

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      signature: [parsed.value, current.rate, current.mode, current.format, current.vatReason].join("|"),
      amount: parsed.value,
      amountInput: Core.inputMoney(parsed.value),
      rate: String(current.rate),
      mode: current.mode,
      format: current.format,
      vatReason: current.vatReason,
      recommendedKey: current.recommendedKey,
      texts: { ...current.texts },
      copyAll: buildCopyAllText(current)
    };
  }

  function sanitizeHistoryEntry(raw) {
    if (!raw || typeof raw !== "object") return null;

    const amount = Number(raw.amount);
    const rate = isAllowed("rate", raw.rate) ? String(raw.rate) : defaults.rate;
    const mode = isAllowed("mode", raw.mode) ? raw.mode : defaults.mode;
    const format = isAllowed("format", raw.format) ? raw.format : defaults.format;
    const vatReason = isAllowed("vatReason", raw.vatReason) ? raw.vatReason : defaults.vatReason;

    if (!Number.isFinite(amount) || amount <= 0 || amount > Core.MAX_AMOUNT) return null;

    const values = Core.calculateValues(amount, Number(rate), mode);
    const texts = {
      base: Core.formatAmount(values.base, format),
      vat: Core.formatAmount(values.vat, format),
      total: Core.formatAmount(values.total, format),
      full: Core.makeFullLine(values.total, values.vat, Number(rate), mode, format, vatReason),
      above: Core.makeAboveLine(values.base, values.vat, values.total, Number(rate), mode, format, vatReason)
    };
    const recommendedKey = mode === "above" ? "above" : "full";

    return {
      id: String(raw.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      createdAt: Number.isNaN(new Date(raw.createdAt).getTime()) ? new Date().toISOString() : new Date(raw.createdAt).toISOString(),
      signature: [amount, rate, mode, format, vatReason].join("|"),
      amount,
      amountInput: Core.inputMoney(amount),
      rate,
      mode,
      format,
      vatReason,
      recommendedKey,
      texts,
      copyAll: buildCopyAllText({ mode, rate: Number(rate), recommendedKey, texts })
    };
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      history = Array.isArray(parsed)
        ? parsed.map(sanitizeHistoryEntry).filter(Boolean).slice(0, MAX_HISTORY)
        : [];
    } catch (error) {
      console.warn("Не удалось восстановить историю:", error);
      history = [];
    }

    renderHistory();
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn("Не удалось сохранить историю:", error);
      showToast("Историю не удалось сохранить в браузере.", { tone: "warn" });
    }
  }

  function addCurrentToHistory() {
    const entry = makeHistoryEntry();
    if (!entry) return;

    history = [entry, ...history.filter(item => item.signature !== entry.signature)].slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function createSvgIcon(name) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const definitions = {
      restore: [
        ["path", { d: "M4 10a8 8 0 1 1 2.3 7.7", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round" }],
        ["path", { d: "M4 4v6h6", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }]
      ],
      copy: [
        ["rect", { x: "8", y: "8", width: "11", height: "11", rx: "3", fill: "none", stroke: "currentColor", "stroke-width": "1.8" }],
        ["rect", { x: "5", y: "5", width: "11", height: "11", rx: "3", fill: "none", stroke: "currentColor", "stroke-width": "1.8" }]
      ],
      delete: [
        ["path", { d: "M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" }],
        ["path", { d: "M10 11v5M14 11v5", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round" }]
      ]
    };

    for (const [tag, attributes] of definitions[name] || []) {
      const node = document.createElementNS(ns, tag);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      svg.appendChild(node);
    }

    return svg;
  }

  function createButton(className, label, iconName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    if (iconName) button.appendChild(createSvgIcon(iconName));
    const span = document.createElement("span");
    span.textContent = label;
    button.appendChild(span);
    return button;
  }

  function renderHistory() {
    historyList.replaceChildren();
    historyEmpty.hidden = history.length > 0;
    historyList.hidden = history.length === 0;
    historyCount.textContent = history.length ? `${history.length} из ${MAX_HISTORY}` : "Пока пусто";
    clearHistoryButton.disabled = history.length === 0;

    history.forEach(entry => {
      const card = document.createElement("article");
      card.className = "history-card";

      const top = document.createElement("div");
      top.className = "history-card-top";

      const titleGroup = document.createElement("div");
      titleGroup.className = "history-card-title";

      const amount = document.createElement("strong");
      amount.textContent = `${Core.inputMoney(entry.amount)} ₽`;

      const date = document.createElement("time");
      date.dateTime = entry.createdAt;
      date.textContent = formatHistoryDate(entry.createdAt);

      titleGroup.append(amount, date);

      const badge = document.createElement("span");
      badge.className = `history-mode history-mode-${entry.mode}`;
      badge.textContent = modeDescription(entry.mode, entry.rate);

      top.append(titleGroup, badge);

      const phrase = document.createElement("p");
      phrase.textContent = entry.texts[entry.recommendedKey];

      const actions = document.createElement("div");
      actions.className = "history-card-actions";

      const restoreButton = createButton("history-action history-action-primary", "Восстановить", "restore");
      restoreButton.addEventListener("click", () => {
        restoreSnapshot({
          amount: entry.amountInput,
          rate: entry.rate,
          mode: entry.mode,
          format: entry.format,
          vatReason: entry.vatReason
        }, { save: true, focus: true });
        showToast("Расчёт восстановлен из истории.");
        document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const copyButton = createButton("history-action", "Копировать", "copy");
      copyButton.addEventListener("click", async () => {
        try {
          await writeClipboard(entry.texts[entry.recommendedKey]);
          showToast("Формулировка из истории скопирована.");
        } catch (error) {
          console.error(error);
          showToast("Не удалось скопировать текст.", { tone: "error" });
        }
      });

      const deleteButton = createButton("history-action history-action-icon", "Удалить", "delete");
      deleteButton.setAttribute("aria-label", `Удалить расчёт ${Core.inputMoney(entry.amount)} рублей`);
      deleteButton.querySelector("span")?.remove();
      deleteButton.addEventListener("click", () => {
        history = history.filter(item => item.id !== entry.id);
        saveHistory();
        renderHistory();
        showToast("Расчёт удалён из истории.", { tone: "warn" });
      });

      actions.append(restoreButton, copyButton, deleteButton);
      card.append(top, phrase, actions);
      historyList.appendChild(card);
    });
  }

  async function copyResult(element) {
    if (!current.valid) {
      showToast("Сначала исправьте введённую сумму.", { tone: "error" });
      amountInput.focus();
      return;
    }

    const key = element.dataset.copyKey;
    const text = current.texts[key];
    if (!text) return;

    try {
      await writeClipboard(text);
      markCopied(element);
      addCurrentToHistory();
      showToast("Текст скопирован в буфер обмена.");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать текст. Выделите его вручную.", { tone: "error", duration: 6500 });
    }
  }

  async function copyAllResults() {
    if (!current.valid) {
      showToast("Сначала исправьте введённую сумму.", { tone: "error" });
      amountInput.focus();
      return;
    }

    const text = buildCopyAllText(current);

    try {
      await writeClipboard(text);
      addCurrentToHistory();
      copyAllButton.dataset.copied = "true";
      copyAllLabel.textContent = "Скопировано";
      clearTimeout(copyAllTimer);
      copyAllTimer = window.setTimeout(() => {
        copyAllButton.removeAttribute("data-copied");
        copyAllLabel.textContent = "Скопировать всё";
      }, 1600);
      showToast("Весь расчёт скопирован одним блоком.");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать расчёт.", { tone: "error" });
    }
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    toastAction.hidden = true;
    toastAction.textContent = "";
    toastAction.onclick = null;
    toast.removeAttribute("data-tone");
  }

  function showToast(message, options = {}) {
    const {
      tone = "success",
      duration = 3600,
      actionLabel = "",
      onAction = null
    } = options;

    clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;

    if (actionLabel && typeof onAction === "function") {
      toastAction.hidden = false;
      toastAction.textContent = actionLabel;
      toastAction.onclick = () => {
        hideToast();
        onAction();
      };
    } else {
      toastAction.hidden = true;
      toastAction.textContent = "";
      toastAction.onclick = null;
    }

    toastTimer = window.setTimeout(hideToast, duration);
  }

  function hasMeaningfulContent() {
    const state = snapshot();
    return (state.amount.trim() !== "" && state.amount.trim() !== "0") ||
      state.rate !== defaults.rate ||
      state.mode !== defaults.mode ||
      state.format !== defaults.format ||
      state.vatReason !== defaults.vatReason;
  }

  function clearForm() {
    undoSnapshot = snapshot();
    clearTimeout(saveTimer);
    amountInput.value = "";
    setCheckedValue("rate", defaults.rate);
    setCheckedValue("mode", defaults.mode);
    formatSelect.value = defaults.format;
    vatReasonSelect.value = defaults.vatReason;
    hasUserInput = false;

    try {
      localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      setSaveState("idle", "Черновик очищен");
    } catch (error) {
      console.warn("Не удалось очистить черновик:", error);
      setSaveState("error", "Сохранение недоступно");
    }

    calculate();
    amountInput.focus();
    showToast("Форма очищена.", {
      tone: "warn",
      actionLabel: "Отменить",
      onAction: () => {
        restoreSnapshot(undoSnapshot);
        showToast("Данные восстановлены.");
      },
      duration: 8000
    });
  }

  function clearHistory() {
    if (!history.length) return;
    const previous = [...history];
    history = [];
    saveHistory();
    renderHistory();
    showToast("История очищена.", {
      tone: "warn",
      actionLabel: "Отменить",
      onAction: () => {
        history = previous;
        saveHistory();
        renderHistory();
        showToast("История восстановлена.");
      },
      duration: 8000
    });
  }

  function onAmountBlur() {
    const parsed = Core.parseAmount(amountInput.value);
    if (!parsed.valid || parsed.empty) return;
    amountInput.value = Core.inputMoney(parsed.value);
    hasUserInput = true;
    scheduleSave();
    calculate();
  }

  function onUserChange() {
    hasUserInput = true;
    scheduleSave();
    calculate();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

    navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then(registration => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showToast("Доступна новая версия сервиса.", {
                actionLabel: "Обновить",
                onAction: () => location.reload(),
                duration: 10000
              });
            }
          });
        });
      })
      .catch(error => console.warn("Офлайн-режим недоступен:", error));
  }

  function bindEvents() {
    form.addEventListener("submit", event => event.preventDefault());

    amountInput.addEventListener("input", onUserChange);
    amountInput.addEventListener("blur", onAmountBlur);
    amountInput.addEventListener("focus", () => {
      window.setTimeout(() => amountInput.select(), 0);
    });

    document.querySelectorAll('input[name="mode"], input[name="rate"]').forEach(input => {
      input.addEventListener("change", onUserChange);
    });

    formatSelect.addEventListener("change", onUserChange);
    vatReasonSelect.addEventListener("change", onUserChange);

    copyTargets.forEach(target => {
      target.addEventListener("click", () => copyResult(target));
      target.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          copyResult(target);
        }
      });
    });

    copyAllButton.addEventListener("click", copyAllResults);

    resetButton.addEventListener("click", () => {
      if (hasMeaningfulContent()) clearForm();
      else showToast("Форма уже пустая.", { tone: "warn" });
    });

    clearHistoryButton.addEventListener("click", clearHistory);
    toastClose.addEventListener("click", hideToast);

    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        copyAllResults();
      }
    });

    window.addEventListener("offline", () => {
      showToast("Интернет недоступен. Расчёты продолжают работать офлайн.", { tone: "warn", duration: 6000 });
    });

    window.addEventListener("online", () => {
      showToast("Соединение восстановлено.");
    });
  }

  function init() {
    loadSettings();
    loadHistory();
    bindEvents();
    calculate();
    registerServiceWorker();
  }

  init();

  window.__SUMMA_APP__ = Object.freeze({
    version: APP_VERSION,
    parseAmount: Core.parseAmount,
    formatAmount: Core.formatAmount,
    wordsFull: Core.wordsFull,
    integerToWords: Core.integerToWords,
    splitMoney: Core.splitMoney,
    calculateValues: Core.calculateValues,
    makeFullLine: Core.makeFullLine,
    makeAboveLine: Core.makeAboveLine
  });
})();

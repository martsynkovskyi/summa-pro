(() => {
  "use strict";

  const APP_VERSION = "2.3";
  const STORAGE_KEY = "summaPropisyuSettingsV2";
  const HISTORY_KEY = "summaPropisyuHistoryV1";
  const MAX_HISTORY = 10;
  const MAX_AMOUNT = 999_999_999_999.99;
  const SAVE_DELAY = 280;
  const HISTORY_DELAY = 1400;

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

  const historySection = document.getElementById("historySection");
  const historyList = document.getElementById("historyList");
  const historyEmpty = document.getElementById("historyEmpty");
  const historyCount = document.getElementById("historyCount");
  const clearHistoryButton = document.getElementById("clearHistoryBtn");

  const saveIndicator = document.getElementById("saveIndicator");
  const saveStatusText = document.getElementById("saveStatusText");

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

  const onesMale = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const onesFemale = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  let saveTimer = 0;
  let historyTimer = 0;
  let toastTimer = 0;
  let copiedTimer = 0;
  let undoSnapshot = null;
  let undoHistory = null;
  let hasUserInput = false;
  let history = [];

  const current = {
    valid: true,
    input: 0,
    rate: 22,
    mode: "above",
    format: "f1",
    vatReason: "usn",
    base: 0,
    vat: 0,
    total: 0,
    texts: { base: "", vat: "", total: "", full: "", above: "" }
  };

  function getCheckedValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || defaults[name];
  }

  function setCheckedValue(name, value) {
    const safeValue = allowedSettings[name]?.includes(String(value)) ? String(value) : defaults[name];
    const input = document.querySelector(`input[name="${name}"][value="${safeValue}"]`);
    if (input) input.checked = true;
  }

  function setSaveState(state, text) {
    saveIndicator.dataset.state = state;
    saveStatusText.textContent = text;
  }

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function formatHistoryTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return new Intl.DateTimeFormat("ru-RU", sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    ).format(date);
  }

  function sanitizeSavedAmount(value) {
    return String(value ?? "")
      .slice(0, 32)
      .replace(/[^0-9.,\s\u00a0\u202f']/g, "");
  }

  function isAllowed(key, value) {
    return allowedSettings[key]?.includes(String(value)) || false;
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

  function restoreSnapshot(data, { save = true } = {}) {
    if (!data) return;
    amountInput.value = sanitizeSavedAmount(data.amount);
    setCheckedValue("rate", data.rate);
    setCheckedValue("mode", data.mode);
    formatSelect.value = isAllowed("format", data.format) ? data.format : defaults.format;
    vatReasonSelect.value = isAllowed("vatReason", data.vatReason) ? data.vatReason : defaults.vatReason;
    hasUserInput = true;
    calculate();
    if (save) scheduleSave();
  }

  function loadSettings() {
    let restored = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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

  function plural(number, forms) {
    const absolute = Math.abs(number) % 100;
    const last = absolute % 10;
    if (absolute > 10 && absolute < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function triadToWords(number, gender) {
    const words = [];
    const h = Math.floor(number / 100);
    const t = Math.floor((number % 100) / 10);
    const o = number % 10;
    if (hundreds[h]) words.push(hundreds[h]);
    if (t === 1) words.push(teens[o]);
    else {
      if (tens[t]) words.push(tens[t]);
      const ones = gender === "female" ? onesFemale : onesMale;
      if (ones[o]) words.push(ones[o]);
    }
    return words.join(" ");
  }

  function integerToWords(number) {
    if (number === 0) return "ноль";
    const units = [
      { forms: ["", "", ""], gender: "male" },
      { forms: ["тысяча", "тысячи", "тысяч"], gender: "female" },
      { forms: ["миллион", "миллиона", "миллионов"], gender: "male" },
      { forms: ["миллиард", "миллиарда", "миллиардов"], gender: "male" },
      { forms: ["триллион", "триллиона", "триллионов"], gender: "male" }
    ];
    const parts = [];
    let value = Math.floor(number);
    let index = 0;
    while (value > 0 && index < units.length) {
      const triad = value % 1000;
      if (triad) {
        const words = triadToWords(triad, units[index].gender);
        const unit = units[index].forms[0] ? plural(triad, units[index].forms) : "";
        parts.unshift([words, unit].filter(Boolean).join(" "));
      }
      value = Math.floor(value / 1000);
      index += 1;
    }
    return parts.join(" ");
  }

  function cap(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function round2(number) {
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }

  function splitMoney(amount) {
    const safeAmount = round2(Math.max(0, amount));
    const rubles = Math.floor(safeAmount);
    let kopecks = Math.round((safeAmount - rubles) * 100);
    if (kopecks === 100) return { rubles: rubles + 1, kopecks: 0 };
    return { rubles, kopecks };
  }

  function parseAmount(value) {
    const source = String(value ?? "")
      .trim()
      .replace(/[\s\u00a0\u202f']/g, "")
      .replace(/₽|руб\.?/gi, "")
      .replace(/[^0-9.,]/g, "");

    if (!source) return { value: 0, valid: true, empty: true };

    const lastComma = source.lastIndexOf(",");
    const lastDot = source.lastIndexOf(".");
    let decimalIndex = -1;

    if (lastComma >= 0 && lastDot >= 0) decimalIndex = Math.max(lastComma, lastDot);
    else {
      const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
      if (separator) {
        const indexes = [];
        for (let i = 0; i < source.length; i += 1) if (source[i] === separator) indexes.push(i);
        const lastIndex = indexes[indexes.length - 1];
        const fractionLength = source.length - lastIndex - 1;
        if (fractionLength > 0 && fractionLength <= 2) decimalIndex = lastIndex;
      }
    }

    let normalized = "";
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (/\d/.test(char)) normalized += char;
      else if (i === decimalIndex) normalized += ".";
    }

    if (!normalized || normalized === ".") return { value: 0, valid: false, empty: false };
    const number = Number(normalized);
    const valid = Number.isFinite(number) && number >= 0 && number <= MAX_AMOUNT;
    return { value: valid ? round2(number) : 0, valid, empty: false };
  }

  function numRub(amount) {
    const { rubles } = splitMoney(amount);
    return new Intl.NumberFormat("ru-RU").format(rubles).replace(/\u00a0/g, " ");
  }

  function numFull(amount) {
    return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(round2(amount)).replace(/\u00a0/g, " ");
  }

  function inputMoney(amount) {
    return numFull(amount);
  }

  function wordsFull(amount, capitalize = true) {
    const { rubles, kopecks } = splitMoney(amount);
    const words = integerToWords(rubles);
    const rubleWord = plural(rubles, ["рубль", "рубля", "рублей"]);
    const kopeckWord = plural(kopecks, ["копейка", "копейки", "копеек"]);
    const result = `${words} ${rubleWord} ${String(kopecks).padStart(2, "0")} ${kopeckWord}`;
    return capitalize ? cap(result) : result;
  }

  function wordsShort(amount, capitalize = true) {
    const { rubles } = splitMoney(amount);
    const result = integerToWords(rubles);
    return capitalize ? cap(result) : result;
  }

  function formatAmount(amount, format = formatSelect?.value || defaults.format) {
    const { rubles, kopecks } = splitMoney(amount);
    const rubleWord = plural(rubles, ["рубль", "рубля", "рублей"]);
    const kopeckWord = plural(kopecks, ["копейка", "копейки", "копеек"]);
    const kop = String(kopecks).padStart(2, "0");
    if (format === "f1") return `${numRub(amount)} (${wordsShort(amount)}) ${rubleWord} ${kop} ${kopeckWord}`;
    if (format === "f2") return `${numFull(amount)} (${wordsFull(amount)})`;
    if (format === "f3") return `${numFull(amount)} руб. (${wordsFull(amount)})`;
    if (format === "f4") return `${numRub(amount)} ${rubleWord} ${kop} ${kopeckWord} (${wordsFull(amount)})`;
    return wordsFull(amount);
  }

  function getVatReason(value = vatReasonSelect.value) {
    if (value === "usn") return "НДС не облагается на основании п. 1 ст. 145 НК РФ";
    if (value === "npd") return "НДФЛ не удерживается в связи с уплатой Исполнителем налога на профессиональный доход (далее – НПД)";
    if (value === "person") return "облагаемых налогами в установленном законодательством порядке";
    return "НДС не облагается";
  }

  function makeFullLine(total, vat, rate, mode, format = formatSelect.value, reason = vatReasonSelect.value) {
    if (mode === "none") return `${formatAmount(total, format)}, ${getVatReason(reason)}`;
    return `${formatAmount(total, format)}, в том числе НДС ${rate}% – ${formatAmount(vat, format)}`;
  }

  function makeAboveLine(base, vat, total, rate, mode, format = formatSelect.value, reason = vatReasonSelect.value) {
    if (mode === "none") return `${formatAmount(total, format)}, ${getVatReason(reason)}`;
    return `${formatAmount(base, format)}, кроме того НДС ${rate}% – ${formatAmount(vat, format)}, всего ${formatAmount(total, format)}`;
  }

  function calculateValues(amount, rate, mode) {
    const value = round2(Math.max(0, Number(amount) || 0));
    const vatRate = Number(rate) || 0;
    let base = 0;
    let vat = 0;
    let total = 0;
    if (mode === "included") {
      total = value;
      vat = value * vatRate / (100 + vatRate);
      base = total - vat;
    } else if (mode === "above") {
      base = value;
      vat = value * vatRate / 100;
      total = base + vat;
    } else {
      base = value;
      total = value;
    }
    return { base: round2(base), vat: round2(vat), total: round2(total) };
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
  }

  function clearInvalidState() {
    amountInput.removeAttribute("aria-invalid");
    amountError.textContent = "";
    current.valid = true;
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
    const parsed = parseAmount(amountInput.value);
    const rate = Number(getCheckedValue("rate"));
    const mode = getCheckedValue("mode");
    const format = formatSelect.value;
    const vatReason = vatReasonSelect.value;

    updateModeUi(mode, rate);
    formatExample.textContent = formatAmount(1234.56, format);

    if (!parsed.valid) {
      const limit = new Intl.NumberFormat("ru-RU").format(Math.floor(MAX_AMOUNT)).replace(/\u00a0/g, " ");
      setInvalidState(`Допустима сумма до ${limit} руб.`);
      return;
    }

    clearInvalidState();
    const values = calculateValues(parsed.value, rate, mode);

    Object.assign(current, {
      input: parsed.value,
      rate,
      mode,
      format,
      vatReason,
      base: values.base,
      vat: values.vat,
      total: values.total
    });

    current.texts.base = formatAmount(values.base, format);
    current.texts.vat = formatAmount(values.vat, format);
    current.texts.total = formatAmount(values.total, format);
    current.texts.full = makeFullLine(values.total, values.vat, rate, mode, format, vatReason);
    current.texts.above = makeAboveLine(values.base, values.vat, values.total, rate, mode, format, vatReason);

    setOutputText(baseLine, current.texts.base);
    setOutputText(vatLine, current.texts.vat);
    setOutputText(totalLine, current.texts.total);
    setOutputText(fullLineText, current.texts.full);
    setOutputText(aboveLineText, current.texts.above);

  }

  function modeLabel(mode, rate) {
    if (mode === "included") return `НДС включён · ${rate}%`;
    if (mode === "above") return `НДС сверху · ${rate}%`;
    return "Без НДС";
  }

  function recommendedText(entry = current) {
    if (entry.mode === "above") return entry.texts.above;
    return entry.texts.full;
  }

  function buildAllText(entry = current) {
    if (entry.mode === "none") {
      return [
        `Сумма: ${entry.texts.total}`,
        "НДС: не начисляется",
        `Формулировка: ${entry.texts.full}`
      ].join("\n");
    }

    return [
      `Сумма без НДС: ${entry.texts.base}`,
      `НДС ${entry.rate}%: ${entry.texts.vat}`,
      `Сумма с НДС: ${entry.texts.total}`,
      `Рекомендуемая формулировка: ${recommendedText(entry)}`
    ].join("\n");
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
      saveCurrentToHistory();
      showToast("Текст скопирован в буфер обмена.");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать текст. Выделите его вручную.", { tone: "error", duration: 6500 });
    }
  }

  async function copyAll(entry = current) {
    if (!entry.valid && entry === current) {
      showToast("Сначала исправьте введённую сумму.", { tone: "error" });
      amountInput.focus();
      return;
    }
    try {
      await writeClipboard(buildAllText(entry));
      if (entry === current) saveCurrentToHistory();
      showToast("Весь расчёт скопирован.");
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
    const { tone = "success", duration = 3600, actionLabel = "", onAction = null } = options;
    clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    if (actionLabel && typeof onAction === "function") {
      toastAction.hidden = false;
      toastAction.textContent = actionLabel;
      toastAction.onclick = () => { hideToast(); onAction(); };
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
      state.rate !== defaults.rate || state.mode !== defaults.mode ||
      state.format !== defaults.format || state.vatReason !== defaults.vatReason;
  }

  function clearForm() {
    undoSnapshot = snapshot();
    clearTimeout(saveTimer);
    clearTimeout(historyTimer);
    amountInput.value = "";
    setCheckedValue("rate", defaults.rate);
    setCheckedValue("mode", defaults.mode);
    formatSelect.value = defaults.format;
    vatReasonSelect.value = defaults.vatReason;
    hasUserInput = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
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
      onAction: () => { restoreSnapshot(undoSnapshot); showToast("Данные восстановлены."); },
      duration: 8000
    });
  }

  function historySignature(entry) {
    return [entry.input, entry.rate, entry.mode, entry.format, entry.vatReason].join("|");
  }

  function currentHistoryEntry() {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      amount: inputMoney(current.input),
      input: current.input,
      rate: current.rate,
      mode: current.mode,
      format: current.format,
      vatReason: current.vatReason,
      base: current.base,
      vat: current.vat,
      total: current.total,
      texts: { ...current.texts }
    };
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      history = Array.isArray(parsed) ? parsed.filter(item => item && Number.isFinite(Number(item.input))).slice(0, MAX_HISTORY) : [];
    } catch (error) {
      console.warn("Не удалось восстановить историю:", error);
      history = [];
    }
    renderHistory();
  }

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn("Не удалось сохранить историю:", error);
    }
  }

  function scheduleHistorySave() {
    clearTimeout(historyTimer);
    historyTimer = window.setTimeout(saveCurrentToHistory, HISTORY_DELAY);
  }

  function saveCurrentToHistory() {
    if (!current.valid || current.input <= 0) return;
    const entry = currentHistoryEntry();
    const signature = historySignature(entry);
    history = history.filter(item => historySignature(item) !== signature);
    history.unshift(entry);
    history = history.slice(0, MAX_HISTORY);
    persistHistory();
    renderHistory();
  }

  function makeHistoryEntryObject(item) {
    return {
      valid: true,
      rate: Number(item.rate),
      mode: item.mode,
      texts: item.texts
    };
  }

  function restoreHistoryItem(item) {
    restoreSnapshot({
      amount: item.amount,
      rate: String(item.rate),
      mode: item.mode,
      format: item.format,
      vatReason: item.vatReason
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Расчёт восстановлен из истории.");
  }

  async function copyHistoryItem(item) {
    await copyAll(makeHistoryEntryObject(item));
  }

  function deleteHistoryItem(id) {
    const index = history.findIndex(item => item.id === id);
    if (index < 0) return;
    const removed = history[index];
    history.splice(index, 1);
    persistHistory();
    renderHistory();
    showToast("Запись удалена из истории.", {
      tone: "warn",
      actionLabel: "Отменить",
      onAction: () => {
        history.splice(Math.min(index, history.length), 0, removed);
        history = history.slice(0, MAX_HISTORY);
        persistHistory();
        renderHistory();
        showToast("Запись восстановлена.");
      },
      duration: 7000
    });
  }

  function createHistoryAction(label, action, item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-action";
    button.dataset.action = action;
    button.setAttribute("aria-label", label);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    const paths = action === "copy"
      ? ["M8 8h11v11H8z", "M5 5h11v11H5z"]
      : ["M5 7h14", "M9 7V4h6v3", "M8 10v9h8v-9", "M10.5 12.5v4", "M13.5 12.5v4"];
    paths.forEach(d => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    button.appendChild(svg);
    button.addEventListener("click", event => {
      event.stopPropagation();
      if (action === "copy") copyHistoryItem(item);
      else deleteHistoryItem(item.id);
    });
    return button;
  }

  function renderHistory() {
    historyList.replaceChildren();
    historyCount.textContent = String(history.length);
    historyEmpty.hidden = history.length > 0;
    clearHistoryButton.hidden = history.length === 0;

    history.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";

      const main = document.createElement("button");
      main.type = "button";
      main.className = "history-main";
      main.setAttribute("aria-label", `Восстановить расчёт ${item.amount} рублей`);

      const amount = document.createElement("span");
      amount.className = "history-amount";
      amount.textContent = `${item.amount} ₽`;

      const meta = document.createElement("span");
      meta.className = "history-meta";
      const mode = document.createElement("strong");
      mode.textContent = modeLabel(item.mode, item.rate);
      const time = document.createElement("span");
      time.textContent = formatHistoryTime(item.timestamp);
      meta.append(mode, time);
      main.append(amount, meta);
      main.addEventListener("click", () => restoreHistoryItem(item));

      const actions = document.createElement("div");
      actions.className = "history-item-actions";
      actions.append(
        createHistoryAction("Скопировать весь расчёт", "copy", item),
        createHistoryAction("Удалить расчёт", "delete", item)
      );

      row.append(main, actions);
      historyList.appendChild(row);
    });
  }

  function clearHistory() {
    if (!history.length) return;
    undoHistory = [...history];
    history = [];
    persistHistory();
    renderHistory();
    showToast("История очищена.", {
      tone: "warn",
      actionLabel: "Отменить",
      onAction: () => {
        history = undoHistory.slice(0, MAX_HISTORY);
        persistHistory();
        renderHistory();
        showToast("История восстановлена.");
      },
      duration: 8000
    });
  }

  function onAmountBlur() {
    const parsed = parseAmount(amountInput.value);
    if (!parsed.valid || parsed.empty) return;
    amountInput.value = inputMoney(parsed.value);
    hasUserInput = true;
    scheduleSave();
    calculate();
    if (parsed.value > 0) scheduleHistorySave();
  }

  function onAmountInput() {
    hasUserInput = true;
    scheduleSave();
    calculate();
  }

  function onUserChange() {
    hasUserInput = true;
    scheduleSave();
    calculate();
    if (current.valid && current.input > 0) scheduleHistorySave();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(error => {
        console.warn("Не удалось включить офлайн-режим:", error);
      });
    });
  }

  function bindEvents() {
    form.addEventListener("submit", event => event.preventDefault());
    amountInput.addEventListener("input", onAmountInput);
    amountInput.addEventListener("blur", onAmountBlur);
    amountInput.addEventListener("focus", () => window.setTimeout(() => amountInput.select(), 0));

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

    copyAllButton.addEventListener("click", () => copyAll());
    resetButton.addEventListener("click", () => {
      if (hasMeaningfulContent()) clearForm();
      else showToast("Форма уже пустая.", { tone: "warn" });
    });
    clearHistoryButton.addEventListener("click", clearHistory);
    toastClose.addEventListener("click", hideToast);

    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        copyAll();
      }
    });

    historySection.addEventListener("toggle", () => {
      if (historySection.open && history.length === 0) historyEmpty.hidden = false;
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
    parseAmount,
    formatAmount,
    wordsFull,
    integerToWords,
    calculateValues,
    buildAllText
  });
})();

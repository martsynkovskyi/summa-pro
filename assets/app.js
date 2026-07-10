(() => {
  "use strict";

  const APP_VERSION = "2.2";
  const STORAGE_KEY = "summaPropisyuSettingsV2";
  const MAX_AMOUNT = 999_999_999_999.99;
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
  let toastTimer = 0;
  let copiedTimer = 0;
  let undoSnapshot = null;
  let hasUserInput = false;

  const current = {
    valid: true,
    base: 0,
    vat: 0,
    total: 0,
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

    if (t === 1) {
      words.push(teens[o]);
    } else {
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

    if (kopecks === 100) {
      return { rubles: rubles + 1, kopecks: 0 };
    }

    return { rubles, kopecks };
  }

  function parseAmount(value) {
    const source = String(value ?? "")
      .trim()
      .replace(/[\s\u00a0\u202f']/g, "")
      .replace(/₽|руб\.?/gi, "")
      .replace(/[^0-9.,]/g, "");

    if (!source) {
      return { value: 0, valid: true, empty: true };
    }

    const lastComma = source.lastIndexOf(",");
    const lastDot = source.lastIndexOf(".");
    let decimalIndex = -1;

    if (lastComma >= 0 && lastDot >= 0) {
      decimalIndex = Math.max(lastComma, lastDot);
    } else {
      const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
      if (separator) {
        const indexes = [];
        for (let i = 0; i < source.length; i += 1) {
          if (source[i] === separator) indexes.push(i);
        }
        const lastIndex = indexes[indexes.length - 1];
        const fractionLength = source.length - lastIndex - 1;

        if (fractionLength > 0 && fractionLength <= 2) {
          decimalIndex = lastIndex;
        } else if (indexes.length > 1 && fractionLength <= 2) {
          decimalIndex = lastIndex;
        }
      }
    }

    let normalized = "";
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (/\d/.test(char)) normalized += char;
      else if (i === decimalIndex) normalized += ".";
    }

    if (!normalized || normalized === ".") {
      return { value: 0, valid: false, empty: false };
    }

    const number = Number(normalized);
    const valid = Number.isFinite(number) && number >= 0 && number <= MAX_AMOUNT;
    return { value: valid ? number : 0, valid, empty: false };
  }

  function numRub(amount) {
    const { rubles } = splitMoney(amount);
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 0
    }).format(rubles).replace(/\u00a0/g, " ");
  }

  function numFull(amount) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(round2(amount)).replace(/\u00a0/g, " ");
  }

  function inputMoney(amount) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(round2(amount)).replace(/\u00a0/g, " ");
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

  function formatAmount(amount, format = formatSelect.value) {
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

  function getVatReason() {
    if (vatReasonSelect.value === "usn") return "НДС не облагается на основании п. 1 ст. 145 НК РФ";
    if (vatReasonSelect.value === "npd") return "НДФЛ не удерживается в связи с уплатой Исполнителем налога на профессиональный доход (далее – НПД)";
    if (vatReasonSelect.value === "person") return "облагаемых налогами в установленном законодательством порядке";
    return "НДС не облагается";
  }

  function makeFullLine(total, vat, rate, mode) {
    if (mode === "none") {
      return `${formatAmount(total)}, ${getVatReason()}`;
    }

    return `${formatAmount(total)}, в том числе НДС ${rate}% – ${formatAmount(vat)}`;
  }

  function makeAboveLine(base, vat, total, rate, mode) {
    if (mode === "none") {
      return `${formatAmount(total)}, ${getVatReason()}`;
    }

    return `${formatAmount(base)}, кроме того НДС ${rate}% – ${formatAmount(vat)}, всего ${formatAmount(total)}`;
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

    updateModeUi(mode, rate);
    formatExample.textContent = formatAmount(1234.56);

    if (!parsed.valid) {
      const message = parsed.empty
        ? ""
        : `Допустима сумма до ${new Intl.NumberFormat("ru-RU").format(Math.floor(MAX_AMOUNT)).replace(/\u00a0/g, " ")} руб.`;
      setInvalidState(message || "Введите корректную сумму");
      return;
    }

    clearInvalidState();

    const amount = parsed.value;
    let base = 0;
    let vat = 0;
    let total = 0;

    if (mode === "included") {
      total = amount;
      vat = amount * rate / (100 + rate);
      base = total - vat;
    } else if (mode === "above") {
      base = amount;
      vat = amount * rate / 100;
      total = base + vat;
    } else {
      base = amount;
      vat = 0;
      total = amount;
    }

    base = round2(base);
    vat = round2(vat);
    total = round2(total);

    current.base = base;
    current.vat = vat;
    current.total = total;
    current.texts.base = formatAmount(base);
    current.texts.vat = formatAmount(vat);
    current.texts.total = formatAmount(total);
    current.texts.full = makeFullLine(total, vat, rate, mode);
    current.texts.above = makeAboveLine(base, vat, total, rate, mode);

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
      showToast("Текст скопирован в буфер обмена.");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать текст. Выделите его вручную.", { tone: "error", duration: 6500 });
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
    const parsedAmount = parseAmount(state.amount);
    const amountChanged = parsedAmount.valid
      ? parsedAmount.value !== 0
      : state.amount.trim() !== "";

    return amountChanged ||
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
      setSaveState("idle", "Черновик очищен");
    } catch (error) {
      console.warn(error);
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

  function onAmountBlur() {
    const parsed = parseAmount(amountInput.value);
    if (!parsed.valid || parsed.empty) return;
    amountInput.value = inputMoney(parsed.value);
    hasUserInput = true;
    scheduleSave();
    calculate();
  }

  function onUserChange() {
    hasUserInput = true;
    scheduleSave();
    calculate();
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

    resetButton.addEventListener("click", () => {
      if (hasMeaningfulContent()) clearForm();
      else showToast("Форма уже пустая.", { tone: "warn" });
    });

    toastClose.addEventListener("click", hideToast);
  }

  function init() {
    loadSettings();
    bindEvents();
    calculate();
  }

  init();

  window.__SUMMA_APP__ = Object.freeze({
    version: APP_VERSION,
    parseAmount,
    formatAmount,
    calculateValues(amount, rate, mode) {
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

      return {
        base: round2(base),
        vat: round2(vat),
        total: round2(total)
      };
    }
  });
})();

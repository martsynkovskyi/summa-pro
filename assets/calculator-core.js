(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.SummaCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_AMOUNT = 999_999_999_999.99;

  const onesMale = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const onesFemale = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

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
    const integer = Math.floor(Math.max(0, Number(number) || 0));
    if (integer === 0) return "ноль";

    const units = [
      { forms: ["", "", ""], gender: "male" },
      { forms: ["тысяча", "тысячи", "тысяч"], gender: "female" },
      { forms: ["миллион", "миллиона", "миллионов"], gender: "male" },
      { forms: ["миллиард", "миллиарда", "миллиардов"], gender: "male" },
      { forms: ["триллион", "триллиона", "триллионов"], gender: "male" }
    ];

    const parts = [];
    let value = integer;
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
    const value = String(text || "");
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function round2(number) {
    return Math.round((Number(number) + Number.EPSILON) * 100) / 100;
  }

  function splitMoney(amount) {
    const safeAmount = round2(Math.max(0, Number(amount) || 0));
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

    return {
      value: valid ? round2(number) : 0,
      valid,
      empty: false
    };
  }

  function numRub(amount) {
    const { rubles } = splitMoney(amount);
    return new Intl.NumberFormat("ru-RU").format(rubles).replace(/\u00a0/g, " ");
  }

  function numFull(amount) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(round2(amount)).replace(/\u00a0/g, " ");
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

  function formatAmount(amount, format = "f1") {
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

  function getVatReason(reason) {
    if (reason === "usn") return "НДС не облагается на основании п. 1 ст. 145 НК РФ";
    if (reason === "npd") return "НДФЛ не удерживается в связи с уплатой Исполнителем налога на профессиональный доход (далее – НПД)";
    if (reason === "person") return "облагаемых налогами в установленном законодательством порядке";
    return "НДС не облагается";
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

    return {
      base: round2(base),
      vat: round2(vat),
      total: round2(total)
    };
  }

  function makeFullLine(total, vat, rate, mode, format = "f1", vatReason = "usn") {
    if (mode === "none") {
      return `${formatAmount(total, format)}, ${getVatReason(vatReason)}`;
    }

    return `${formatAmount(total, format)}, в том числе НДС ${rate}% – ${formatAmount(vat, format)}`;
  }

  function makeAboveLine(base, vat, total, rate, mode, format = "f1", vatReason = "usn") {
    if (mode === "none") {
      return `${formatAmount(total, format)}, ${getVatReason(vatReason)}`;
    }

    return `${formatAmount(base, format)}, кроме того НДС ${rate}% – ${formatAmount(vat, format)}, всего ${formatAmount(total, format)}`;
  }

  return Object.freeze({
    MAX_AMOUNT,
    plural,
    integerToWords,
    round2,
    splitMoney,
    parseAmount,
    numRub,
    numFull,
    inputMoney,
    wordsFull,
    wordsShort,
    formatAmount,
    getVatReason,
    calculateValues,
    makeFullLine,
    makeAboveLine
  });
});

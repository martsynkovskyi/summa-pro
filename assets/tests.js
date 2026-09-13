(() => {
  "use strict";
  const frame = document.getElementById("appFrame");
  const results = document.getElementById("results");
  const summary = document.getElementById("summary");
  let started = false;

  function add(name, passed, detail = "") {
    const li = document.createElement("li");
    li.className = passed ? "ok" : "fail";
    li.textContent = `${passed ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`;
    results.appendChild(li);
    return passed;
  }

  function runTests() {
    if (started) return;
    const app = frame.contentWindow.__SUMMA_APP__;
    if (!app) {
      summary.textContent = "Приложение не загрузилось";
      summary.className = "summary fail";
      return;
    }
    started = true;

    let passed = 0;
    let total = 0;
    const test = (name, condition, detail = "") => { total += 1; if (add(name, condition, detail)) passed += 1; };
    const close = (a, b) => Math.abs(a - b) < 0.01;

    test("Разбор 45 000,50", app.parseAmount("45 000,50").value === 45000.5);
    test("Разбор 1.234,56", app.parseAmount("1.234,56").value === 1234.56);
    test("Разбор 45 000.50", app.parseAmount("45 000.50").value === 45000.5);
    test("Разбор 1 234 567,89", app.parseAmount("1 234 567,89").value === 1234567.89);
    test("Разбор 1,234.56", app.parseAmount("1,234.56").value === 1234.56);
    test("Отклонение отрицательной суммы", app.parseAmount("-100").valid === false);
    test("Отклонение букв в сумме", app.parseAmount("abc100").valid === false);
    test("Отклонение неверных разделителей", app.parseAmount("1.234.56").valid === false);
    test("Отклонение длинной дробной части", app.parseAmount("12,3456").valid === false);
    test("Ограничение максимальной суммы", app.parseAmount("1000000000000").valid === false);

    const above22 = app.calculateValues(100, 22, "above");
    test("НДС 22% сверху", close(above22.base, 100) && close(above22.vat, 22) && close(above22.total, 122));

    const included22 = app.calculateValues(122, 22, "included");
    test("НДС 22% включен", close(included22.base, 100) && close(included22.vat, 22) && close(included22.total, 122));

    const above5 = app.calculateValues(100, 5, "above");
    test("НДС 5% сверху", close(above5.vat, 5) && close(above5.total, 105));

    const none = app.calculateValues(100, 22, "none");
    test("Без НДС", close(none.base, 100) && close(none.vat, 0) && close(none.total, 100));

    const copiedAbove = app.buildAllText({
      valid: true,
      rate: 22,
      mode: "above",
      texts: { base: "БАЗА", vat: "НДС", total: "ИТОГ", full: "ФРАЗА 1", above: "ФРАЗА 2" }
    });
    test("Общий расчет без формулировок", copiedAbove.includes("БАЗА") && copiedAbove.includes("НДС") && copiedAbove.includes("ИТОГ") && !copiedAbove.includes("ФРАЗА"));

    const copiedNone = app.buildAllText({
      valid: true,
      rate: 22,
      mode: "none",
      texts: { base: "БАЗА", vat: "НДС", total: "ИТОГ", full: "ФРАЗА 1", above: "ФРАЗА 2" }
    });
    test("Общий расчет без НДС и без формулировки", copiedNone.includes("ИТОГ") && copiedNone.includes("не начисляется") && !copiedNone.includes("ФРАЗА"));

    const wordCases = [
      [0, "Ноль"], [1, "Один"], [2, "Два"], [5, "Пять"], [11, "Одиннадцать"],
      [21, "Двадцать один"], [101, "Сто один"], [1000, "Одна тысяча"], [2000, "Две тысячи"]
    ];
    wordCases.forEach(([value, prefix]) => {
      test(`Склонение и запись ${value}`, app.wordsFull(value).startsWith(prefix), app.wordsFull(value));
    });

    test("Копейки 01", app.wordsFull(1.01).endsWith("01 копейка"), app.wordsFull(1.01));
    test("Копейки 02", app.wordsFull(1.02).endsWith("02 копейки"), app.wordsFull(1.02));
    test("Копейки 05", app.wordsFull(1.05).endsWith("05 копеек"), app.wordsFull(1.05));
    test("Округление до копейки", app.wordsFull(1.005).endsWith("01 копейка"), app.wordsFull(1.005));
    test("Формат f1", app.formatAmount(1234.56, "f1") === "1 234 (Одна тысяча двести тридцать четыре) рубля 56 копеек", app.formatAmount(1234.56, "f1"));
    test("Формат f2", app.formatAmount(1234.56, "f2") === "1 234,56 (Одна тысяча двести тридцать четыре рубля 56 копеек)", app.formatAmount(1234.56, "f2"));
    test("Формат f3", app.formatAmount(1234.56, "f3") === "1 234,56 руб. (Одна тысяча двести тридцать четыре рубля 56 копеек)", app.formatAmount(1234.56, "f3"));
    test("Формат f4", app.formatAmount(1234.56, "f4") === "Одна тысяча двести тридцать четыре рубля 56 копеек", app.formatAmount(1234.56, "f4"));
    test("Формат f5", app.formatAmount(1234.56, "f5") === "Одна тысяча двести тридцать четыре рубля пятьдесят шесть копеек", app.formatAmount(1234.56, "f5"));
    test("Копейки прописью 01", app.wordsWithKopecks(1.01) === "Один рубль одна копейка", app.wordsWithKopecks(1.01));
    test("Копейки прописью 00", app.wordsWithKopecks(100) === "Сто рублей ноль копеек", app.wordsWithKopecks(100));

    summary.textContent = `Пройдено ${passed} из ${total} тестов`;
    summary.className = `summary ${passed === total ? "ok" : "fail"}`;
  }

  frame.addEventListener("load", runTests);
  if (frame.contentDocument?.readyState === "complete") queueMicrotask(runTests);
})();

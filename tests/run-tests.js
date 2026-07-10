"use strict";

const assert = require("node:assert/strict");
const Core = require("../assets/calculator-core.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function closeTo(actual, expected, epsilon = 0.001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected}`);
}

test("парсит сумму с пробелами и запятой", () => {
  assert.deepEqual(Core.parseAmount("45 000,50"), { value: 45000.5, valid: true, empty: false });
});

test("парсит европейскую запись 1.234,56", () => {
  assert.equal(Core.parseAmount("1.234,56").value, 1234.56);
});

test("парсит запись 1,234.56", () => {
  assert.equal(Core.parseAmount("1,234.56").value, 1234.56);
});

test("удаляет обозначение рубля", () => {
  assert.equal(Core.parseAmount("12 345,67 руб.").value, 12345.67);
});

test("пустая строка считается нулём", () => {
  assert.deepEqual(Core.parseAmount(""), { value: 0, valid: true, empty: true });
});

test("отклоняет сумму выше лимита", () => {
  assert.equal(Core.parseAmount("1000000000000").valid, false);
});

test("НДС 22% сверху", () => {
  assert.deepEqual(Core.calculateValues(45000, 22, "above"), { base: 45000, vat: 9900, total: 54900 });
});

test("НДС 22% включён", () => {
  const result = Core.calculateValues(45000, 22, "included");
  closeTo(result.base, 36885.25);
  closeTo(result.vat, 8114.75);
  assert.equal(result.total, 45000);
});

test("НДС 5% сверху", () => {
  assert.deepEqual(Core.calculateValues(100000, 5, "above"), { base: 100000, vat: 5000, total: 105000 });
});

test("НДС 5% включён", () => {
  assert.deepEqual(Core.calculateValues(105000, 5, "included"), { base: 100000, vat: 5000, total: 105000 });
});

test("режим без НДС", () => {
  assert.deepEqual(Core.calculateValues(1234.56, 22, "none"), { base: 1234.56, vat: 0, total: 1234.56 });
});

test("склонение рублей", () => {
  assert.equal(Core.plural(1, ["рубль", "рубля", "рублей"]), "рубль");
  assert.equal(Core.plural(2, ["рубль", "рубля", "рублей"]), "рубля");
  assert.equal(Core.plural(5, ["рубль", "рубля", "рублей"]), "рублей");
  assert.equal(Core.plural(11, ["рубль", "рубля", "рублей"]), "рублей");
  assert.equal(Core.plural(21, ["рубль", "рубля", "рублей"]), "рубль");
});

test("склонение копеек", () => {
  assert.equal(Core.wordsFull(1.01), "Один рубль 01 копейка");
  assert.equal(Core.wordsFull(2.02), "Два рубля 02 копейки");
  assert.equal(Core.wordsFull(5.05), "Пять рублей 05 копеек");
  assert.equal(Core.wordsFull(11.11), "Одиннадцать рублей 11 копеек");
  assert.equal(Core.wordsFull(21.21), "Двадцать один рубль 21 копейка");
});

test("тысячи используют женский род", () => {
  assert.equal(Core.integerToWords(21000), "двадцать одна тысяча");
  assert.equal(Core.integerToWords(22000), "двадцать две тысячи");
});

test("миллионы и миллиарды", () => {
  assert.equal(Core.integerToWords(4000001), "четыре миллиона один");
  assert.equal(Core.integerToWords(1000000000), "один миллиард");
});

test("округляет копейки", () => {
  assert.deepEqual(Core.splitMoney(1.999), { rubles: 2, kopecks: 0 });
});

test("формат f1", () => {
  assert.equal(Core.formatAmount(1234.56, "f1"), "1 234 (Одна тысяча двести тридцать четыре) рубля 56 копеек");
});

test("формат f2", () => {
  assert.equal(Core.formatAmount(1234.56, "f2"), "1 234,56 (Одна тысяча двести тридцать четыре рубля 56 копеек)");
});

test("формат f3", () => {
  assert.equal(Core.formatAmount(1234.56, "f3"), "1 234,56 руб. (Одна тысяча двести тридцать четыре рубля 56 копеек)");
});

test("формат f4", () => {
  assert.equal(Core.formatAmount(1234.56, "f4"), "1 234 рубля 56 копеек (Одна тысяча двести тридцать четыре рубля 56 копеек)");
});

test("готовая фраза с НДС включён", () => {
  const values = Core.calculateValues(45000, 22, "included");
  const phrase = Core.makeFullLine(values.total, values.vat, 22, "included", "f1", "usn");
  assert.match(phrase, /в том числе НДС 22%/);
  assert.match(phrase, /8 114/);
});

test("готовая фраза с НДС сверху", () => {
  const values = Core.calculateValues(45000, 22, "above");
  const phrase = Core.makeAboveLine(values.base, values.vat, values.total, 22, "above", "f1", "usn");
  assert.match(phrase, /кроме того НДС 22%/);
  assert.match(phrase, /всего 54 900/);
});

test("готовая фраза без НДС по ст. 145", () => {
  const phrase = Core.makeFullLine(45000, 0, 22, "none", "f1", "usn");
  assert.match(phrase, /п\. 1 ст\. 145 НК РФ/);
});

test("готовая фраза для НПД", () => {
  const phrase = Core.makeFullLine(45000, 0, 22, "none", "f1", "npd");
  assert.match(phrase, /налога на профессиональный доход/);
});

let passed = 0;
for (const item of tests) {
  try {
    item.fn();
    passed += 1;
    console.log(`✓ ${item.name}`);
  } catch (error) {
    console.error(`✗ ${item.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${tests.length} тестов пройдено.`);
if (passed !== tests.length) process.exitCode = 1;

// Run: npx tsx src/lib/order-math.test.ts
import assert from "node:assert/strict";
import { lineTotal, sumLines, serviceCharge, discountAmount, billTotals } from "./order-math";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test("lineTotal multiplies qty × price", () => {
  assert.equal(lineTotal({ quantity: 2, unit_price: 500 }), 1000);
});

test("lineTotal is 0 when voided", () => {
  assert.equal(lineTotal({ quantity: 2, unit_price: 500, is_voided: true }), 0);
});

test("sumLines excludes voided items", () => {
  const lines = [
    { quantity: 1, unit_price: 1450 },
    { quantity: 2, unit_price: 250 },
    { quantity: 1, unit_price: 1050, is_voided: true },
  ];
  assert.equal(sumLines(lines), 1950);
});

test("serviceCharge rounds (3570 @ 5% = 179)", () => {
  assert.equal(serviceCharge(3570, 5), 179);
});

test("discountAmount percent", () => {
  assert.equal(discountAmount(2000, { type: "percent", value: 10 }), 200);
});

test("discountAmount fixed is capped at subtotal", () => {
  assert.equal(discountAmount(500, { type: "fixed", value: 800 }), 500);
});

test("discountAmount none => 0", () => {
  assert.equal(discountAmount(2000, null), 0);
});

test("billTotals matches mockup bill (#SP-1042)", () => {
  // Round 1: 1×1450, 2×250(=500), 1×220 ; Round 2: 1×1050, 1×350  => subtotal 3570
  const lines = [
    { quantity: 1, unit_price: 1450 },
    { quantity: 2, unit_price: 250 },
    { quantity: 1, unit_price: 220 },
    { quantity: 1, unit_price: 1050 },
    { quantity: 1, unit_price: 350 },
  ];
  const t = billTotals(lines, 5);
  assert.equal(t.subtotal, 3570);
  assert.equal(t.service, 179);
  assert.equal(t.discount, 0);
  assert.equal(t.total, 3749);
});

test("billTotals applies discount after service", () => {
  const lines = [{ quantity: 1, unit_price: 1000 }];
  const t = billTotals(lines, 5, { type: "percent", value: 10 });
  assert.equal(t.subtotal, 1000);
  assert.equal(t.service, 50);
  assert.equal(t.discount, 100);
  assert.equal(t.total, 950);
});

test("billTotals incorporates delivery charges", () => {
  const lines = [{ quantity: 1, unit_price: 1000 }];
  const t = billTotals(lines, 0, null, 150);
  assert.equal(t.subtotal, 1000);
  assert.equal(t.service, 0);
  assert.equal(t.delivery, 150);
  assert.equal(t.discount, 0);
  assert.equal(t.total, 1150);
});

console.log(`\n${passed} passing`);

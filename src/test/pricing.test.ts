import { describe, it, expect } from "vitest";
import {
  computePlatformFeeOneDay,
  computePlatformFee,
  computeDeliveryCharge,
  DEFAULT_PLATFORM_FEE_SLABS,
  DEFAULT_DELIVERY_FEE_SLABS,
} from "@/lib/pricing";

describe("computePlatformFeeOneDay", () => {
  const cases: [number, number][] = [
    [100, 50], [499, 50],
    [500, 70], [999, 70],
    [1000, 120], [1999, 120],
    [2000, 170], [2500, 170], [2999, 170],
    [3000, 220], [3500, 220],
    [5000, 320],
  ];
  cases.forEach(([price, expected]) => {
    it(`price ₹${price} → ₹${expected}`, () => {
      expect(computePlatformFeeOneDay(price, DEFAULT_PLATFORM_FEE_SLABS)).toBe(expected);
    });
  });
});

describe("computePlatformFee for multi-day rentals", () => {
  it("650 × 5 days = 350", () => {
    expect(computePlatformFee(650, 1, 5, DEFAULT_PLATFORM_FEE_SLABS)).toBe(350);
  });
  it.each([1, 3, 7, 15, 30])("scales linearly with %i days", (d) => {
    expect(computePlatformFee(1200, 1, d)).toBe(120 * d);
  });
  it("scales with quantity", () => {
    expect(computePlatformFee(600, 3, 2)).toBe(70 * 3 * 2);
  });
  it("never negative", () => {
    expect(computePlatformFee(-100, 1, 1)).toBeGreaterThanOrEqual(0);
  });
});

describe("computeDeliveryCharge", () => {
  it("₹25 minimum for large orders", () => {
    expect(computeDeliveryCharge(5000, DEFAULT_DELIVERY_FEE_SLABS)).toBe(25);
  });
  it("₹50 for small orders", () => {
    expect(computeDeliveryCharge(300, DEFAULT_DELIVERY_FEE_SLABS)).toBe(50);
  });
  it("₹40 middle tier", () => {
    expect(computeDeliveryCharge(800, DEFAULT_DELIVERY_FEE_SLABS)).toBe(40);
  });
});

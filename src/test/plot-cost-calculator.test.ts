import { describe, expect, it } from "vitest";
import {
  calculatePlotCost,
  validateRateConfig,
  DEFAULT_VERIFIED_RATES,
  parseVentureCostConfig,
  serializeVentureAbout,
  getVentureAboutText,
  generateCostBreakdownCsv,
  type CostRateConfig,
} from "@/lib/cost-calculator";

describe("Transparent Plot Cost Calculator", () => {
  const customConfig: CostRateConfig = {
    stamp_duty_percent: 6.0,
    registration_fee_percent: 0.5,
    transfer_duty_tax_percent: 1.5,
    development_charges_per_sqyd: 350,
    maintenance_charges_per_sqyd: 50,
    legal_documentation_fee: 15000,
    corner_plot_premium_percent: 10.0,
    facing_premium_percent: 5.0,
    water_electricity_deposit: 25000,
    clubhouse_amenity_fee: 50000,
    rates_verified: true,
    rates_verified_at: "2026-04-01T00:00:00.000Z",
    rates_verified_by: "Venture Chief Accounts Officer",
  };

  it("calculates base plot price correctly", () => {
    const res = calculatePlotCost({
      sizeSqyd: 200,
      pricePerSqyd: 10000,
      plotNumber: 1,
      config: customConfig,
    });

    expect(res.basePlotPrice).toBe(2000000);
    const baseItem = res.items.find((i) => i.id === "base_plot_price");
    expect(baseItem).toBeDefined();
    expect(baseItem?.amount).toBe(2000000);
    expect(baseItem?.chargeType).toBe("mandatory");
  });

  it("calculates statutory stamp duty, registration fee, and taxes separately", () => {
    const res = calculatePlotCost({
      sizeSqyd: 100,
      pricePerSqyd: 10000,
      plotNumber: 2,
      config: customConfig,
    });
    // Base = 1,000,000
    // Stamp duty = 6% of 1,000,000 = 60,000
    // Registration fee = 0.5% of 1,000,000 = 5,000
    // Transfer duty / tax = 1.5% of 1,000,000 = 15,000

    const stamp = res.items.find((i) => i.id === "stamp_duty");
    const reg = res.items.find((i) => i.id === "registration_fee");
    const transfer = res.items.find((i) => i.id === "transfer_duty_tax");

    expect(stamp?.amount).toBe(60000);
    expect(stamp?.category).toBe("statutory");
    expect(stamp?.chargeType).toBe("estimated");

    expect(reg?.amount).toBe(5000);
    expect(reg?.category).toBe("statutory");
    expect(reg?.chargeType).toBe("estimated");

    expect(transfer?.amount).toBe(15000);
    expect(transfer?.category).toBe("statutory");
    expect(transfer?.chargeType).toBe("estimated");

    expect(res.statutorySubtotal).toBe(80000);
  });

  it("calculates development charges and maintenance fees based on square yards", () => {
    const res = calculatePlotCost({
      sizeSqyd: 200,
      pricePerSqyd: 8000,
      plotNumber: 3,
      config: customConfig,
    });
    // Development charges = 200 * 350 = 70,000
    // Maintenance charges = 200 * 50 = 10,000

    const dev = res.items.find((i) => i.id === "development_charges");
    const maint = res.items.find((i) => i.id === "maintenance_corpus");

    expect(dev?.amount).toBe(70000);
    expect(dev?.chargeType).toBe("mandatory");

    expect(maint?.amount).toBe(10000);
    expect(maint?.chargeType).toBe("mandatory");
  });

  it("clearly distinguishes between mandatory, optional, and estimated charges", () => {
    const res = calculatePlotCost({
      sizeSqyd: 150,
      pricePerSqyd: 9000,
      plotNumber: 4,
      isCornerPlot: true,
      includeCornerPremium: true,
      includeWaterDeposit: true,
      config: customConfig,
    });

    const mandatoryItems = res.items.filter((i) => i.chargeType === "mandatory");
    const optionalItems = res.items.filter((i) => i.chargeType === "optional");
    const estimatedItems = res.items.filter((i) => i.chargeType === "estimated");

    expect(mandatoryItems.length).toBeGreaterThan(0);
    expect(optionalItems.length).toBeGreaterThan(0);
    expect(estimatedItems.length).toBeGreaterThan(0);

    // Development and Maintenance are mandatory
    expect(mandatoryItems.some((i) => i.id === "development_charges")).toBe(true);
    expect(mandatoryItems.some((i) => i.id === "maintenance_corpus")).toBe(true);

    // Corner plot premium and Water deposit are optional
    expect(optionalItems.some((i) => i.id === "corner_plot_premium")).toBe(true);
    expect(optionalItems.some((i) => i.id === "water_electricity_deposit")).toBe(true);

    // Statutory government taxes are estimated
    expect(estimatedItems.some((i) => i.id === "stamp_duty")).toBe(true);
    expect(estimatedItems.some((i) => i.id === "registration_fee")).toBe(true);
  });

  it("avoids duplicate charges and ensures every item has a unique ID", () => {
    const res = calculatePlotCost({
      sizeSqyd: 167,
      pricePerSqyd: 9000,
      plotNumber: 5,
      isCornerPlot: true,
      includeCornerPremium: true,
      facing: "east",
      includeFacingPremium: true,
      includeWaterDeposit: true,
      includeClubhouseFee: true,
      config: customConfig,
    });

    const ids = res.items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("never uses unverified rates and enforces verified tariff", () => {
    const unverifiedConfig: CostRateConfig = {
      ...customConfig,
      rates_verified: false,
      rates_verified_at: null,
      stamp_duty_percent: 99.0, // Bogus unverified rate
    };

    const res = calculatePlotCost({
      sizeSqyd: 100,
      pricePerSqyd: 10000,
      plotNumber: 6,
      config: unverifiedConfig,
    });

    // Must not use the 99% unverified stamp duty; should fall back to default verified rate (6%)
    expect(res.ratesVerified).toBe(false);
    const stamp = res.items.find((i) => i.id === "stamp_duty");
    expect(stamp?.amount).toBe(60000); // 6% of 1,000,000, NOT 99%
  });

  it("validates rate configuration parameters properly", () => {
    expect(validateRateConfig(customConfig).valid).toBe(true);

    const invalid = validateRateConfig({
      stamp_duty_percent: -5,
      registration_fee_percent: 50,
      development_charges_per_sqyd: -100,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it("correctly serializes and parses rates to/from database strings", () => {
    const userText = "Sawargseema Ventures offers open plots near Shamshabad.";
    const serialized = serializeVentureAbout(userText, customConfig);

    expect(serialized).toContain("---COST_CONFIG---");

    const parsedConfig = parseVentureCostConfig(serialized);
    expect(parsedConfig.stamp_duty_percent).toBe(6.0);
    expect(parsedConfig.development_charges_per_sqyd).toBe(350);
    expect(parsedConfig.rates_verified).toBe(true);

    const cleanAbout = getVentureAboutText(serialized);
    expect(cleanAbout).toBe(userText);
    expect(cleanAbout).not.toContain("---COST_CONFIG---");
  });

  it("generates formatted CSV breakdown file", () => {
    const res = calculatePlotCost({
      sizeSqyd: 167,
      pricePerSqyd: 8750,
      plotNumber: 12,
      config: customConfig,
    });

    const csv = generateCostBreakdownCsv(res, "Sawargseema Ventures");
    expect(csv).toContain('"Plot Number","Plot 12"');
    expect(csv).toContain("Base Plot Price");
    expect(csv).toContain("Stamp Duty");
    expect(csv).toContain("Layout Development Charges");
    expect(csv).toContain("GRAND TOTAL");
  });
});

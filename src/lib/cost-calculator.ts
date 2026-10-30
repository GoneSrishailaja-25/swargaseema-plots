/**
 * Transparent Plot Cost Calculator
 * Handles itemized cost calculations, statutory taxes, development fees,
 * mandatory/optional/estimated charges, rate validation, and database serialization.
 */

export interface CostRateConfig {
  stamp_duty_percent: number; // e.g. 6.0% (Government statutory stamp duty)
  registration_fee_percent: number; // e.g. 0.5% (Government registration charge)
  transfer_duty_tax_percent: number; // e.g. 1.5% (Local body transfer duty / cess)
  development_charges_per_sqyd: number; // e.g. ₹350/sq.yd (BT roads, electricity, drainage, avenue)
  maintenance_charges_per_sqyd: number; // e.g. ₹50/sq.yd (Advance layout corpus & security)
  legal_documentation_fee: number; // e.g. ₹15,000 (Title search, legal opinion, document drafting)
  corner_plot_premium_percent: number; // e.g. 10.0% (Optional / Conditional)
  facing_premium_percent: number; // e.g. 5.0% (East / North prime Vastu facing)
  water_electricity_deposit: number; // e.g. ₹25,000 (Optional utility connection deposit)
  clubhouse_amenity_fee: number; // e.g. ₹50,000 (Optional community center membership)
  rates_verified: boolean; // Must be verified by admin
  rates_verified_at: string | null; // ISO timestamp of verification
  rates_verified_by: string; // Admin officer name/title
  notes?: string;
}

export const DEFAULT_VERIFIED_RATES: CostRateConfig = {
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
  rates_verified_by: "Venture Chief Accounts & Legal Officer",
  notes: "Verified standard statutory tariff and venture infrastructure schedule.",
};

export type ChargeType = "mandatory" | "optional" | "estimated";
export type ChargeCategory = "base" | "statutory" | "development" | "maintenance" | "additional";

export interface CostLineItem {
  id: string;
  title: string;
  description: string;
  category: ChargeCategory;
  chargeType: ChargeType;
  rateLabel: string;
  amount: number;
  isOptional: boolean;
  isSelected: boolean;
  isStatutory: boolean;
}

export interface PaymentMilestone {
  milestone: string;
  percent: number;
  amount: number;
  timing: string;
}

export interface CostBreakdown {
  plotNumber: string | number;
  sizeSqyd: number;
  pricePerSqyd: number;
  basePlotPrice: number;
  items: CostLineItem[];
  mandatorySubtotal: number;
  optionalSubtotal: number;
  statutorySubtotal: number;
  developmentSubtotal: number;
  maintenanceSubtotal: number;
  additionalSubtotal: number;
  grandTotal: number;
  ratesVerified: boolean;
  ratesVerifiedAt: string | null;
  ratesVerifiedBy: string;
  paymentMilestones: PaymentMilestone[];
  disclaimers: string[];
}

export interface CalculateCostParams {
  sizeSqyd: number;
  pricePerSqyd: number;
  plotNumber?: number | string;
  facing?: string;
  isCornerPlot?: boolean;
  includeCornerPremium?: boolean;
  includeFacingPremium?: boolean;
  includeWaterDeposit?: boolean;
  includeClubhouseFee?: boolean;
  config?: CostRateConfig;
}

/**
 * Validates rates to ensure they are within safe realistic ranges and verified.
 */
export function validateRateConfig(config: Partial<CostRateConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (
    config.stamp_duty_percent === undefined ||
    config.stamp_duty_percent < 0 ||
    config.stamp_duty_percent > 30
  ) {
    errors.push("Stamp duty must be between 0% and 30%");
  }
  if (
    config.registration_fee_percent === undefined ||
    config.registration_fee_percent < 0 ||
    config.registration_fee_percent > 10
  ) {
    errors.push("Registration fee must be between 0% and 10%");
  }
  if (
    config.transfer_duty_tax_percent === undefined ||
    config.transfer_duty_tax_percent < 0 ||
    config.transfer_duty_tax_percent > 15
  ) {
    errors.push("Transfer duty / tax must be between 0% and 15%");
  }
  if (
    config.development_charges_per_sqyd === undefined ||
    config.development_charges_per_sqyd < 0
  ) {
    errors.push("Development charges per sq.yd must be 0 or greater");
  }
  if (
    config.maintenance_charges_per_sqyd === undefined ||
    config.maintenance_charges_per_sqyd < 0
  ) {
    errors.push("Maintenance charges per sq.yd must be 0 or greater");
  }
  if (config.legal_documentation_fee === undefined || config.legal_documentation_fee < 0) {
    errors.push("Legal documentation fee must be 0 or greater");
  }
  if (
    config.corner_plot_premium_percent === undefined ||
    config.corner_plot_premium_percent < 0 ||
    config.corner_plot_premium_percent > 50
  ) {
    errors.push("Corner plot premium must be between 0% and 50%");
  }
  if (
    config.facing_premium_percent === undefined ||
    config.facing_premium_percent < 0 ||
    config.facing_premium_percent > 50
  ) {
    errors.push("Facing premium must be between 0% and 50%");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Calculates complete itemized plot cost breakdown.
 * Avoids duplicate charges by using unique item keys and strict category partitioning.
 * Never uses unverified rates — falls back to audited default verified tariff if config is unverified.
 */
export function calculatePlotCost(params: CalculateCostParams): CostBreakdown {
  const size = Math.max(0, Number(params.sizeSqyd) || 0);
  const ratePerSqyd = Math.max(0, Number(params.pricePerSqyd) || 0);
  const plotNum = params.plotNumber ?? "—";

  // Check rate verification: never use unverified rates for calculations
  let activeConfig = params.config ?? DEFAULT_VERIFIED_RATES;
  let isRateVerified = activeConfig.rates_verified === true;

  if (!isRateVerified) {
    console.warn(
      "[CostCalculator] Rate configuration is unverified. Falling back to default verified tariff.",
    );
    activeConfig = {
      ...DEFAULT_VERIFIED_RATES,
      notes: "Using verified benchmark tariff (admin rates pending verification)",
    };
    isRateVerified = false;
  }

  // 1. BASE PLOT PRICE
  const basePlotPrice = Math.round(size * ratePerSqyd);

  const itemsMap = new Map<string, CostLineItem>();

  // Add Base Price item
  itemsMap.set("base_plot_price", {
    id: "base_plot_price",
    title: "Base Plot Price",
    description: `Core land cost for ${size} sq.yd at ₹${ratePerSqyd.toLocaleString("en-IN")}/sq.yd`,
    category: "base",
    chargeType: "mandatory",
    rateLabel: `₹${ratePerSqyd.toLocaleString("en-IN")}/sq.yd`,
    amount: basePlotPrice,
    isOptional: false,
    isSelected: true,
    isStatutory: false,
  });

  // 2. STATUTORY CHARGES (Government Fees & Taxes - Estimated based on prevailing government tariff)
  const stampDutyAmount = Math.round((basePlotPrice * activeConfig.stamp_duty_percent) / 100);
  itemsMap.set("stamp_duty", {
    id: "stamp_duty",
    title: "Stamp Duty",
    description: "State government registration stamp duty payable to Revenue Department",
    category: "statutory",
    chargeType: "estimated",
    rateLabel: `${activeConfig.stamp_duty_percent}% of plot value`,
    amount: stampDutyAmount,
    isOptional: false,
    isSelected: true,
    isStatutory: true,
  });

  const registrationFeeAmount = Math.round(
    (basePlotPrice * activeConfig.registration_fee_percent) / 100,
  );
  itemsMap.set("registration_fee", {
    id: "registration_fee",
    title: "Registration Fee",
    description: "Sub-Registrar office statutory documentation registration fee",
    category: "statutory",
    chargeType: "estimated",
    rateLabel: `${activeConfig.registration_fee_percent}% of plot value`,
    amount: registrationFeeAmount,
    isOptional: false,
    isSelected: true,
    isStatutory: true,
  });

  const transferTaxAmount = Math.round(
    (basePlotPrice * activeConfig.transfer_duty_tax_percent) / 100,
  );
  itemsMap.set("transfer_duty_tax", {
    id: "transfer_duty_tax",
    title: "Transfer Duty / Local Cess",
    description: "Local Gram Panchayat / Municipal body statutory transfer duty and cess",
    category: "statutory",
    chargeType: "estimated",
    rateLabel: `${activeConfig.transfer_duty_tax_percent}% of plot value`,
    amount: transferTaxAmount,
    isOptional: false,
    isSelected: true,
    isStatutory: true,
  });

  // 3. INFRASTRUCTURE & DEVELOPMENT CHARGES
  const devAmount = Math.round(size * activeConfig.development_charges_per_sqyd);
  itemsMap.set("development_charges", {
    id: "development_charges",
    title: "Layout Development Charges",
    description:
      "30 ft & 40 ft BT roads, underground drainage, electrical cabling, transformers & avenue plantation",
    category: "development",
    chargeType: "mandatory",
    rateLabel: `₹${activeConfig.development_charges_per_sqyd}/sq.yd`,
    amount: devAmount,
    isOptional: false,
    isSelected: true,
    isStatutory: false,
  });

  // 4. MAINTENANCE FEES
  const maintAmount = Math.round(size * activeConfig.maintenance_charges_per_sqyd);
  itemsMap.set("maintenance_corpus", {
    id: "maintenance_corpus",
    title: "Layout Maintenance Corpus",
    description:
      "2-year advance society corpus for security guards, common street lighting, and park upkeep",
    category: "maintenance",
    chargeType: "mandatory",
    rateLabel: `₹${activeConfig.maintenance_charges_per_sqyd}/sq.yd`,
    amount: maintAmount,
    isOptional: false,
    isSelected: true,
    isStatutory: false,
  });

  // 5. LEGAL & DOCUMENTATION CHARGES
  itemsMap.set("legal_documentation", {
    id: "legal_documentation",
    title: "Legal, Title Search & Drafting Fee",
    description:
      "30-year encumbrance search, legal title verification, and advocate sale deed drafting",
    category: "additional",
    chargeType: "mandatory",
    rateLabel: "Fixed legal fee",
    amount: activeConfig.legal_documentation_fee,
    isOptional: false,
    isSelected: true,
    isStatutory: false,
  });

  // 6. OPTIONAL / CONDITIONAL PREMIUMS (Avoid duplicate additions)
  // Corner Plot Premium
  const cornerSelected = Boolean(params.includeCornerPremium ?? params.isCornerPlot);
  const cornerAmount = Math.round((basePlotPrice * activeConfig.corner_plot_premium_percent) / 100);
  itemsMap.set("corner_plot_premium", {
    id: "corner_plot_premium",
    title: "Corner Plot Premium",
    description:
      "Dual road frontage with enhanced ventilation, wider approach, and prime commercial visibility",
    category: "additional",
    chargeType: "optional",
    rateLabel: `${activeConfig.corner_plot_premium_percent}% of base price`,
    amount: cornerAmount,
    isOptional: true,
    isSelected: cornerSelected,
    isStatutory: false,
  });

  // Prime Facing Premium (East or North) - applied at most once
  const isEastOrNorth =
    params.facing?.toLowerCase().includes("east") || params.facing?.toLowerCase().includes("north");
  const facingSelected = Boolean(params.includeFacingPremium ?? isEastOrNorth);
  const facingAmount = Math.round((basePlotPrice * activeConfig.facing_premium_percent) / 100);
  itemsMap.set("prime_facing_premium", {
    id: "prime_facing_premium",
    title: "Prime Vastu Facing Premium (East/North)",
    description: "Sunrise-facing premium orientation aligned with traditional Vastu planning",
    category: "additional",
    chargeType: "optional",
    rateLabel: `${activeConfig.facing_premium_percent}% of base price`,
    amount: facingAmount,
    isOptional: true,
    isSelected: facingSelected,
    isStatutory: false,
  });

  // Water & Electricity Connection Deposit
  const waterSelected = Boolean(params.includeWaterDeposit ?? false);
  itemsMap.set("water_electricity_deposit", {
    id: "water_electricity_deposit",
    title: "Water & Power Infrastructure Deposit",
    description:
      "Individual water line connection, meter installation, and dedicated electrical load deposit",
    category: "additional",
    chargeType: "optional",
    rateLabel: "One-time deposit",
    amount: activeConfig.water_electricity_deposit,
    isOptional: true,
    isSelected: waterSelected,
    isStatutory: false,
  });

  // Proposed Clubhouse Membership
  const clubhouseSelected = Boolean(params.includeClubhouseFee ?? false);
  itemsMap.set("clubhouse_amenity_fee", {
    id: "clubhouse_amenity_fee",
    title: "Clubhouse & Recreation Membership",
    description:
      "Proposed community center, indoor games hall, gym, and children's recreation access",
    category: "additional",
    chargeType: "optional",
    rateLabel: "Lifetime membership",
    amount: activeConfig.clubhouse_amenity_fee,
    isOptional: true,
    isSelected: clubhouseSelected,
    isStatutory: false,
  });

  const allItems = Array.from(itemsMap.values());

  // Subtotals
  let mandatorySubtotal = 0;
  let optionalSubtotal = 0;
  let statutorySubtotal = 0;
  let developmentSubtotal = 0;
  let maintenanceSubtotal = 0;
  let additionalSubtotal = 0;

  for (const item of allItems) {
    if (item.isSelected) {
      if (item.chargeType === "mandatory") mandatorySubtotal += item.amount;
      else if (item.chargeType === "optional") optionalSubtotal += item.amount;
      else if (item.chargeType === "estimated" && item.isStatutory) {
        // Statutory charges are mandatory government dues
        mandatorySubtotal += item.amount;
      }

      if (item.category === "statutory") statutorySubtotal += item.amount;
      else if (item.category === "development") developmentSubtotal += item.amount;
      else if (item.category === "maintenance") maintenanceSubtotal += item.amount;
      else if (item.category === "additional") additionalSubtotal += item.amount;
    }
  }

  const grandTotal = allItems
    .filter((item) => item.isSelected)
    .reduce((sum, item) => sum + item.amount, 0);

  // Milestone schedule
  const paymentMilestones: PaymentMilestone[] = [
    {
      milestone: "1. Token Booking Advance",
      percent: 10,
      amount: Math.round(grandTotal * 0.1),
      timing: "Upon selection & initial plot reservation form submission",
    },
    {
      milestone: "2. Agreement of Sale Confirmation",
      percent: 20,
      amount: Math.round(grandTotal * 0.2),
      timing: "Within 15 days of reservation along with verified document review",
    },
    {
      milestone: "3. Final Registration & Handover",
      percent: 70,
      amount: Math.round(grandTotal * 0.7),
      timing: "At the Sub-Registrar Office during final sale deed execution",
    },
  ];

  const disclaimers = [
    "Government statutory fees (Stamp Duty, Registration Fee & Transfer Cess) are estimated based on prevailing official tariff guidelines and are payable directly at the Sub-Registrar Office upon deed execution.",
    "Development and maintenance charges cover comprehensive internal 30/40 ft BT roads, underground drainage, transformers, and 2 years advance layout society upkeep.",
    "Optional charges (Corner premium, Facing premium, Utility deposit) can be selected or excluded as per customer preference.",
    "All rates are verified by the venture accounts and legal team. Official sale deed values are subject to local Sub-Registrar verification.",
  ];

  return {
    plotNumber: plotNum,
    sizeSqyd: size,
    pricePerSqyd: ratePerSqyd,
    basePlotPrice,
    items: allItems,
    mandatorySubtotal,
    optionalSubtotal,
    statutorySubtotal,
    developmentSubtotal,
    maintenanceSubtotal,
    additionalSubtotal,
    grandTotal,
    ratesVerified: isRateVerified,
    ratesVerifiedAt: activeConfig.rates_verified_at,
    ratesVerifiedBy: activeConfig.rates_verified_by,
    paymentMilestones,
    disclaimers,
  };
}

// DATABASE PERSISTENCE HELPERS
const CONFIG_DELIMITER = "\n\n---COST_CONFIG---\n";

/**
 * Extracts CostRateConfig from venture table's about column, or returns default verified rates.
 */
export function parseVentureCostConfig(ventureAbout: string | null | undefined): CostRateConfig {
  if (!ventureAbout) return DEFAULT_VERIFIED_RATES;
  const parts = ventureAbout.split("---COST_CONFIG---");
  if (parts.length > 1 && parts[1]?.trim()) {
    try {
      const parsed = JSON.parse(parts[1].trim());
      const validation = validateRateConfig(parsed);
      if (validation.valid) {
        return {
          ...DEFAULT_VERIFIED_RATES,
          ...parsed,
        };
      }
    } catch (e) {
      console.error("[CostCalculator] Failed to parse cost config from database:", e);
    }
  }
  return DEFAULT_VERIFIED_RATES;
}

/**
 * Serializes user-facing about text and CostRateConfig into a single database string.
 */
export function serializeVentureAbout(userText: string, config: CostRateConfig): string {
  const cleanText = getVentureAboutText(userText);
  return `${cleanText}${CONFIG_DELIMITER}${JSON.stringify(config, null, 2)}`;
}

/**
 * Returns only the clean human-readable text from venture.about, omitting internal JSON config.
 */
export function getVentureAboutText(ventureAbout: string | null | undefined): string {
  if (!ventureAbout) return "";
  return ventureAbout.split("---COST_CONFIG---")[0]?.trim() ?? "";
}

/**
 * Generates formatted CSV string for customer download.
 */
export function generateCostBreakdownCsv(
  breakdown: CostBreakdown,
  ventureName = "Sawargseema Ventures",
): string {
  const rows: string[] = [];
  rows.push(`"Venture","${ventureName}"`);
  rows.push(`"Plot Number","Plot ${breakdown.plotNumber}"`);
  rows.push(`"Plot Size (sq.yd)","${breakdown.sizeSqyd}"`);
  rows.push(`"Price per sq.yd (INR)","${breakdown.pricePerSqyd}"`);
  rows.push(
    `"Rate Verification Status","${breakdown.ratesVerified ? `Verified by ${breakdown.ratesVerifiedBy}` : "Pending Verification"}"`,
  );
  rows.push(`"Generated Date","${new Date().toLocaleDateString("en-IN")}"`);
  rows.push("");
  rows.push('"Category","Charge Component","Rate / Basis","Type","Included","Amount (INR)"');

  for (const item of breakdown.items) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    rows.push(
      [
        esc(item.category.toUpperCase()),
        esc(item.title),
        esc(item.rateLabel),
        esc(item.chargeType.toUpperCase()),
        esc(item.isSelected ? "YES" : "NO"),
        item.amount,
      ].join(","),
    );
  }

  rows.push("");
  rows.push(`"SUBTOTAL","Mandatory & Statutory Charges","","","","${breakdown.mandatorySubtotal}"`);
  rows.push(`"SUBTOTAL","Selected Optional Charges","","","","${breakdown.optionalSubtotal}"`);
  rows.push(`"GRAND TOTAL","Total Estimated Investment","","","","${breakdown.grandTotal}"`);
  rows.push("");
  rows.push('"PAYMENT SCHEDULE","Milestone","Percentage","Timing","Amount (INR)"');
  for (const m of breakdown.paymentMilestones) {
    rows.push(
      `"",${JSON.stringify(m.milestone)},"${m.percent}%",${JSON.stringify(m.timing)},${m.amount}`,
    );
  }

  return rows.join("\n");
}

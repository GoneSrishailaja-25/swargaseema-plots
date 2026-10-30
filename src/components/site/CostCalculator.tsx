import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Calculator,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Info,
  Compass,
  ArrowRight,
  Shield,
  Layers,
  FileText,
  AlertTriangle,
  Building2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { inr, num, cap, plotsQuery, phasesQuery, ventureQuery, type Plot } from "@/lib/data";
import {
  calculatePlotCost,
  generateCostBreakdownCsv,
  parseVentureCostConfig,
  type CostLineItem,
  type ChargeType,
} from "@/lib/cost-calculator";

export function CostCalculator({
  initialPlotId,
  onBookPlot,
}: {
  initialPlotId?: string;
  onBookPlot?: (plot: Plot) => void;
}) {
  const { user, isAdmin } = useAuth();
  const { data: plots = [] } = useQuery(plotsQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const { data: venture } = useQuery(ventureQuery);

  // Active verified rate configuration from database
  const rateConfig = useMemo(() => {
    return parseVentureCostConfig(venture?.about);
  }, [venture?.about]);

  // Selected plot ID or "custom"
  const [selectedPlotId, setSelectedPlotId] = useState<string>(
    initialPlotId ?? plots[0]?.id ?? "custom",
  );

  // Custom plot inputs if "custom" is selected
  const [customSize, setCustomSize] = useState<string>("167");
  const [customPrice, setCustomPrice] = useState<string>("9000");
  const [customFacing, setCustomFacing] = useState<string>("east");

  // Optional charge toggles
  const [includeCornerPremium, setIncludeCornerPremium] = useState<boolean>(false);
  const [includeFacingPremium, setIncludeFacingPremium] = useState<boolean>(true);
  const [includeWaterDeposit, setIncludeWaterDeposit] = useState<boolean>(false);
  const [includeClubhouseFee, setIncludeClubhouseFee] = useState<boolean>(false);

  // Active plot object (if a real plot is chosen)
  const activePlot = useMemo(() => {
    return plots.find((p) => p.id === selectedPlotId) ?? null;
  }, [plots, selectedPlotId]);

  // Handle plot change
  const handlePlotChange = (plotId: string) => {
    setSelectedPlotId(plotId);
    if (plotId !== "custom") {
      const p = plots.find((item) => item.id === plotId);
      if (p) {
        const isCorner = p.location_note?.toLowerCase().includes("corner") ?? false;
        const isEastNorth = p.facing === "east" || p.facing === "north";
        setIncludeCornerPremium(isCorner);
        setIncludeFacingPremium(isEastNorth);
      }
    }
  };

  // Compute values
  const sizeSqyd = activePlot ? Number(activePlot.size_sqyd) : Number(customSize) || 0;
  const pricePerSqyd = activePlot ? Number(activePlot.price_per_sqyd) : Number(customPrice) || 0;
  const plotFacing = activePlot ? activePlot.facing : customFacing;
  const isCornerPlot = activePlot
    ? (activePlot.location_note?.toLowerCase().includes("corner") ?? false)
    : includeCornerPremium;

  // Run calculation
  const breakdown = useMemo(() => {
    return calculatePlotCost({
      plotNumber: activePlot ? activePlot.plot_number : "Custom Plot",
      sizeSqyd,
      pricePerSqyd,
      facing: plotFacing,
      isCornerPlot,
      includeCornerPremium,
      includeFacingPremium,
      includeWaterDeposit,
      includeClubhouseFee,
      config: rateConfig,
    });
  }, [
    activePlot,
    sizeSqyd,
    pricePerSqyd,
    plotFacing,
    isCornerPlot,
    includeCornerPremium,
    includeFacingPremium,
    includeWaterDeposit,
    includeClubhouseFee,
    rateConfig,
  ]);

  // Download CSV
  const handleDownloadCsv = () => {
    try {
      const csvContent = generateCostBreakdownCsv(
        breakdown,
        venture?.name ?? "Sawargseema Ventures",
      );
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Sawargseema_Plot_${breakdown.plotNumber}_Cost_Breakdown.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Cost breakdown downloaded successfully (CSV)");
    } catch {
      toast.error("Failed to generate CSV export");
    }
  };

  // Print quotation
  const handlePrint = () => {
    window.print();
  };

  const activePhase = phases.find((ph) => ph.id === activePlot?.phase_id);

  return (
    <div className="space-y-8">
      {/* RATE VERIFICATION STATUS BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Verified Transparent Cost Breakdown</span>
              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.2">
                100% Audited Rates
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Statutory stamp duties, development fees, and corpus rates verified by{" "}
              <b>{rateConfig.rates_verified_by}</b>. No hidden charges or unverified fees.
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button asChild size="sm" variant="outline" className="gap-1.5 shrink-0">
            <Link to="/admin">
              <Shield className="h-3.5 w-3.5" /> Manage Fee Rates
            </Link>
          </Button>
        )}
      </div>

      {/* TOP CONTROLS: PLOT SELECTION & INPUTS */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h3 className="font-display text-xl font-bold text-navy flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Plot Cost Estimator & Quotation
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Select an available venture plot or specify custom parameters for an exact, itemized
              financial calculation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="h-4 w-4" /> Print Quotation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
        </div>

        {/* SELECTOR ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold">Select Venture Plot</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
              value={selectedPlotId}
              onChange={(e) => handlePlotChange(e.target.value)}
            >
              <optgroup label="Venture Open Plots (Live Database)">
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    Plot #{p.plot_number} ({Number(p.size_sqyd)} sq.yd · {cap(p.status)} ·{" "}
                    {cap(p.facing)})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Custom Plot Estimation">
                <option value="custom">Custom Area & Rate...</option>
              </optgroup>
            </select>
          </div>

          {activePlot ? (
            <>
              <div>
                <Label className="text-xs font-semibold">Plot Specifications</Label>
                <div className="mt-1 h-10 rounded-md border bg-muted/40 px-3 flex items-center justify-between text-xs font-medium">
                  <span>{activePhase?.name ?? "General Sector"}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="font-bold text-foreground">
                    {Number(activePlot.size_sqyd)} sq.yd
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="capitalize">{activePlot.facing} Facing</span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Current Base Rate</Label>
                <div className="mt-1 h-10 rounded-md border bg-muted/40 px-3 flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Rate / sq.yd:</span>
                  <span className="font-extrabold text-primary text-sm">
                    {inr(Number(activePlot.price_per_sqyd))}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs font-semibold">Custom Area (sq.yd)</Label>
                <Input
                  type="number"
                  min="50"
                  step="1"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  className="mt-1 h-10 text-sm"
                  placeholder="e.g. 167"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Custom Rate per sq.yd (₹)</Label>
                <Input
                  type="number"
                  min="1000"
                  step="100"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="mt-1 h-10 text-sm"
                  placeholder="e.g. 9000"
                />
              </div>
            </>
          )}
        </div>

        {/* OPTIONAL CHARGES SELECTION PANEL */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Optional & Conditional Premiums
            </span>
            <span className="text-[11px] text-muted-foreground">
              Toggle applicable preferences to update total estimate
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Corner Plot Premium */}
            <label className="flex items-start gap-2.5 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/40 transition">
              <Checkbox
                checked={includeCornerPremium}
                onCheckedChange={(c) => setIncludeCornerPremium(Boolean(c))}
                className="mt-0.5"
              />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">Corner Plot (+10%)</p>
                <p className="text-[11px] text-muted-foreground">Dual road frontage</p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  Optional
                </Badge>
              </div>
            </label>

            {/* East/North Facing Premium */}
            <label className="flex items-start gap-2.5 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/40 transition">
              <Checkbox
                checked={includeFacingPremium}
                onCheckedChange={(c) => setIncludeFacingPremium(Boolean(c))}
                className="mt-0.5"
              />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">Prime Vastu Facing (+5%)</p>
                <p className="text-[11px] text-muted-foreground">East or North entrance</p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  Optional
                </Badge>
              </div>
            </label>

            {/* Water & Power Connection */}
            <label className="flex items-start gap-2.5 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/40 transition">
              <Checkbox
                checked={includeWaterDeposit}
                onCheckedChange={(c) => setIncludeWaterDeposit(Boolean(c))}
                className="mt-0.5"
              />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">Utility Deposit (₹25k)</p>
                <p className="text-[11px] text-muted-foreground">Individual water line</p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  Optional
                </Badge>
              </div>
            </label>

            {/* Clubhouse Amenity */}
            <label className="flex items-start gap-2.5 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/40 transition">
              <Checkbox
                checked={includeClubhouseFee}
                onCheckedChange={(c) => setIncludeClubhouseFee(Boolean(c))}
                className="mt-0.5"
              />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">Clubhouse Fee (₹50k)</p>
                <p className="text-[11px] text-muted-foreground">Lifetime gym & hall</p>
                <Badge variant="outline" className="text-[10px] mt-1">
                  Optional
                </Badge>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* DETAILED COST BREAKDOWN SECTION (PRINTABLE) */}
      <div
        id="cost-quotation-print-area"
        className="rounded-2xl border bg-card p-6 shadow-sm space-y-6"
      >
        {/* Printable Header */}
        <div className="hidden print:block border-b pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display text-navy">
                {venture?.name ?? "Sawargseema Ventures"}
              </h1>
              <p className="text-xs text-muted-foreground">{venture?.address}</p>
              <p className="text-xs text-muted-foreground">
                Phone: {venture?.phone} | Email: {venture?.email}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-foreground">Official Cost Quotation</p>
              <p className="text-muted-foreground">Plot: #{breakdown.plotNumber}</p>
              <p className="text-muted-foreground">
                Date: {new Date().toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* SUMMARY STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">Base Plot Price</span>
            <div className="text-xl sm:text-2xl font-extrabold text-navy mt-1">
              {inr(breakdown.basePlotPrice)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {breakdown.sizeSqyd} sq.yd @ {inr(breakdown.pricePerSqyd)}/yd
            </span>
          </div>

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">
              Statutory Govt. Dues (Est.)
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1">
              {inr(breakdown.statutorySubtotal)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Stamp Duty (6%) + Reg (0.5%) + Cess (1.5%)
            </span>
          </div>

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground">
              Infrastructure & Corpus
            </span>
            <div className="text-xl sm:text-2xl font-extrabold text-primary mt-1">
              {inr(breakdown.developmentSubtotal + breakdown.maintenanceSubtotal)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              BT roads, drainage, lighting & 2-yr corpus
            </span>
          </div>

          <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 shadow-sm">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Total Estimated Investment
            </span>
            <div className="text-2xl sm:text-3xl font-black text-primary mt-1 font-display">
              {inr(breakdown.grandTotal)}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
              All mandatory + selected items included
            </span>
          </div>
        </div>

        {/* ITEMIZED CHARGES BREAKDOWN TABLE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-bold text-base text-navy flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Itemized Cost Breakdown
            </h4>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Badge className="h-2 w-2 rounded-full p-0 bg-emerald-600" /> Mandatory
              </span>
              <span className="flex items-center gap-1 font-medium">
                <Badge className="h-2 w-2 rounded-full p-0 bg-sky-500" /> Optional
              </span>
              <span className="flex items-center gap-1 font-medium">
                <Badge className="h-2 w-2 rounded-full p-0 bg-amber-500" /> Estimated
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Charge Component</th>
                  <th className="py-3 px-4 hidden md:table-cell">Calculation Basis</th>
                  <th className="py-3 px-3 text-center">Classification</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* 1. Base Price */}
                <CostTableRow item={breakdown.items.find((i) => i.id === "base_plot_price")!} />

                {/* 2. Statutory Category Header */}
                <tr className="bg-slate-100 dark:bg-slate-900 font-semibold text-xs text-muted-foreground">
                  <td colSpan={4} className="py-2 px-4 uppercase tracking-wider">
                    Statutory Government Fees & Taxes (Payable at Sub-Registrar Office)
                  </td>
                </tr>
                {breakdown.items
                  .filter((i) => i.category === "statutory")
                  .map((item) => (
                    <CostTableRow key={item.id} item={item} />
                  ))}

                {/* 3. Layout Infrastructure & Development */}
                <tr className="bg-slate-100 dark:bg-slate-900 font-semibold text-xs text-muted-foreground">
                  <td colSpan={4} className="py-2 px-4 uppercase tracking-wider">
                    Venture Development & Civil Works
                  </td>
                </tr>
                {breakdown.items
                  .filter(
                    (i) =>
                      i.category === "development" ||
                      i.category === "maintenance" ||
                      i.id === "legal_documentation",
                  )
                  .map((item) => (
                    <CostTableRow key={item.id} item={item} />
                  ))}

                {/* 4. Optional & Additional Charges */}
                <tr className="bg-slate-100 dark:bg-slate-900 font-semibold text-xs text-muted-foreground">
                  <td colSpan={4} className="py-2 px-4 uppercase tracking-wider">
                    Additional & Optional Preferences
                  </td>
                </tr>
                {breakdown.items
                  .filter((i) => i.isOptional)
                  .map((item) => (
                    <CostTableRow key={item.id} item={item} />
                  ))}

                {/* Grand Total Row */}
                <tr className="bg-primary/10 font-bold border-t-2 border-primary text-sm sm:text-base">
                  <td colSpan={2} className="py-4 px-4 text-primary font-display font-extrabold">
                    Grand Estimated Total Investment
                  </td>
                  <td className="py-4 px-3 text-center hidden md:table-cell">
                    <Badge className="bg-primary text-primary-foreground">All Inclusive</Badge>
                  </td>
                  <td className="py-4 px-4 text-right text-primary font-black font-display text-base sm:text-xl">
                    {inr(breakdown.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PAYMENT MILESTONES SCHEDULE */}
        <div className="rounded-xl border bg-background p-4 sm:p-5 space-y-4">
          <h4 className="font-display font-bold text-sm sm:text-base text-navy flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Staged Payment Schedule (3 Milestones)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {breakdown.paymentMilestones.map((m, idx) => (
              <div key={idx} className="rounded-lg border bg-card p-3 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span>{m.milestone}</span>
                  <Badge variant="secondary">{m.percent}%</Badge>
                </div>
                <div className="text-lg font-extrabold text-primary">{inr(m.amount)}</div>
                <p className="text-[11px] text-muted-foreground leading-tight">{m.timing}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LEGAL & STATUTORY DISCLAIMERS */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4 text-primary" /> Important Regulatory & Statutory Disclaimers:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {breakdown.disclaimers.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-5">
          <div className="text-xs text-muted-foreground">
            Quotation calculated for <b>Plot #{breakdown.plotNumber}</b> ({breakdown.sizeSqyd}{" "}
            sq.yd).
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleDownloadCsv}
              className="gap-2 text-xs flex-1 sm:flex-none"
            >
              <Download className="h-4 w-4" /> Download Breakdown (CSV)
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="gap-2 text-xs flex-1 sm:flex-none"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
            {activePlot && activePlot.status === "available" && (
              <Button asChild className="gap-2 text-xs flex-1 sm:flex-none">
                <Link to="/layout">
                  Book Plot #{activePlot.plot_number} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Single row in the itemized table
function CostTableRow({ item }: { item: CostLineItem }) {
  const isIncluded = item.isSelected;

  const typeBadgeStyles: Record<ChargeType, string> = {
    mandatory: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    optional: "bg-sky-600/10 text-sky-700 border-sky-600/30",
    estimated: "bg-amber-600/10 text-amber-700 border-amber-600/30",
  };

  return (
    <tr className={!isIncluded ? "opacity-40 bg-muted/20" : "hover:bg-muted/30 transition"}>
      <td className="py-3 px-4">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          {item.title}
          {!isIncluded && (
            <span className="text-[10px] text-muted-foreground font-normal">(Excluded)</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{item.description}</p>
      </td>

      <td className="py-3 px-4 hidden md:table-cell text-xs text-muted-foreground font-mono">
        {item.rateLabel}
      </td>

      <td className="py-3 px-3 text-center">
        <Badge
          variant="outline"
          className={`text-[10px] uppercase font-bold px-2 py-0.5 ${typeBadgeStyles[item.chargeType]}`}
        >
          {item.chargeType}
        </Badge>
      </td>

      <td className="py-3 px-4 text-right font-bold text-foreground">
        {isIncluded ? inr(item.amount) : "—"}
      </td>
    </tr>
  );
}

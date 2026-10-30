import { useState, useMemo } from "react";
import {
  Search,
  Trees,
  Compass,
  Filter,
  Shield,
  Info,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inr, cap, type Phase, type Plot, type PlotStatus } from "@/lib/data";
import { useAuth } from "@/lib/auth";

// Strict color styling for Available (Green), Reserved (Orange), and Sold (Red)
export const plotStatusStyles: Record<
  PlotStatus,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    label: string;
    subText: string;
  }
> = {
  available: {
    bg: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
    border: "border-emerald-700 ring-emerald-600/30",
    text: "text-white",
    badgeBg: "bg-emerald-700/80 text-white",
    label: "Available",
    subText: "text-emerald-100",
  },
  reserved: {
    bg: "bg-amber-500 hover:bg-amber-400 active:bg-amber-600",
    border: "border-amber-600 ring-amber-500/30",
    text: "text-slate-950 font-bold",
    badgeBg: "bg-amber-600 text-slate-950",
    label: "Reserved",
    subText: "text-slate-900",
  },
  sold: {
    bg: "bg-rose-600 hover:bg-rose-500 active:bg-rose-700",
    border: "border-rose-700 ring-rose-600/30",
    text: "text-white",
    badgeBg: "bg-rose-700/80 text-white",
    label: "Sold",
    subText: "text-rose-100",
  },
};

function formatCompactPrice(price: number | null): string {
  if (price === null || price <= 0) return "—";
  if (price >= 10000000) {
    return `₹${(price / 10000000).toFixed(2)} Cr`;
  }
  if (price >= 100000) {
    return `₹${(price / 100000).toFixed(1)} L`;
  }
  if (price >= 1000) {
    return `₹${(price / 1000).toFixed(0)}k`;
  }
  return `₹${price}`;
}

export function PlotLayout({
  plots,
  phases,
  onSelect,
}: {
  plots: Plot[];
  phases: Phase[];
  onSelect: (p: Plot) => void;
}) {
  const { isAdmin } = useAuth();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sort plots by plot number ascending
  const sortedPlots = useMemo(() => {
    return [...plots].sort((a, b) => a.plot_number - b.plot_number);
  }, [plots]);

  // Overall counts across all 48 plots
  const counts = useMemo(() => {
    const total = plots.length;
    let available = 0;
    let reserved = 0;
    let sold = 0;
    for (const p of plots) {
      if (p.status === "available") available++;
      else if (p.status === "reserved") reserved++;
      else if (p.status === "sold") sold++;
    }
    return { total, available, reserved, sold };
  }, [plots]);

  // Filtered list of phases to display
  const phasesToDisplay = useMemo(() => {
    if (selectedPhaseId === "all") return phases;
    return phases.filter((ph) => ph.id === selectedPhaseId);
  }, [phases, selectedPhaseId]);

  return (
    <div className="space-y-6">
      {/* DISCLAIMER CALLOUT BANNER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Sample Illustrative Venture Layout</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This interactive visual plan displays all 48 residential plots arranged across sectors
              for demonstration and availability reference. It is not an actual surveyed boundary
              map. Actual legal coordinates and boundary survey are verified with the venture
              office.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Badge className="shrink-0 bg-primary text-primary-foreground gap-1.5 py-1 px-3">
            <Shield className="h-3.5 w-3.5" /> Admin Mode: Click any plot to edit
          </Badge>
        )}
      </div>

      {/* FILTER & STATS CONTROL BAR */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        {/* Top row: search & stats */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plot # (e.g. 12)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Quick counts */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Status Overview:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1 font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {counts.available} Available
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-medium text-amber-800">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {counts.reserved} Reserved
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-600/30 bg-rose-600/10 px-3 py-1 font-medium text-rose-700">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              {counts.sold} Sold
            </span>
            <span className="text-muted-foreground font-medium pl-1">
              ({counts.total} Total Plots)
            </span>
          </div>
        </div>

        {/* Bottom row: Phase & Status filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-3">
          {/* Phase Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Phase:</span>
            <Button
              size="sm"
              variant={selectedPhaseId === "all" ? "default" : "outline"}
              onClick={() => setSelectedPhaseId("all")}
              className="h-8 text-xs px-3"
            >
              All Phases (48)
            </Button>
            {phases.map((ph) => {
              const countInPhase = plots.filter((p) => p.phase_id === ph.id).length;
              return (
                <Button
                  key={ph.id}
                  size="sm"
                  variant={selectedPhaseId === ph.id ? "default" : "outline"}
                  onClick={() => setSelectedPhaseId(ph.id)}
                  className="h-8 text-xs px-3"
                >
                  {ph.name} ({countInPhase})
                </Button>
              );
            })}
          </div>

          {/* Status Filter buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Filter:</span>
            {(["all", "available", "reserved", "sold"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "secondary" : "ghost"}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-8 text-xs px-2.5 capitalize",
                  statusFilter === s && "font-bold shadow-sm",
                )}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* VISUAL MASTER PLAN BLUEPRINT */}
      <div className="relative rounded-2xl border-4 border-primary/20 bg-slate-900/5 p-4 sm:p-6 lg:p-8 overflow-hidden shadow-inner">
        {/* Architectural Compass */}
        <div className="absolute right-3 top-3 sm:right-6 sm:top-6 z-10">
          <CompassRose />
        </div>

        {/* Master Plan Header Banner */}
        <div className="mb-6 max-w-xl">
          <p className="text-xs uppercase tracking-widest font-bold text-primary">
            Sawargseema Ventures Master Plan
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy font-display mt-0.5">
            Architectural Plot Layout
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            48 Rectangular Plots in 6 Rows with 30 ft and 40 ft internal road network. Click any
            plot for full dimensions, price, and booking.
          </p>
        </div>

        {/* 40 FT MAIN APPROACH BOULEVARD (ENTRY) */}
        <div className="mb-6 rounded-xl bg-slate-800 text-white p-3 shadow-md flex flex-wrap items-center justify-between gap-2 border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-slate-950 text-xs font-bold">
              ✓
            </span>
            <span className="text-xs sm:text-sm font-bold tracking-wide uppercase">
              Main Entrance & 40 FT Approach Boulevard
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-slate-900/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Grand Arch & Security Gate
          </span>
        </div>

        {/* PHASES SECTORS */}
        <div className="space-y-8">
          {phasesToDisplay.map((ph, phaseIndex) => {
            const phasePlots = sortedPlots.filter((p) => p.phase_id === ph.id);
            return (
              <div key={ph.id} className="space-y-4">
                <PhaseBlock
                  phase={ph}
                  phaseNumber={phaseIndex + 1}
                  plots={phasePlots}
                  statusFilter={statusFilter}
                  searchQuery={searchQuery}
                  onSelect={onSelect}
                />

                {/* BUFFER BETWEEN PHASES */}
                {phaseIndex === 0 && selectedPhaseId === "all" && (
                  <div className="my-6 rounded-lg bg-emerald-950/10 border border-emerald-600/30 p-2.5 flex items-center justify-center gap-3 text-emerald-800 text-xs font-semibold">
                    <Trees className="h-4 w-4 text-emerald-600" />
                    <span>
                      Central Green Belt & Avenue Plantation (Proposed 40 FT Garden Boulevard)
                    </span>
                    <Trees className="h-4 w-4 text-emerald-600" />
                  </div>
                )}

                {phaseIndex === 1 && selectedPhaseId === "all" && (
                  <div className="my-6 rounded-lg bg-primary/10 border border-primary/20 p-2.5 flex items-center justify-center gap-3 text-primary text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>Proposed Community Center, Water Tank & Park Space</span>
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* REAR BOUNDARY */}
        <div className="mt-8 pt-4 border-t-2 border-dashed border-slate-300 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <span>— Venture Rear Boundary & Peripheral Green Wall —</span>
        </div>
      </div>

      {/* FOOTER LEGEND & MOBILE TIP */}
      <div className="rounded-xl border bg-muted/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-foreground">Color Legend:</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3.5 w-3.5 rounded bg-emerald-600 shadow-sm" /> Available (Open for
            booking)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3.5 w-3.5 rounded bg-amber-500 shadow-sm" /> Reserved (Under process)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="h-3.5 w-3.5 rounded bg-rose-600 shadow-sm" /> Sold (Registered)
          </span>
        </div>
        <span className="text-right italic">
          Tap any plot block to inspect full details, size & pricing
        </span>
      </div>
    </div>
  );
}

// Phase sector block containing 2 facing rows separated by 30ft road
function PhaseBlock({
  phase,
  phaseNumber,
  plots,
  statusFilter,
  searchQuery,
  onSelect,
}: {
  phase: Phase;
  phaseNumber: number;
  plots: Plot[];
  statusFilter: string;
  searchQuery: string;
  onSelect: (p: Plot) => void;
}) {
  // Split into 2 rows of 8 plots each for a 16-plot phase
  const half = Math.ceil(plots.length / 2);
  const row1 = plots.slice(0, half);
  const row2 = plots.slice(half);

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-card p-4 sm:p-5 shadow-sm">
      {/* Phase header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
              {phaseNumber}
            </span>
            <h3 className="font-display text-base sm:text-lg font-bold text-navy">{phase.name}</h3>
            <Badge variant="outline" className="text-xs">
              {plots.length} Plots
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {phase.description || "Planned residential sector with dedicated access roads"}
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Plots #{plots[0]?.plot_number ?? "?"} — #{plots[plots.length - 1]?.plot_number ?? "?"}
        </div>
      </div>

      {/* Row 1 Plots (Top Row) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-semibold text-foreground">Row A (Facing Internal Road)</span>
          <span>{row1.length} rectangular plots</span>
        </div>

        <PlotRow
          plots={row1}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          onSelect={onSelect}
        />

        {/* 30 FT INTERNAL ROAD */}
        <div className="relative my-3 rounded-lg bg-slate-800 text-slate-100 py-2.5 px-4 shadow-inner flex items-center justify-between overflow-hidden border border-slate-700">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-yellow-400/70" />
          <span className="relative z-10 flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase bg-slate-800/90 px-2 py-0.5 rounded text-amber-300">
            🛣️ 30 FT INTERNAL ROAD · SECTOR {phaseNumber}
          </span>
          <span className="relative z-10 hidden sm:inline-block text-[10px] text-slate-300 font-mono bg-slate-800/90 px-2 py-0.5 rounded">
            Avenue Plantation & Street Lighting
          </span>
        </div>

        {/* Row 2 Plots (Bottom Row) */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-semibold text-foreground">Row B (Facing Internal Road)</span>
          <span>{row2.length} rectangular plots</span>
        </div>

        <PlotRow
          plots={row2}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

// Row of rectangular plot blocks (responsive grid of 8 columns on desktop, 4 on tablet, 2-4 on mobile)
function PlotRow({
  plots,
  statusFilter,
  searchQuery,
  onSelect,
}: {
  plots: Plot[];
  statusFilter: string;
  searchQuery: string;
  onSelect: (p: Plot) => void;
}) {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-2.5">
      {plots.map((p) => {
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        const matchesSearch =
          !searchQuery.trim() ||
          String(p.plot_number).includes(searchQuery.trim()) ||
          p.status.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          p.facing.toLowerCase().includes(searchQuery.trim().toLowerCase());

        const isDimmed = !matchesStatus || !matchesSearch;

        return (
          <PlotBlock
            key={p.id}
            plot={p}
            isDimmed={isDimmed}
            isHighlighted={!!searchQuery.trim() && matchesSearch}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

// Individual Rectangular Plot Block
function PlotBlock({
  plot,
  isDimmed,
  isHighlighted,
  onSelect,
}: {
  plot: Plot;
  isDimmed: boolean;
  isHighlighted: boolean;
  onSelect: (p: Plot) => void;
}) {
  const style = plotStatusStyles[plot.status];

  return (
    <button
      type="button"
      onClick={() => onSelect(plot)}
      aria-label={`Plot ${plot.plot_number}, ${plot.status}, ${plot.size_sqyd} square yards, price ${plot.total_price}`}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border-2 p-2.5 text-left transition-all duration-200 select-none shadow-sm cursor-pointer",
        "aspect-[4/3] min-h-[92px] sm:min-h-[105px]",
        style.bg,
        style.border,
        style.text,
        "hover:scale-[1.03] hover:shadow-md hover:z-10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isDimmed && "opacity-25 grayscale-[40%] hover:opacity-100 hover:grayscale-0",
        isHighlighted && "ring-4 ring-yellow-400 ring-offset-2 scale-[1.04] z-10",
      )}
      title={`Plot ${plot.plot_number} · ${cap(plot.status)} · ${plot.size_sqyd} sq.yd · Total: ${inr(Number(plot.total_price ?? 0))}`}
    >
      {/* Top Header: Plot Number and Facing Badge */}
      <div className="flex items-start justify-between w-full gap-1">
        <span className="font-extrabold text-base sm:text-lg tracking-tight font-display drop-shadow-sm">
          #{plot.plot_number}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-black/10 shrink-0",
            style.badgeBg,
          )}
          title={`Facing ${cap(plot.facing)}`}
        >
          {plot.facing[0]?.toUpperCase()}
        </span>
      </div>

      {/* Middle: Size in square yards */}
      <div className="my-auto text-center w-full">
        <div className="text-xs sm:text-sm font-extrabold tracking-tight">
          {Number(plot.size_sqyd)}{" "}
          <span className="text-[10px] sm:text-xs font-semibold opacity-90">sq.yd</span>
        </div>
        <div className={cn("text-[11px] sm:text-xs font-semibold mt-0.5", style.subText)}>
          {formatCompactPrice(plot.total_price)}
        </div>
      </div>

      {/* Bottom Footer: Status Label */}
      <div className="flex items-center justify-between w-full pt-1 border-t border-black/10 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
        <span>{style.label}</span>
        <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

// Modern Compass Rose for architectural alignment
function CompassRose() {
  return (
    <div
      className="grid h-14 w-14 sm:h-16 sm:w-16 grid-cols-3 grid-rows-3 place-items-center rounded-full border-2 border-slate-300 bg-card/95 text-[10px] font-extrabold text-navy shadow-md backdrop-blur select-none"
      aria-label="Compass: North Up"
    >
      <span className="col-start-2 text-primary font-black">N</span>
      <span className="col-start-1 row-start-2 text-muted-foreground">W</span>
      <span className="col-start-2 row-start-2 text-accent text-xs">✦</span>
      <span className="col-start-3 row-start-2 text-muted-foreground">E</span>
      <span className="col-start-2 row-start-3 text-muted-foreground">S</span>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, MapPin, LayoutGrid, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/site/SiteChrome";
import { PlotLayout } from "@/components/site/PlotLayout";
import { PlotDetailDialog } from "@/components/site/PlotDetail";
import { PlotMap } from "@/components/site/PlotMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { phasesQuery, plotsQuery, type Plot } from "@/lib/data";

export const Route = createFileRoute("/layout")({
  head: () => ({
    meta: [
      { title: "Interactive Plot Layout — Sawargseema Ventures" },
      {
        name: "description",
        content:
          "Colour-coded layout of all 48 plots: available (green), reserved (orange) and sold (red).",
      },
      { property: "og:title", content: "Interactive Plot Layout — Sawargseema Ventures" },
      {
        property: "og:description",
        content: "Tap any plot to see size, price, phase, facing, and availability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LayoutPage,
});

function LayoutPage() {
  const { user, isAdmin, loading } = useAuth();
  const { data: plots = [] } = useQuery(plotsQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const [openPlot, setOpenPlot] = useState<Plot | null>(null);
  const [activeView, setActiveView] = useState<"layout" | "satellite">("layout");

  // Keep dialog plot in sync with fresh query data after admin edits
  const currentOpenPlot = openPlot ? (plots.find((p) => p.id === openPlot.id) ?? openPlot) : null;

  return (
    <>
      <PageHeader
        title="Interactive Plot Layout"
        sub="Green = Available, Orange = Reserved, Red = Sold. Tap any rectangular plot block to view size, price, and details."
      />

      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* VIEW SELECTOR & USER STATUS BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={activeView === "layout" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView("layout")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Visual Layout (48 Plots)
            </Button>
            <Button
              variant={activeView === "satellite" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveView("satellite")}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              Satellite Map View
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Badge className="bg-primary text-primary-foreground gap-1.5 py-1 px-3">
                <Shield className="h-3.5 w-3.5" /> Admin: Click any plot to edit
              </Badge>
            ) : user ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Signed in — you can request plot reservations directly
              </span>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Want to reserve or manage plots?</span>
                <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                  <Link to="/auth">Sign In / Register</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* MAIN VISUAL LAYOUT OR SATELLITE MAP */}
        {activeView === "layout" ? (
          <PlotLayout plots={plots} phases={phases} onSelect={setOpenPlot} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-muted bg-muted/40 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm mb-1">
                Geographic Satellite Coordinate View
              </p>
              <p>
                This view displays Google Maps satellite pins for plots with surveyed GPS
                coordinates on file. For the 48-plot master plan layout and live availability,
                switch to the <b>Visual Layout</b> tab above.
              </p>
            </div>
            <PlotMap plots={plots} onSelect={setOpenPlot} />
          </div>
        )}
      </div>

      {/* PLOT DETAIL & ADMIN EDIT DIALOG */}
      <PlotDetailDialog plot={currentOpenPlot} onClose={() => setOpenPlot(null)} />
    </>
  );
}

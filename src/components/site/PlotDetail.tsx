import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Compass, Pencil, Shield, Check, X, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasCoordinates, missingPlotDetails } from "@/lib/plot-information";
import {
  cap,
  FACINGS,
  inr,
  num,
  phasesQuery,
  STATUSES,
  type Plot,
  type PlotFacing,
  type PlotStatus,
} from "@/lib/data";

export const statusBadge: Record<string, string> = {
  available: "bg-emerald-600 text-white hover:bg-emerald-700",
  reserved: "bg-amber-500 text-slate-950 font-semibold hover:bg-amber-600",
  sold: "bg-rose-600 text-white hover:bg-rose-700",
};

export function PlotDetailDialog({ plot, onClose }: { plot: Plot | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: phases = [] } = useQuery(phasesQuery);
  const { user, isAdmin } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    plot_number: "",
    phase_id: "",
    size_sqyd: "",
    price_per_sqyd: "",
    facing: "east" as PlotFacing,
    status: "available" as PlotStatus,
    dimensions: "",
    location_note: "",
    amenities: "",
  });

  useEffect(() => {
    if (plot) {
      setForm({
        plot_number: String(plot.plot_number),
        phase_id: plot.phase_id ?? "",
        size_sqyd: String(plot.size_sqyd),
        price_per_sqyd: String(plot.price_per_sqyd),
        facing: plot.facing,
        status: plot.status,
        dimensions: plot.dimensions ?? "",
        location_note: plot.location_note ?? "",
        amenities: plot.amenities ?? "",
      });
      setIsEditing(false);
      setMsg("");
    }
  }, [plot]);

  if (!plot) return null;

  const phase = phases.find((p) => p.id === (isEditing ? form.phase_id : plot.phase_id));

  // Quick status update for admin
  const quickUpdateStatus = async (newStatus: PlotStatus) => {
    if (!plot) return;
    setBusy(true);
    const { error } = await supabase.from("plots").update({ status: newStatus }).eq("id", plot.id);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Plot ${plot.plot_number} status updated to ${cap(newStatus)}`);
    setForm((prev) => ({ ...prev, status: newStatus }));
    qc.invalidateQueries({ queryKey: ["plots"] });
  };

  // Full admin edit save
  const savePlotDetails = async () => {
    if (!plot) return;
    const n = Number(form.plot_number);
    const sz = Number(form.size_sqyd);
    const pr = Number(form.price_per_sqyd);

    if (!Number.isInteger(n) || n <= 0) {
      return void toast.error("Plot number must be a positive whole number");
    }
    if (!(sz > 0)) {
      return void toast.error("Size must be greater than 0");
    }
    if (!(pr >= 0) || form.price_per_sqyd === "") {
      return void toast.error("Enter a valid price per square yard");
    }

    setBusy(true);
    const { error } = await supabase
      .from("plots")
      .update({
        plot_number: n,
        phase_id: form.phase_id || null,
        size_sqyd: sz,
        price_per_sqyd: pr,
        facing: form.facing,
        status: form.status,
        dimensions: form.dimensions.trim(),
        location_note: form.location_note.trim(),
        amenities: form.amenities.trim(),
      })
      .eq("id", plot.id);
    setBusy(false);

    if (error) {
      return void toast.error(
        error.message.includes("duplicate") ? "Plot number already exists" : error.message,
      );
    }

    toast.success(`Plot ${n} details saved to database`);
    setIsEditing(false);
    qc.invalidateQueries({ queryKey: ["plots"] });
    qc.invalidateQueries({ queryKey: ["plot-history"] });
  };

  const book = async () => {
    if (!plot || !user) return;
    setBusy(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, mobile")
      .eq("id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("enquiries").insert({
      user_id: user.id,
      name: prof?.full_name || "Customer",
      mobile: prof?.mobile || "",
      plot_id: plot.id,
      kind: "booking",
      message: msg.slice(0, 1000),
    });
    setBusy(false);

    if (error) {
      return void toast.error("Could not send request. Please check your profile mobile number.");
    }
    toast.success("Reservation request sent. Our representative will contact you.");
    setMsg("");
    onClose();
  };

  const calculatedTotal = (Number(form.size_sqyd) || 0) * (Number(form.price_per_sqyd) || 0);

  return (
    <Dialog open={!!plot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-3 font-display text-2xl">
              Plot {plot.plot_number}
              <Badge className={statusBadge[plot.status]}>{cap(plot.status)}</Badge>
            </DialogTitle>
            {isAdmin && !isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* ADMIN QUICK STATUS BAR */}
        {isAdmin && !isEditing && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Shield className="h-3.5 w-3.5" /> Admin Quick Status:
              </span>
              <div className="flex gap-1.5">
                {(["available", "reserved", "sold"] as const).map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => quickUpdateStatus(s)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold capitalize transition ${
                      plot.status === s
                        ? s === "available"
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-600 ring-offset-1"
                          : s === "reserved"
                            ? "bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-500 ring-offset-1"
                            : "bg-rose-600 text-white ring-2 ring-rose-600 ring-offset-1"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODE (ADMIN ONLY) */}
        {isEditing ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                <Pencil className="h-4 w-4" /> Edit Plot {plot.plot_number} Details
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plot Number</Label>
                <Input
                  type="number"
                  value={form.plot_number}
                  onChange={(e) => setForm({ ...form, plot_number: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Phase</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.phase_id}
                  onChange={(e) => setForm({ ...form, phase_id: e.target.value })}
                >
                  <option value="">None</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Status</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as PlotStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {cap(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Facing</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.facing}
                  onChange={(e) => setForm({ ...form, facing: e.target.value as PlotFacing })}
                >
                  {FACINGS.map((f) => (
                    <option key={f} value={f}>
                      {cap(f)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Size (sq.yd)</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.size_sqyd}
                  onChange={(e) => setForm({ ...form, size_sqyd: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Price per sq.yd (₹)</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.price_per_sqyd}
                  onChange={(e) => setForm({ ...form, price_per_sqyd: e.target.value })}
                />
              </div>

              <div className="col-span-2 rounded-lg bg-muted/60 p-2.5 text-xs">
                <span className="text-muted-foreground">Calculated Total Price:</span>{" "}
                <span className="font-bold text-primary">{inr(calculatedTotal)}</span>
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Dimensions</Label>
                <Input
                  placeholder="e.g. 30 x 50 ft"
                  value={form.dimensions}
                  onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Location Description</Label>
                <Input
                  placeholder="e.g. Row 1, 30 ft internal road"
                  value={form.location_note}
                  onChange={(e) => setForm({ ...form, location_note: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Amenities & Highlights</Label>
                <Textarea
                  rows={2}
                  value={form.amenities}
                  onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gap-1.5" onClick={savePlotDetails} disabled={busy}>
                <Check className="h-4 w-4" /> Save to Database
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={busy}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* VIEW MODE */
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Row k="Phase" v={phase?.name ?? "—"} />
              <Row
                k="Facing"
                v={
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Compass className="h-4 w-4 text-accent" />
                    {cap(plot.facing)}
                  </span>
                }
              />
              <Row
                k="Plot Size"
                v={<span className="font-semibold">{num(Number(plot.size_sqyd))} sq.yd</span>}
              />
              <Row k="Dimensions" v={plot.dimensions || "Not specified"} />
              <Row
                k="Price / sq.yd"
                v={
                  Number(plot.price_per_sqyd) > 0
                    ? inr(Number(plot.price_per_sqyd))
                    : "Not provided"
                }
              />
              <Row
                k="Total Price"
                v={
                  <span className="font-extrabold text-base text-primary">
                    {plot.total_price !== null && Number(plot.price_per_sqyd) > 0
                      ? inr(Number(plot.total_price))
                      : "Not provided"}
                  </span>
                }
              />
              <div className="col-span-2">
                <Row k="Location" v={plot.location_note || "Standard sector row"} />
              </div>
              <div className="col-span-2">
                <Row
                  k="Amenities & Infrastructure"
                  v={
                    plot.amenities ||
                    "30 ft BT road, underground drainage, electricity, avenue plantation"
                  }
                />
              </div>
              <Row
                k="Survey Coordinates"
                v={
                  hasCoordinates(plot)
                    ? `${plot.latitude}, ${plot.longitude}`
                    : "Sample layout (not surveyed)"
                }
              />
              <Row
                k="Information"
                v={plot.information_verified ? "Admin-verified" : "Sample data"}
              />
            </dl>

            {missingPlotDetails(plot).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Note: Coordinates and final surveyed boundary will be provided at registration.
              </p>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" /> Full Cost & Tax Breakdown
                </span>
                <span className="text-[11px] text-muted-foreground">Stamp duty, Reg & Dev fees</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full text-xs gap-1.5 h-8">
                <Link to="/calculator">
                  Calculate All Statutory Fees & Additional Costs
                </Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Prices exclude registration charges, stamp duty, and applicable taxes. Sample
              demonstration layout — confirm exact site plan at the venture office.
            </p>

            {/* RESERVATION FORM (AVAILABLE PLOTS) */}
            {plot.status === "available" && (
              <div className="space-y-3 border-t pt-3">
                {user ? (
                  <>
                    <p className="text-xs font-semibold text-foreground">
                      Interested in Plot {plot.plot_number}?
                    </p>
                    <Textarea
                      placeholder="Add an optional message or preferred site visit date..."
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      maxLength={1000}
                    />
                    <Button className="w-full" onClick={book} disabled={busy}>
                      Request Plot Reservation
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border bg-muted/40 p-3 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Sign in with your mobile number to request a reservation or book a site visit
                      for Plot {plot.plot_number}.
                    </p>
                    <Button asChild size="sm" className="w-full">
                      <Link to="/auth">Sign In to Reserve</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}

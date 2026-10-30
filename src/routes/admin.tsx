import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2, Calculator, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  parseVentureCostConfig,
  serializeVentureAbout,
  getVentureAboutText,
  validateRateConfig,
  type CostRateConfig,
} from "@/lib/cost-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoginRequired, PageHeader } from "@/components/site/SiteChrome";
import { Charts, StatCards } from "@/components/site/Stats";
import { statusBadge } from "@/components/site/PlotDetail";
import { PlotHistory } from "@/components/site/PlotHistory";
import { hasCoordinates, missingPlotDetails } from "@/lib/plot-information";
import { OwnershipWorkspace } from "@/components/site/OwnershipWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  cap,
  FACINGS,
  inr,
  phasesQuery,
  plotsQuery,
  STATUSES,
  ventureQuery,
  type Plot,
  type PlotFacing,
  type PlotStatus,
} from "@/lib/data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Sawargseema Ventures" },
      { name: "description", content: "Manage plots, phases, enquiries and venture details." },
      { property: "og:title", content: "Admin Panel — Sawargseema Ventures" },
      { property: "og:description", content: "Venture administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function downloadCsv(name: string, rows: object[]) {
  if (!rows.length) return void toast.info("Nothing to export");
  const keys = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => esc((r as Record<string, unknown>)[k])).join(",")),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}

function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const { data: plots = [] } = useQuery(plotsQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const { data: v } = useQuery(ventureQuery);

  if (loading) return null;
  if (!user)
    return (
      <div className="py-12">
        <LoginRequired what="the admin panel" />
      </div>
    );
  if (!isAdmin)
    return <p className="py-20 text-center text-muted-foreground">You don't have admin access.</p>;

  return (
    <>
      <PageHeader title="Admin Panel" sub="All changes save instantly and update the website." />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="dashboard">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="plots">Plots</TabsTrigger>
            <TabsTrigger value="history">Plot history</TabsTrigger>
            <TabsTrigger value="phases">Phases</TabsTrigger>
            <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="venture">Venture details</TabsTrigger>
            <TabsTrigger value="cost-config">Cost Calculator Rates</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <StatCards plots={plots} totalArea={Number(v?.total_area_sqyd ?? 0)} />
            <Charts plots={plots} phases={phases} />
          </TabsContent>
          <TabsContent value="plots" className="mt-6">
            <PlotsAdmin />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <PlotHistory userId={user.id} />
          </TabsContent>
          <TabsContent value="phases" className="mt-6">
            <PhasesAdmin />
          </TabsContent>
          <TabsContent value="enquiries" className="mt-6">
            <EnquiriesAdmin />
          </TabsContent>
          <TabsContent value="customers" className="mt-6">
            <CustomersAdmin />
          </TabsContent>
          <TabsContent value="venture" className="mt-6">
            <VentureAdmin />
          </TabsContent>
          <TabsContent value="cost-config" className="mt-6">
            <CostConfigAdmin />
          </TabsContent>
          <TabsContent value="ownership" className="mt-6">
            <OwnershipWorkspace userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

type PlotForm = {
  id?: string;
  plot_number: string;
  phase_id: string;
  size_sqyd: string;
  price_per_sqyd: string;
  facing: PlotFacing;
  status: PlotStatus;
  dimensions: string;
  location_note: string;
  amenities: string;
  latitude: string;
  longitude: string;
};
const emptyPlot: PlotForm = {
  plot_number: "",
  phase_id: "",
  size_sqyd: "",
  price_per_sqyd: "",
  facing: "east",
  status: "available",
  dimensions: "",
  location_note: "",
  amenities: "",
  latitude: "",
  longitude: "",
};

function PlotsAdmin() {
  const qc = useQueryClient();
  const { data: plots = [] } = useQuery(plotsQuery);
  const { data: phases = [] } = useQuery(phasesQuery);
  const [edit, setEdit] = useState<PlotForm | null>(null);
  const phaseName = (id: string | null) => phases.find((p) => p.id === id)?.name ?? "—";
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plots"] });
    qc.invalidateQueries({ queryKey: ["plot-history"] });
  };

  const save = async () => {
    if (!edit) return;
    const latitude = edit.latitude.trim() === "" ? null : Number(edit.latitude);
    const longitude = edit.longitude.trim() === "" ? null : Number(edit.longitude);
    if ((latitude !== null || longitude !== null) && !hasCoordinates({ latitude, longitude }))
      return void toast.error("Enter both valid latitude and longitude");
    const n = Number(edit.plot_number),
      sz = Number(edit.size_sqyd),
      pr = Number(edit.price_per_sqyd);
    if (!Number.isInteger(n) || n <= 0)
      return void toast.error("Plot number must be a positive whole number");
    if (!(sz > 0)) return void toast.error("Size must be greater than 0");
    if (!(pr >= 0) || edit.price_per_sqyd === "") return void toast.error("Enter a valid price");
    const row = {
      plot_number: n,
      phase_id: edit.phase_id || null,
      size_sqyd: sz,
      price_per_sqyd: pr,
      facing: edit.facing,
      status: edit.status,
      dimensions: edit.dimensions,
      location_note: edit.location_note,
      amenities: edit.amenities,
      latitude,
      longitude,
    };
    const { error } = edit.id
      ? await supabase.from("plots").update(row).eq("id", edit.id)
      : await supabase.from("plots").insert(row);
    if (error)
      return void toast.error(
        error.message.includes("duplicate") ? "Plot number already exists" : error.message,
      );
    toast.success("Plot saved");
    setEdit(null);
    refresh();
  };

  const quickStatus = async (p: Plot, status: PlotStatus) => {
    const { error } = await supabase.from("plots").update({ status }).eq("id", p.id);
    if (error) return void toast.error(error.message);
    refresh();
  };

  const del = async (p: Plot) => {
    if (!confirm(`Delete Plot ${p.plot_number}?`)) return;
    const { error } = await supabase.from("plots").delete().eq("id", p.id);
    if (error) return void toast.error(error.message);
    refresh();
  };

  const exportPlots = () =>
    downloadCsv(
      "plots.csv",
      plots.map((p) => ({
        plot_number: p.plot_number,
        phase: phaseName(p.phase_id),
        size_sqyd: p.size_sqyd,
        price_per_sqyd: p.price_per_sqyd,
        total_price: p.total_price,
        facing: p.facing,
        status: p.status,
        dimensions: p.dimensions,
        location: p.location_note,
        latitude: p.latitude,
        longitude: p.longitude,
        information_verified: p.information_verified,
        sold_at: p.sold_at ?? "",
      })),
    );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button
          onClick={() =>
            setEdit({
              ...emptyPlot,
              plot_number: String((plots.at(-1)?.plot_number ?? 0) + 1),
              phase_id: phases[0]?.id ?? "",
            })
          }
        >
          <Plus className="h-4 w-4" /> Add plot
        </Button>
        <Button variant="outline" onClick={exportPlots}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plot</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>₹/sq.yd</TableHead>
              <TableHead>Information</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Facing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plots.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold">{p.plot_number}</TableCell>
                <TableCell>{phaseName(p.phase_id)}</TableCell>
                <TableCell>{Number(p.size_sqyd)}</TableCell>
                <TableCell>{inr(Number(p.price_per_sqyd))}</TableCell>
                <TableCell>
                  {p.information_verified ? "Admin-verified" : "Unverified"}
                  {missingPlotDetails(p).length > 0 && (
                    <p className="text-xs text-destructive">
                      Missing: {missingPlotDetails(p).join(", ")}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {p.total_price !== null && Number(p.price_per_sqyd) > 0
                    ? inr(Number(p.total_price))
                    : "Not provided"}
                </TableCell>
                <TableCell>{cap(p.facing)}</TableCell>
                <TableCell>
                  <select
                    className="h-8 rounded-md border bg-background px-1 text-xs"
                    value={p.status}
                    onChange={(e) => quickStatus(p, e.target.value as PlotStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {cap(s)}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        id: p.id,
                        plot_number: String(p.plot_number),
                        phase_id: p.phase_id ?? "",
                        size_sqyd: String(p.size_sqyd),
                        price_per_sqyd: String(p.price_per_sqyd),
                        facing: p.facing,
                        status: p.status,
                        dimensions: p.dimensions,
                        location_note: p.location_note,
                        amenities: p.amenities,
                        latitude: p.latitude === null ? "" : String(p.latitude),
                        longitude: p.longitude === null ? "" : String(p.longitude),
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={p.information_verified || missingPlotDetails(p).length > 0}
                    onClick={async () => {
                      if (
                        !confirm(
                          `Confirm you have checked all details for Plot ${p.plot_number}? This is not ownership document approval.`,
                        )
                      )
                        return;
                      const { error } = await supabase
                        .from("plots")
                        .update({ information_verified: true })
                        .eq("id", p.id);
                      if (error) return void toast.error(error.message);
                      toast.success("Plot information verified");
                      refresh();
                    }}
                  >
                    Verify details
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit plot" : "Add plot"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plot number</Label>
                <Input
                  type="number"
                  value={edit.plot_number}
                  onChange={(e) => setEdit({ ...edit, plot_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Phase</Label>
                <select
                  className={sel}
                  value={edit.phase_id}
                  onChange={(e) => setEdit({ ...edit, phase_id: e.target.value })}
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
                <Label>Size (sq.yd)</Label>
                <Input
                  type="number"
                  value={edit.size_sqyd}
                  onChange={(e) => setEdit({ ...edit, size_sqyd: e.target.value })}
                />
              </div>
              <div>
                <Label>Price per sq.yd (₹)</Label>
                <Input
                  type="number"
                  value={edit.price_per_sqyd}
                  onChange={(e) => setEdit({ ...edit, price_per_sqyd: e.target.value })}
                />
              </div>
              <div>
                <Label>Facing</Label>
                <select
                  className={sel}
                  value={edit.facing}
                  onChange={(e) => setEdit({ ...edit, facing: e.target.value as PlotFacing })}
                >
                  {FACINGS.map((f) => (
                    <option key={f} value={f}>
                      {cap(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className={sel}
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value as PlotStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {cap(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Label>Dimensions</Label>
                <Input
                  value={edit.dimensions}
                  onChange={(e) => setEdit({ ...edit, dimensions: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Location</Label>
                <Input
                  value={edit.location_note}
                  onChange={(e) => setEdit({ ...edit, location_note: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="plot-latitude">Latitude</Label>
                <Input
                  id="plot-latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={edit.latitude}
                  onChange={(e) => setEdit({ ...edit, latitude: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="plot-longitude">Longitude</Label>
                <Input
                  id="plot-longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={edit.longitude}
                  onChange={(e) => setEdit({ ...edit, longitude: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Amenities & nearby</Label>
                <Textarea
                  value={edit.amenities}
                  onChange={(e) => setEdit({ ...edit, amenities: e.target.value })}
                />
              </div>
              <p className="col-span-2 text-sm">
                Total:{" "}
                <b>{inr((Number(edit.size_sqyd) || 0) * (Number(edit.price_per_sqyd) || 0))}</b>
              </p>
              <Button className="col-span-2" onClick={save}>
                Save plot
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhasesAdmin() {
  const qc = useQueryClient();
  const { data: phases = [] } = useQuery(phasesQuery);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["phases"] });
    qc.invalidateQueries({ queryKey: ["plots"] });
  };

  const add = async () => {
    if (!name.trim()) return void toast.error("Phase name is required");
    const { error } = await supabase
      .from("phases")
      .insert({ name: name.trim(), description: desc, sort_order: phases.length + 1 });
    if (error) return void toast.error(error.message);
    setName("");
    setDesc("");
    refresh();
  };
  const rename = async (id: string, field: "name" | "description", value: string) => {
    const { error } = await supabase
      .from("phases")
      .update(field === "name" ? { name: value } : { description: value })
      .eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this phase? Its plots will become unassigned.")) return;
    const { error } = await supabase.from("phases").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <Input
          placeholder="Phase name, e.g. Phase 4"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="flex-1"
        />
        <Button onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {phases.map((p) => (
        <div key={p.id} className="flex gap-2 rounded-xl border bg-card p-3">
          <Input
            defaultValue={p.name}
            onBlur={(e) => e.target.value !== p.name && rename(p.id, "name", e.target.value)}
            className="w-40"
          />
          <Input
            defaultValue={p.description}
            onBlur={(e) =>
              e.target.value !== p.description && rename(p.id, "description", e.target.value)
            }
            className="flex-1"
          />
          <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function EnquiriesAdmin() {
  const qc = useQueryClient();
  const { data: plots = [] } = useQuery(plotsQuery);
  const { data = [] } = useQuery({
    queryKey: ["enquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const plotNo = (id: string | null) => plots.find((p) => p.id === id)?.plot_number ?? "—";
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("enquiries").update({ status }).eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["enquiries"] });
  };

  return (
    <div>
      <Button
        variant="outline"
        className="mb-4"
        onClick={() =>
          downloadCsv(
            "enquiries.csv",
            data.map((e) => ({
              date: e.created_at,
              type: e.kind,
              name: e.name,
              mobile: e.mobile,
              plot: plotNo(e.plot_id),
              message: e.message,
              status: e.status,
            })),
          )
        }
      >
        <Download className="h-4 w-4" /> Export CSV
      </Button>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Plot</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No enquiries yet
                </TableCell>
              </TableRow>
            )}
            {data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(e.created_at).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  <Badge variant={e.kind === "booking" ? "default" : "secondary"}>
                    {cap(e.kind)}
                  </Badge>
                </TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.mobile}</TableCell>
                <TableCell>{plotNo(e.plot_id)}</TableCell>
                <TableCell className="max-w-xs truncate">{e.message}</TableCell>
                <TableCell>
                  <select
                    className="h-8 rounded-md border bg-background px-1 text-xs"
                    value={e.status}
                    onChange={(ev) => setStatus(e.id, ev.target.value)}
                  >
                    {["new", "contacted", "closed"].map((s) => (
                      <option key={s} value={s}>
                        {cap(s)}
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CustomersAdmin() {
  const { data = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div>
      <Button variant="outline" className="mb-4" onClick={() => downloadCsv("customers.csv", data)}>
        <Download className="h-4 w-4" /> Export CSV
      </Button>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name}</TableCell>
                <TableCell>{c.mobile}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{c.address}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleDateString("en-IN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const VENTURE_FIELDS = [
  ["name", "Venture name"],
  ["tagline", "Tagline"],
  ["location", "Location"],
  ["address", "Office address"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp number (with country code)"],
  ["map_embed_url", "Google Maps embed URL"],
  ["total_area_sqyd", "Total venture area (sq.yd)"],
] as const;

function VentureAdmin() {
  const qc = useQueryClient();
  const { data: v } = useQuery(ventureQuery);
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (v) {
      const entries = Object.entries(v).map(([k, val]) => [
        k,
        k === "about" ? getVentureAboutText(String(val ?? "")) : String(val ?? ""),
      ]);
      setF(Object.fromEntries(entries));
    }
  }, [v]);

  const save = async () => {
    const g = (k: string) => f[k] ?? "";
    if (!g("name").trim()) return void toast.error("Venture name is required");
    const currentConfig = parseVentureCostConfig(v?.about);
    const serializedAbout = serializeVentureAbout(g("about"), currentConfig);

    const { error } = await supabase
      .from("venture")
      .update({
        name: g("name").trim(),
        tagline: g("tagline"),
        about: serializedAbout,
        location: g("location"),
        address: g("address"),
        phone: g("phone"),
        email: g("email"),
        whatsapp: g("whatsapp"),
        map_embed_url: g("map_embed_url"),
        total_area_sqyd: Number(g("total_area_sqyd")) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) return void toast.error(error.message);
    toast.success("Venture details updated");
    qc.invalidateQueries({ queryKey: ["venture"] });
  };

  return (
    <div className="grid max-w-3xl gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2">
      {VENTURE_FIELDS.map(([k, label]) => (
        <div key={k} className={k === "address" || k === "map_embed_url" ? "sm:col-span-2" : ""}>
          <Label>{label}</Label>
          <Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      <div className="sm:col-span-2">
        <Label>About</Label>
        <Textarea
          rows={5}
          value={f["about"] ?? ""}
          onChange={(e) => setF({ ...f, about: e.target.value })}
        />
      </div>
      <Button className="sm:col-span-2" onClick={save}>
        Save details
      </Button>
    </div>
  );
}

function CostConfigAdmin() {
  const qc = useQueryClient();
  const { data: v } = useQuery(ventureQuery);
  const { user } = useAuth();
  const [config, setConfig] = useState<CostRateConfig>(() => parseVentureCostConfig(v?.about));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (v?.about) {
      setConfig(parseVentureCostConfig(v.about));
    }
  }, [v?.about]);

  const saveRates = async () => {
    const val = validateRateConfig(config);
    if (!val.valid) {
      return void toast.error(val.errors[0] || "Invalid rate values");
    }

    setBusy(true);
    const updated: CostRateConfig = {
      ...config,
      rates_verified_at: config.rates_verified
        ? config.rates_verified_at ?? new Date().toISOString()
        : null,
      rates_verified_by: config.rates_verified_by.trim() || (user?.email ?? "Administrator"),
    };

    const currentAbout = getVentureAboutText(v?.about);
    const serialized = serializeVentureAbout(currentAbout, updated);

    const { error } = await supabase
      .from("venture")
      .update({
        about: serialized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setBusy(false);
    if (error) {
      return void toast.error(error.message);
    }

    toast.success("Cost calculator rates saved and verified in database");
    qc.invalidateQueries({ queryKey: ["venture"] });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-navy flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Cost Calculator Rate Configuration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage statutory government rates, development fees, and maintenance corpus. Saved
              directly in the venture database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={
                config.rates_verified
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-slate-950 font-bold"
              }
            >
              {config.rates_verified ? "Rates Verified" : "Pending Verification"}
            </Badge>
          </div>
        </div>

        {/* 1. STATUTORY GOVERNMENT RATES */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Statutory Government Rates (%)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Stamp Duty (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={config.stamp_duty_percent}
                onChange={(e) =>
                  setConfig({ ...config, stamp_duty_percent: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                Standard Telangana / State stamp duty
              </span>
            </div>

            <div>
              <Label className="text-xs">Registration Fee (%)</Label>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="10"
                value={config.registration_fee_percent}
                onChange={(e) =>
                  setConfig({ ...config, registration_fee_percent: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                Sub-Registrar documentation fee
              </span>
            </div>

            <div>
              <Label className="text-xs">Transfer Duty / Local Tax (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={config.transfer_duty_tax_percent}
                onChange={(e) =>
                  setConfig({ ...config, transfer_duty_tax_percent: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                Gram Panchayat / Municipal transfer cess
              </span>
            </div>
          </div>
        </div>

        {/* 2. VENTURE INFRASTRUCTURE & DEVELOPMENT CHARGES */}
        <div className="space-y-4 pt-2 border-t">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" /> Venture Civil & Infrastructure Charges
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Development Charges (₹ / sq.yd)</Label>
              <Input
                type="number"
                step="10"
                min="0"
                value={config.development_charges_per_sqyd}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    development_charges_per_sqyd: Number(e.target.value) || 0,
                  })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                BT roads, underground cabling & drainage
              </span>
            </div>

            <div>
              <Label className="text-xs">Maintenance Corpus (₹ / sq.yd)</Label>
              <Input
                type="number"
                step="5"
                min="0"
                value={config.maintenance_charges_per_sqyd}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maintenance_charges_per_sqyd: Number(e.target.value) || 0,
                  })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                2-year society upkeep & common lighting
              </span>
            </div>

            <div>
              <Label className="text-xs">Legal & Documentation Fee (₹)</Label>
              <Input
                type="number"
                step="500"
                min="0"
                value={config.legal_documentation_fee}
                onChange={(e) =>
                  setConfig({ ...config, legal_documentation_fee: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
              <span className="text-[11px] text-muted-foreground">
                Title search, opinion & sale deed drafting
              </span>
            </div>
          </div>
        </div>

        {/* 3. OPTIONAL & CONDITIONAL PREMIUMS */}
        <div className="space-y-4 pt-2 border-t">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-accent" /> Optional Preferences & Amenities
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Corner Plot Premium (%)</Label>
              <Input
                type="number"
                step="1"
                min="0"
                max="50"
                value={config.corner_plot_premium_percent}
                onChange={(e) =>
                  setConfig({ ...config, corner_plot_premium_percent: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Facing Premium (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={config.facing_premium_percent}
                onChange={(e) =>
                  setConfig({ ...config, facing_premium_percent: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Water Deposit (₹)</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={config.water_electricity_deposit}
                onChange={(e) =>
                  setConfig({ ...config, water_electricity_deposit: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Clubhouse Fee (₹)</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={config.clubhouse_amenity_fee}
                onChange={(e) =>
                  setConfig({ ...config, clubhouse_amenity_fee: Number(e.target.value) || 0 })
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* 4. VERIFICATION AUDIT CONTROLS */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" /> Admin Verification & Audit Attestation
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Verifying Officer / Team Name</Label>
              <Input
                value={config.rates_verified_by}
                onChange={(e) => setConfig({ ...config, rates_verified_by: e.target.value })}
                className="mt-1"
                placeholder="e.g. Accounts & Legal Officer"
              />
            </div>

            <div>
              <Label className="text-xs">Schedule Audit Notes</Label>
              <Input
                value={config.notes ?? ""}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                className="mt-1"
                placeholder="e.g. Verified against prevailing Sub-Registrar guideline value"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="verify-rates-checkbox"
              checked={config.rates_verified}
              onChange={(e) =>
                setConfig({
                  ...config,
                  rates_verified: e.target.checked,
                  rates_verified_at: e.target.checked ? new Date().toISOString() : null,
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="verify-rates-checkbox" className="text-xs font-semibold cursor-pointer">
              Officially certify these rates as audited and verified for customer quotation
              calculations
            </Label>
          </div>

          {config.rates_verified_at && (
            <p className="text-[11px] text-muted-foreground">
              Last verified on {new Date(config.rates_verified_at).toLocaleString("en-IN")} by{" "}
              {config.rates_verified_by}
            </p>
          )}
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={saveRates} disabled={busy} className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Save & Verify Rates in Database
          </Button>
        </div>
      </div>
    </div>
  );
}

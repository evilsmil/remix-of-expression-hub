import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFebStore } from "@/store/feb-store";
import { isLate } from "@/types/feb";
import { KpiCard } from "@/components/dashboard/KpiCard";

const STATUS_COLORS = [
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

export default function ValidateurDashboard() {
  const febs = useFebStore((s) => s.febs);
  const user = useFebStore((s) => s.getCurrentUser());

  const total = febs.length;
  const enCours = febs.filter((f) => f.status.startsWith("en_attente")).length;
  const validees = febs.filter((f) => f.status === "validee").length;
  const refusees = febs.filter((f) => f.status === "rejetee").length;
  const lateCount = febs.filter(isLate).length;

  // Charts data
  const byDept = Object.entries(
    febs.reduce<Record<string, number>>((acc, f) => {
      acc[f.departement] = (acc[f.departement] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({
      name: name.length > 16 ? name.slice(0, 14) + "…" : name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const byStatus = Object.entries(
    febs.reduce<Record<string, number>>((acc, f) => {
      const k = f.status.startsWith("en_attente")
        ? "En cours"
        : f.status === "validee"
        ? "Validée"
        : f.status === "rejetee"
        ? "Rejetée"
        : "Brouillon";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // 14-day trend
  const trend = Array.from({ length: 14 }).map((_, i) => {
    const day = startOfDay(subDays(new Date(), 13 - i));
    const dayMs = day.getTime();
    const nextMs = dayMs + 24 * 3600 * 1000;
    const count = febs.filter((f) => {
      const t = new Date(f.createdAt).getTime();
      return t >= dayMs && t < nextMs;
    }).length;
    return { date: format(day, "dd/MM", { locale: fr }), count };
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {format(new Date(), "EEEE dd MMMM", { locale: fr })}
          </p>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            Bonjour {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de l'activité FEB.
          </p>
        </div>
        <Link
          to="/febs/nouveau"
          className="inline-flex items-center gap-1.5 bg-foreground text-background px-3.5 py-2 rounded-md font-medium text-xs hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouvelle FEB
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={total} accent="neutral" />
        <KpiCard label="En cours" value={enCours} accent="warning" />
        <KpiCard label="Validées" value={validees} accent="success" />
        <KpiCard label="Refusés" value={refusees} accent="destructive" />
        <KpiCard label="En attente" value={lateCount} accent="destructive" />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-1">
          Activité — 14 derniers jours
        </h3>
        <p className="text-xs text-muted-foreground mb-4">FEB créées par jour</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              dot={{ r: 2.5, fill: "hsl(var(--foreground))" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-4">FEB par département</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={byDept}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--foreground))" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Statuts</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {byStatus.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{s.name}</span>
                </div>
                <span className="tabular-nums text-foreground font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

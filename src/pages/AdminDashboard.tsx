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
  Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Users, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useFebStore } from "@/store/feb-store";
import { useAuthStore } from "@/store/auth-store";
import {
  isLate,
  averageValidationDays,
  ROLE_LABELS,
  STATUS_LABELS,
  type Role,
} from "@/types/feb";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LateAlerts } from "@/components/dashboard/LateAlerts";

const STATUS_COLORS: Record<string, string> = {
  "Brouillon": "hsl(var(--muted-foreground))",
  "En cours": "hsl(var(--warning))",
  "Validée": "hsl(var(--success))",
  "Rejetée": "hsl(var(--destructive))",
};

export default function AdminDashboard() {
  const febs = useFebStore((s) => s.febs);
  const user = useFebStore((s) => s.getCurrentUser());
  const authUser = useAuthStore((s) => s.user);
  const registeredUsers = useAuthStore((s) => s.registeredUsers);
  const fetchUsers = useAuthStore((s) => s.fetchUsers);

  useEffect(() => {
    if (authUser?.role === "admin" || authUser?.role === "super_admin") {
      void fetchUsers();
    }
  }, [authUser?.role, fetchUsers]);

  const total = febs.length;
  const enCours = febs.filter((f) => f.status.startsWith("en_attente")).length;
  const brouillons = febs.filter((f) => f.status === "brouillon").length;
  const validees = febs.filter((f) => f.status === "validee").length;
  const rejetees = febs.filter((f) => f.status === "rejetee").length;
  const lateCount = febs.filter(isLate).length;
  const avgDays = averageValidationDays(febs);
  const totalBudget = febs.reduce((acc, f) => acc + (f.totalEstime || 0), 0);
  const actualSpend = febs.reduce((acc, f) => acc + (f.actualSpend || 0), 0);

  // Users by role
  const usersByRole = registeredUsers.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const roleRows = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
    role: r,
    label: ROLE_LABELS[r],
    count: usersByRole[r] || 0,
  }));

  // FEB by department
  const byDept = Object.entries(
    febs.reduce<Record<string, number>>((acc, f) => {
      acc[f.departement] = (acc[f.departement] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({
      name: name.length > 18 ? name.slice(0, 16) + "…" : name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // FEB status distribution
  const byStatus = Object.entries(
    febs.reduce<Record<string, number>>((acc, f) => {
      const k = f.status === "brouillon"
        ? "Brouillon"
        : f.status.startsWith("en_attente")
        ? "En cours"
        : f.status === "validee"
        ? "Validée"
        : "Rejetée";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // 30-day trend: created vs validated
  const trend = Array.from({ length: 30 }).map((_, i) => {
    const day = startOfDay(subDays(new Date(), 29 - i));
    const dayMs = day.getTime();
    const nextMs = dayMs + 24 * 3600 * 1000;
    const created = febs.filter((f) => {
      const t = new Date(f.createdAt).getTime();
      return t >= dayMs && t < nextMs;
    }).length;
    const validated = febs.filter((f) => {
      if (f.status !== "validee" || f.validations.length === 0) return false;
      const t = new Date(f.validations[f.validations.length - 1].date).getTime();
      return t >= dayMs && t < nextMs;
    }).length;
    return { date: format(day, "dd/MM", { locale: fr }), created, validated };
  });

  // Top demandeurs
  const topDemandeurs = Object.entries(
    febs.reduce<Record<string, number>>((acc, f) => {
      acc[f.demandeurName] = (acc[f.demandeurName] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " XAF";

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Console administrateur ·{" "}
            {format(new Date(), "EEEE dd MMMM yyyy", { locale: fr })}
          </p>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            Vue globale — {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Activité de la plateforme, utilisateurs, budgets et performance des validations.
          </p>
        </div>
        <Link
          to="/administration"
          className="inline-flex items-center gap-1.5 bg-foreground text-background px-3.5 py-2 rounded-md font-medium text-xs hover:bg-foreground/90 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          Administration
        </Link>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
        <KpiCard label="FEB total" value={total} accent="neutral" icon={FileText} />
        <KpiCard label="En cours" value={enCours} accent="warning" icon={Clock} />
        <KpiCard label="Validées" value={validees} accent="success" icon={CheckCircle2} />
        <KpiCard label="Rejetées" value={rejetees} accent="destructive" icon={XCircle} />
        <KpiCard label="En retard" value={lateCount} accent="destructive" icon={AlertTriangle} />
        <KpiCard label="Brouillons" value={brouillons} accent="neutral" />
        <KpiCard label="Délai moyen" value={`${avgDays} j`} accent="neutral" icon={TrendingUp} />
        <KpiCard label="Utilisateurs" value={registeredUsers.length} accent="neutral" icon={Users} />
      </div>

      {/* Budget cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Budget estimé total
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">{fmtMoney(totalBudget)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Dépense réelle cumulée
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">{fmtMoney(actualSpend)}</p>
        </div>
      </div>

      <LateAlerts febs={febs} limit={5} />

      {/* Trend */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-1">
          Activité — 30 derniers jours
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          FEB créées vs FEB validées par jour
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              name="Créées"
              dataKey="created"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              name="Validées"
              dataKey="validated"
              stroke="hsl(var(--success))"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two columns: by dept + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground mb-4">FEB par département</h3>
          <ResponsiveContainer width="100%" height={280}>
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
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--foreground))"
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Répartition des statuts</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {byStatus.map((s) => (
                  <Cell
                    key={s.name}
                    fill={STATUS_COLORS[s.name] || "hsl(var(--muted-foreground))"}
                  />
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
            {byStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ background: STATUS_COLORS[s.name] }}
                  />
                  <span className="text-muted-foreground">{s.name}</span>
                </div>
                <span className="tabular-nums text-foreground font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users by role + Top demandeurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Utilisateurs par rôle</h3>
          <div className="divide-y divide-border/60">
            {roleRows.map((r) => (
              <div
                key={r.role}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular-nums font-medium">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">
            Top demandeurs (FEB créées)
          </h3>
          {topDemandeurs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune donnée pour le moment.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {topDemandeurs.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-foreground truncate">{d.name}</span>
                  <span className="tabular-nums font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">FEB récentes</h3>
        <div className="divide-y divide-border/60">
          {[...febs]
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
            .slice(0, 8)
            .map((f) => (
              <Link
                key={f.id}
                to={`/febs/${f.id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:bg-muted/40 rounded px-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{f.natureBesoin}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f.numero} · {f.demandeurName} · {f.departement}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground ml-3">
                  {STATUS_LABELS[f.status]}
                </span>
              </Link>
            ))}
          {febs.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              Aucune FEB pour le moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

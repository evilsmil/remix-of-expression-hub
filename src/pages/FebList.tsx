import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useDepartmentsStore } from "@/store/departments-store";
import { useFebStore, formatXAF } from "@/store/feb-store";
import { FebStatus, STATUS_LABELS } from "@/types/feb";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, Plus, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUSES: ("all" | FebStatus)[] = [
  "all",
  "brouillon",
  "en_attente_technique",
  "en_attente_pole",
  "en_attente_rpaf",
  "en_attente_reception",
  "validee",
  "rejetee",
];

export default function FebList() {
  const febs = useFebStore((s) => s.febs);
  const departments = useDepartmentsStore((s) => s.getDepartmentNames());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dept, setDept] = useState<string>("all");

  const filtered = useMemo(() => {
    return febs
      .filter((f) => (status === "all" ? true : f.status === status))
      .filter((f) => (dept === "all" ? true : f.departement === dept))
      .filter((f) => {
        if (!q) return true;
        const hay = `${f.numero} ${f.natureBesoin} ${f.fournisseurPotentiel} ${f.demandeurName}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [febs, q, status, dept]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fiches FEB</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} fiche(s) affichée(s) sur {febs.length}</p>
        </div>
        <Link
          to="/febs/nouveau"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-primary-glow transition-colors shadow-[var(--shadow-md)]"
        >
          <Plus className="w-4 h-4" />
          Nouvelle FEB
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro, nature, fournisseur..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-56 bg-card">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "Tous les statuts" : STATUS_LABELS[s as FebStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full md:w-64 bg-card">
            <SelectValue placeholder="Département" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les départements</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Numéro</th>
                <th className="px-4 py-3 font-semibold">Nature</th>
                <th className="px-4 py-3 font-semibold">Département</th>
                <th className="px-4 py-3 font-semibold">Demandeur</th>
                <th className="px-4 py-3 font-semibold text-right">Montant</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">MAJ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/febs/${f.id}`} className="font-mono text-xs font-medium text-info hover:underline">
                      {f.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/febs/${f.id}`} className="font-medium text-foreground hover:text-info truncate block">
                      {f.natureBesoin}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{f.departement}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.demandeurName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{formatXAF(f.totalEstime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(f.updatedAt), "dd MMM yyyy", { locale: fr })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Aucune FEB ne correspond à ces critères.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

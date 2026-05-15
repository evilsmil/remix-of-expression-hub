import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, FileText, History, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { DateRange } from "react-day-picker";
import { useDepartmentsStore } from "@/store/departments-store";
import { useFebStore, formatXAF } from "@/store/feb-store";
import { isValidatorRole, FebStatus, STATUS_LABELS, RECEIVED_VIA_LABELS, ROLE_LABELS } from "@/types/feb";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter, inRange } from "@/components/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function Historique() {
  const allFebs = useFebStore((s) => s.febs);
  const user = useFebStore((s) => s.getCurrentUser());
  const departments = useDepartmentsStore((s) => s.getDepartmentNames());
  const isValidator = isValidatorRole(user.role);

  // Demandeur sees only their own FEB; validateurs see everything.
  const scoped = useMemo(
    () => (isValidator ? allFebs : allFebs.filter((f) => f.demandeurId === user.id)),
    [allFebs, isValidator, user.id]
  );

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [dept, setDept] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filtered = useMemo(() => {
    return scoped
      .filter((f) => (status === "all" ? true : f.status === status))
      .filter((f) => (dept === "all" ? true : f.departement === dept))
      .filter((f) => inRange(f.createdAt, dateRange))
      .filter((f) => {
        if (!q) return true;
        const hay = `${f.numero} ${f.natureBesoin} ${f.fournisseurPotentiel} ${f.demandeurName}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [scoped, q, status, dept, dateRange]);
  const exportToExcel = useCallback(() => {
    const fmtDate = (d?: string) => d ? format(new Date(d), "dd/MM/yyyy", { locale: fr }) : "";
    const rows = filtered.map((f) => ({
      "ID FEB": f.numero,
      "Date de création": fmtDate(f.createdAt),
      "Date de réception": fmtDate(f.receivedDate),
      "Demandeur": f.demandeurName,
      "Département": f.departement,
      "Nature du besoin": f.natureBesoin,
      "Nom du projet": f.projectName || "",
      "Détails FEB": f.febDetails || "",
      "Reçu via": f.receivedVia ? RECEIVED_VIA_LABELS[f.receivedVia] : "",
      "Fournisseur potentiel": f.fournisseurPotentiel,
      "Revue technique requise": f.needsTechnicalReview ? "Oui" : "Non",
      "Articles": f.items.map((i) => `${i.designation} (x${i.quantite})`).join("; "),
      "Total estimé (XAF)": f.totalEstime,
      "Budget alloué (XAF)": f.budgetSpend ?? "",
      "Historique dépenses (XAF)": f.historySpend ?? "",
      "Assignée": f.assignee || "",
      "Délai livraison souhaité": fmtDate(f.delaiLivraison),
      "Date transmission PO": fmtDate(f.poTransmissionDate),
      "Délai approvisionnement (jours)": f.procurementLeadDays ?? "",
      "Date livraison prévue": fmtDate(f.delaiLivraison),
      "Date livraison effective": fmtDate(f.actualDeliveryDate),
      "Dépense réelle (XAF)": f.actualSpend ?? "",
      "Économies négociations": f.savings || "",
      "Statut": STATUS_LABELS[f.status],
      "Défis": f.challenges || "",
      "Actions/Solutions": f.actionSolutions || "",
      "Validations": f.validations.map((v) => `${ROLE_LABELS[v.role]}: ${v.action}${v.comment ? ` - ${v.comment}` : ""}`).join(" | "),
      "Dernière MAJ": fmtDate(f.updatedAt),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FEB");

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length).slice(0, 50)) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `FEB_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }, [filtered]);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
            <History className="w-3.5 h-3.5" />
            Historique
          </div>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
            {isValidator ? "Toutes les FEB" : "Mes FEB"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} fiche{filtered.length > 1 ? "s" : ""} sur {scoped.length}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filtered.length === 0} className="gap-2">
          <Download className="w-4 h-4" />
          Exporter Excel
        </Button>
      </header>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro, nature, fournisseur..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-52 h-9 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "Tous statuts" : STATUS_LABELS[s as FebStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-full md:w-60 h-9 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous départements</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter value={dateRange} onChange={setDateRange} placeholder="Période de création" />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Numéro</th>
                <th className="px-4 py-2.5 font-medium">Nature</th>
                <th className="px-4 py-2.5 font-medium">Département</th>
                {isValidator && <th className="px-4 py-2.5 font-medium">Demandeur</th>}
                <th className="px-4 py-2.5 font-medium text-right">Montant</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium">MAJ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/febs/${f.id}`}
                      className="font-mono text-xs font-medium text-foreground hover:underline"
                    >
                      {f.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 max-w-xs">
                    <Link to={`/febs/${f.id}`} className="font-medium text-foreground truncate block hover:underline">
                      {f.natureBesoin}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{f.departement}</td>
                  {isValidator && (
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{f.demandeurName}</td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground text-xs">
                    {formatXAF(f.totalEstime)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                    {format(new Date(f.updatedAt), "dd MMM yyyy", { locale: fr })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isValidator ? 7 : 6} className="px-4 py-16 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucune FEB ne correspond.</p>
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

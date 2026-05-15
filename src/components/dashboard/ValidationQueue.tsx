import { Link } from "react-router-dom";
import { ArrowRight, Inbox } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Feb, pendingDays } from "@/types/feb";

interface ValidationQueueProps {
  febs: Feb[];
  getSignatoryStatus?: (feb: Feb) => {
    state: "ok" | "loading" | "missing";
    message: string;
  } | null;
}

export function ValidationQueue({ febs, getSignatoryStatus }: ValidationQueueProps) {
  if (febs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-16 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
          <Inbox className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Boîte vide</p>
        <p className="text-xs text-muted-foreground mt-1">Aucune FEB n'attend votre validation.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="divide-y divide-border">
        {febs.map((f) => {
          const days = pendingDays(f);
          const late = days >= 5;
          const signatoryStatus = getSignatoryStatus?.(f) ?? null;
          return (
            <Link
              key={f.id}
              to={`/febs/${f.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{f.natureBesoin}</p>
                  {late && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive bg-destructive-soft px-1.5 py-0.5 rounded">
                      Retard
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-mono">{f.numero}</span> · {f.demandeurName} · {f.departement}
                </p>
                {signatoryStatus && signatoryStatus.state !== "ok" && (
                  <p
                    className={`mt-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      signatoryStatus.state === "loading"
                        ? "bg-muted text-muted-foreground"
                        : "bg-warning-soft text-warning"
                    }`}
                  >
                    {signatoryStatus.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs tabular-nums ${late ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {days === 0 ? "Aujourd'hui" : `${days} j`}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(f.createdAt), "dd MMM", { locale: fr })}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

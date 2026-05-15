import { useEffect, useMemo, useState } from "react";
import { Inbox, Filter } from "lucide-react";
import { useDepartmentsStore } from "@/store/departments-store";
import { useFebStore } from "@/store/feb-store";
import { canActOn, pendingDays, roleForStatus } from "@/types/feb";
import { ValidationQueue } from "@/components/dashboard/ValidationQueue";
import { LateAlerts } from "@/components/dashboard/LateAlerts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Validation() {
  const febs = useFebStore((s) => s.febs);
  const user = useFebStore((s) => s.getCurrentUser());
  const departments = useDepartmentsStore((s) => s.getDepartmentNames());
  const signatoriesByDepartment = useDepartmentsStore((s) => s.signatoriesByDepartment);
  const fetchSignatories = useDepartmentsStore((s) => s.fetchSignatories);
  const [scope, setScope] = useState<"mine" | "all_pending" | "missing_signatory">("mine");
  const [dept, setDept] = useState<string>("all");

  useEffect(() => {
    const pendingDepartments = Array.from(
      new Set(
        febs
          .filter((feb) => feb.status.startsWith("en_attente") && feb.departmentId)
          .map((feb) => feb.departmentId as string),
      ),
    );

    for (const departmentId of pendingDepartments) {
      if (!signatoriesByDepartment[departmentId]) {
        void fetchSignatories(departmentId).catch(() => undefined);
      }
    }
  }, [febs, signatoriesByDepartment, fetchSignatories]);

  const canActAsAssignedSignatory = (departmentId: string | undefined) => {
    if (!departmentId) {
      return true;
    }

    const signatories = signatoriesByDepartment[departmentId];
    if (!signatories) {
      return true;
    }

    return signatories.some(
      (entry) => entry.role === user.role && entry.userId === user.id,
    );
  };

  const getSignatoryStatus = (feb: (typeof febs)[number]) => {
    const expectedRole = roleForStatus(feb.status);
    if (!expectedRole) {
      return null;
    }

    if (!feb.departmentId) {
      return {
        state: "missing" as const,
        message: "Signataire non configure",
      };
    }

    const signatories = signatoriesByDepartment[feb.departmentId];
    if (!signatories) {
      return {
        state: "loading" as const,
        message: "Signataire en chargement",
      };
    }

    const expectedSignatory = signatories.find((entry) => entry.role === expectedRole);
    if (!expectedSignatory) {
      return {
        state: "missing" as const,
        message: "Signataire non configure",
      };
    }

    return {
      state: "ok" as const,
      message: `${expectedSignatory.userName} (${expectedSignatory.userEmail})`,
    };
  };

  const queue = useMemo(() => {
    const base = febs.filter((f) => {
      if (scope === "mine") {
        return canActOn(f, user.role) && canActAsAssignedSignatory(f.departmentId);
      }

      if (scope === "missing_signatory") {
        if (!f.status.startsWith("en_attente")) {
          return false;
        }

        const status = getSignatoryStatus(f);
        return status?.state === "missing";
      }

      return f.status.startsWith("en_attente");
    });

    return base
      .filter((f) => (dept === "all" ? true : f.departement === dept))
      .sort((a, b) => pendingDays(b) - pendingDays(a));
  }, [febs, user.role, scope, dept, signatoriesByDepartment]);

  const mineCount = febs.filter((f) => canActOn(f, user.role) && canActAsAssignedSignatory(f.departmentId)).length;
  const allPendingCount = febs.filter((f) => f.status.startsWith("en_attente")).length;

  const missingSignatoryCount = febs.filter((f) => f.status.startsWith("en_attente") && getSignatoryStatus(f)?.state === "missing").length;

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
          <Inbox className="w-3.5 h-3.5" />
          Validation
        </div>
        <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">
          FEB en attente de validation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mineCount} en attente de votre action · {allPendingCount} dans le circuit total
        </p>
      </header>

      <LateAlerts febs={febs} />

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger className="w-full sm:w-64 h-9 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">À valider par moi ({mineCount})</SelectItem>
            <SelectItem value="all_pending">
              Tout le circuit en cours ({allPendingCount})
            </SelectItem>
            <SelectItem value="missing_signatory">
              Sans signataire configuré ({missingSignatoryCount})
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-full sm:w-60 h-9 bg-card">
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
        </div>
      </div>

      <ValidationQueue febs={queue} getSignatoryStatus={getSignatoryStatus} />
    </div>
  );
}

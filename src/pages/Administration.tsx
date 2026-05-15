import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Role, ROLE_LABELS } from "@/types/feb";
import { useDepartmentsStore } from "@/store/departments-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Users } from "lucide-react";
import { toast } from "sonner";

const ASSIGNABLE_ROLES: Role[] = [
  "demandeur",
  "responsable_technique",
  "responsable_pole",
  "rpaf",
  "supply_chain",
  "admin",
];

const SIGNATORY_ROLES = [
  "responsable_technique",
  "responsable_pole",
  "rpaf",
  "supply_chain",
] as const;

type SignatoryRole = (typeof SIGNATORY_ROLES)[number];

export default function Administration() {
  const currentUser = useAuthStore((s) => s.user);
  const registeredUsers = useAuthStore((s) => s.registeredUsers);
  const fetchUsers = useAuthStore((s) => s.fetchUsers);
  const updateUserRole = useAuthStore((s) => s.updateUserRole);
  const departments = useDepartmentsStore((s) => s.departments);
  const signatoriesByDepartment = useDepartmentsStore((s) => s.signatoriesByDepartment);
  const fetchDepartments = useDepartmentsStore((s) => s.fetchDepartments);
  const fetchSignatories = useDepartmentsStore((s) => s.fetchSignatories);
  const setSignatory = useDepartmentsStore((s) => s.setSignatory);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const isSuperAdmin = currentUser?.role === "super_admin";
  const canManageSignatories = currentUser?.role === "admin" || isSuperAdmin;

  useEffect(() => {
    if (!canManageSignatories) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      const result = await fetchUsers();
      if (cancelled) return;
      if (result.ok !== true) {
        toast.error(result.error);
      }

      try {
        const deps = await fetchDepartments();
        await Promise.all(deps.map((department) => fetchSignatories(department.id).catch(() => undefined)));
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Chargement des signataires impossible.");
        }
      }

      setLoading(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [canManageSignatories, fetchUsers, fetchDepartments, fetchSignatories]);

  if (!canManageSignatories) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    setUpdatingUserId(userId);
    const result = await updateUserRole(userId, newRole);
    setUpdatingUserId(null);

    if (result.ok !== true) {
      toast.error(result.error);
      return;
    }

    toast.success("Rôle mis à jour avec succès.");
  }

  async function handleSetSignatory(departmentId: string, role: SignatoryRole, userId: string) {
    setAssigningKey(`${departmentId}:${role}`);

    try {
      const assigned = await setSignatory(departmentId, role, userId);
      toast.success(`${ROLE_LABELS[role]} assigné à ${assigned.userName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignation du signataire impossible.");
    } finally {
      setAssigningKey(null);
    }
  }

  const usersByRole: Record<SignatoryRole, typeof registeredUsers> = {
    responsable_technique: registeredUsers.filter((user) => user.role === "responsable_technique"),
    responsable_pole: registeredUsers.filter((user) => user.role === "responsable_pole"),
    rpaf: registeredUsers.filter((user) => user.role === "rpaf"),
    supply_chain: registeredUsers.filter((user) => user.role === "supply_chain"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Gestion des utilisateurs, rôles et signataires</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Signataires par département
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement des départements...</p>
          ) : departments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun département actif trouvé.</p>
          ) : (
            <div className="space-y-4">
              {departments.map((department) => {
                const signatories = signatoriesByDepartment[department.id] ?? [];

                return (
                  <div key={department.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-foreground">{department.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {department.code}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {SIGNATORY_ROLES.map((role) => {
                        const key = `${department.id}:${role}`;
                        const current = signatories.find((entry) => entry.role === role);
                        const eligibleUsers = usersByRole[role];

                        return (
                          <div key={key} className="rounded-md border border-border p-3">
                            <p className="text-xs text-muted-foreground mb-2">{ROLE_LABELS[role]}</p>
                            <Select
                              value={current?.userId ?? "unassigned"}
                              disabled={assigningKey === key || eligibleUsers.length === 0}
                              onValueChange={(value) => {
                                if (value !== "unassigned") {
                                  void handleSetSignatory(department.id, role, value);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={eligibleUsers.length === 0 ? "Aucun utilisateur éligible" : "Sélectionner un signataire"}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {current && (
                                  <SelectItem value={current.userId}>
                                    {current.userName} ({current.userEmail})
                                  </SelectItem>
                                )}
                                {!current && <SelectItem value="unassigned">Non assigné</SelectItem>}
                                {eligibleUsers
                                  .filter((user) => user.id !== current?.userId)
                                  .map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.name} ({user.email})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Utilisateurs enregistrés ({registeredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Chargement des utilisateurs...</p>
            ) : registeredUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucun utilisateur enregistré.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle actuel</TableHead>
                    <TableHead>Modifier le rôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registeredUsers.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === "super_admin" ? (
                          <span className="text-xs text-muted-foreground italic">Non modifiable</span>
                        ) : (
                          <Select
                            value={user.role}
                            disabled={updatingUserId === user.id}
                            onValueChange={(v) => handleRoleChange(user.id, v as Role)}
                          >
                            <SelectTrigger className="w-[260px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

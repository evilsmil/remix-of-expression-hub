import { create } from "zustand";
import { API_URL } from "@/lib/api";
import { clearAuthSession, useAuthStore } from "@/store/auth-store";
import type { Role } from "@/types/feb";

type ApiRole =
  | "DEMANDEUR"
  | "RESPONSABLE_TECHNIQUE"
  | "RESPONSABLE_POLE"
  | "RPAF"
  | "SUPPLY_CHAIN"
  | "ADMIN"
  | "SUPER_ADMIN";

interface ApiDepartment {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface ApiSignatory {
  id: string;
  departmentId: string;
  role: ApiRole;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: ApiRole;
    departmentId: string | null;
    isActive: boolean;
  };
}

export interface DepartmentOption {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentSignatory {
  id: string;
  departmentId: string;
  role: Role;
  userId: string;
  userName: string;
  userEmail: string;
}

interface DepartmentsStore {
  departments: DepartmentOption[];
  signatoriesByDepartment: Record<string, DepartmentSignatory[]>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  fetchDepartments: () => Promise<DepartmentOption[]>;
  fetchSignatories: (departmentId: string) => Promise<DepartmentSignatory[]>;
  setSignatory: (
    departmentId: string,
    role: "responsable_technique" | "responsable_pole" | "rpaf" | "supply_chain",
    userId: string,
  ) => Promise<DepartmentSignatory>;
  getDepartmentNames: () => string[];
  findDepartmentIdByName: (name: string) => string | undefined;
  reset: () => void;
}

const DEFAULT_DEPARTMENTS: DepartmentOption[] = [
  { id: "default-dg", code: "DG", name: "Direction Générale" },
  { id: "default-qhse", code: "QHSE", name: "QHSE" },
  { id: "default-rh", code: "RH", name: "Ressources Humaines" },
  { id: "default-cg", code: "CG", name: "Contrôle de Gestion" },
  { id: "default-af", code: "AF", name: "Administratif et Financier" },
  { id: "default-rd", code: "RD", name: "Recherche et Développement" },
  { id: "default-inf", code: "INF", name: "Infrastructures" },
  { id: "default-si", code: "SI", name: "Systèmes d'Information" },
  { id: "default-sco", code: "SCO", name: "Supply Chains and Operations" },
  { id: "default-cm", code: "CM", name: "Commercial et Marketing" },
];

const API_TO_APP_ROLE: Record<ApiRole, Role> = {
  DEMANDEUR: "demandeur",
  RESPONSABLE_TECHNIQUE: "responsable_technique",
  RESPONSABLE_POLE: "responsable_pole",
  RPAF: "rpaf",
  SUPPLY_CHAIN: "supply_chain",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

const APP_TO_API_SIGNATORY_ROLE: Record<
  "responsable_technique" | "responsable_pole" | "rpaf" | "supply_chain",
  "RESPONSABLE_TECHNIQUE" | "RESPONSABLE_POLE" | "RPAF" | "SUPPLY_CHAIN"
> = {
  responsable_technique: "RESPONSABLE_TECHNIQUE",
  responsable_pole: "RESPONSABLE_POLE",
  rpaf: "RPAF",
  supply_chain: "SUPPLY_CHAIN",
};

let cachedDepartments: DepartmentOption[] | undefined;
let cachedDepartmentNames: string[] = [];

function departmentNamesFrom(departments: DepartmentOption[]): string[] {
  if (cachedDepartments === departments) {
    return cachedDepartmentNames;
  }

  cachedDepartments = departments;
  cachedDepartmentNames = departments.map((department) => department.name);
  return cachedDepartmentNames;
}

function mapError(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const candidate = payload as { message?: string | string[] };
    if (typeof candidate.message === "string") {
      return candidate.message;
    }
    if (Array.isArray(candidate.message)) {
      return candidate.message.join(" ");
    }
  }

  return "Requête départements refusée par le serveur.";
}

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }

    throw new Error(mapError(payload));
  }

  return payload as T;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(mapError(payload));
  }

  return payload as T;
}

export const useDepartmentsStore = create<DepartmentsStore>()((set, get) => ({
  departments: DEFAULT_DEPARTMENTS,
  signatoriesByDepartment: {},
  loaded: false,
  loading: false,
  error: null,
  fetchDepartments: async () => {
    if (get().loaded) {
      return get().departments;
    }

    set({ loading: true, error: null });
    try {
      const result = await publicRequest<ApiDepartment[]>("/departments");
      const departments = result
        .filter((department) => department.isActive)
        .map((department) => ({
          id: department.id,
          code: department.code,
          name: department.name,
        }));
      const nextDepartments = departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;
      set({ departments: nextDepartments, loaded: true });
      return nextDepartments;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Chargement des départements impossible." });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  fetchSignatories: async (departmentId: string) => {
    const existing = get().signatoriesByDepartment[departmentId];
    if (existing) {
      return existing;
    }

    const result = await authRequest<ApiSignatory[]>(`/departments/${departmentId}/signatories`);
    const signatories = result
      .filter((entry) => entry.isActive && entry.user.isActive)
      .map((entry) => ({
        id: entry.id,
        departmentId: entry.departmentId,
        role: API_TO_APP_ROLE[entry.role],
        userId: entry.user.id,
        userName: entry.user.name,
        userEmail: entry.user.email,
      }));

    set((state) => ({
      signatoriesByDepartment: {
        ...state.signatoriesByDepartment,
        [departmentId]: signatories,
      },
    }));

    return signatories;
  },
  setSignatory: async (departmentId, role, userId) => {
    const apiRole = APP_TO_API_SIGNATORY_ROLE[role];
    const result = await authRequest<ApiSignatory>(`/departments/${departmentId}/signatories/${apiRole}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    const updated: DepartmentSignatory = {
      id: result.id,
      departmentId: result.departmentId,
      role: API_TO_APP_ROLE[result.role],
      userId: result.user.id,
      userName: result.user.name,
      userEmail: result.user.email,
    };

    set((state) => {
      const current = state.signatoriesByDepartment[departmentId] ?? [];
      const next = [...current.filter((entry) => entry.role !== updated.role), updated];

      return {
        signatoriesByDepartment: {
          ...state.signatoriesByDepartment,
          [departmentId]: next,
        },
      };
    });

    return updated;
  },
  getDepartmentNames: () => departmentNamesFrom(get().departments),
  findDepartmentIdByName: (name: string) => {
    const id = get().departments.find((department) => department.name === name)?.id;
    return id?.startsWith("default-") ? undefined : id;
  },
  reset: () =>
    set({
      departments: DEFAULT_DEPARTMENTS,
      signatoriesByDepartment: {},
      loaded: false,
      loading: false,
      error: null,
    }),
}));

import { create } from "zustand";
import { API_URL } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useDepartmentsStore } from "@/store/departments-store";
import {
  type Feb,
  type FebItem,
  type FebStatus,
  type ReceivedVia,
  type Role,
  type User,
} from "@/types/feb";

type ApiRole =
  | "DEMANDEUR"
  | "RESPONSABLE_TECHNIQUE"
  | "RESPONSABLE_POLE"
  | "RPAF"
  | "SUPPLY_CHAIN"
  | "ADMIN"
  | "SUPER_ADMIN";

type ApiFebStatus =
  | "BROUILLON"
  | "EN_ATTENTE_TECHNIQUE"
  | "EN_ATTENTE_POLE"
  | "EN_ATTENTE_RPAF"
  | "EN_ATTENTE_RECEPTION"
  | "VALIDEE"
  | "REJETEE";

type ApiValidationAction = "APPROUVEE" | "REJETEE";
type ApiSignatureType = "DRAWN" | "TYPED";
type ApiEditAction = "REOUVERTURE" | "MODIFICATION";

interface ApiValidationStep {
  role: ApiRole;
  userName: string;
  action: ApiValidationAction;
  comment?: string | null;
  date: string;
  signature?: {
    type: ApiSignatureType;
    value: string | null;
  } | null;
}

interface ApiFebEditLogEntry {
  date: string;
  by: string;
  byEmail?: string | null;
  action: ApiEditAction;
  reason: string;
}

interface ApiFebItem {
  id: string;
  designation: string;
  quantite: number;
  caracteristiques: string;
  prixEstime: number;
  photo?: string;
}

interface ApiFeb {
  id: string;
  numero: string;
  natureBesoin: string;
  departmentId?: string;
  departement: string;
  demandeurId: string;
  demandeurName: string;
  items: ApiFebItem[];
  totalEstime: number;
  delaiLivraison: string;
  fournisseurPotentiel?: string | null;
  needsTechnicalReview: boolean;
  status: ApiFebStatus;
  validations: ApiValidationStep[];
  createdAt: string;
  updatedAt: string;
  receivedDate?: string | null;
  projectName?: string | null;
  febDetails?: string | null;
  receivedVia?: string | null;
  budgetSpend?: number | null;
  assignee?: string | null;
  poTransmissionDate?: string | null;
  procurementLeadDays?: number | null;
  actualDeliveryDate?: string | null;
  challenges?: string | null;
  actionSolutions?: string | null;
  historySpend?: number | null;
  actualSpend?: number | null;
  savings?: string | null;
  editLog?: ApiFebEditLogEntry[];
}

interface CreateFebInput {
  natureBesoin: string;
  departement: Feb["departement"];
  items: FebItem[];
  delaiLivraison: string;
  fournisseurPotentiel: string;
  needsTechnicalReview: boolean;
  submit: boolean;
}

interface FebStore {
  febs: Feb[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  sessionUserId: string | null;
  setCurrentUser: (id: string) => void;
  ensureUserFromAuth: (auth: { email: string; name: string; role: Role }) => void;
  getCurrentUser: () => User;
  fetchFebs: () => Promise<void>;
  fetchFebById: (id: string) => Promise<Feb>;
  createFeb: (input: CreateFebInput) => Promise<Feb>;
  updateFeb: (id: string, patch: Partial<Feb>) => Promise<Feb>;
  submitFeb: (id: string) => Promise<Feb>;
  approveFeb: (id: string, comment?: string) => Promise<Feb>;
  rejectFeb: (id: string, comment: string) => Promise<Feb>;
  reopenFeb: (id: string, reason: string) => Promise<Feb>;
  deleteFeb: (id: string) => Promise<void>;
}

const API_TO_APP_ROLE: Record<ApiRole, Role> = {
  DEMANDEUR: "demandeur",
  RESPONSABLE_TECHNIQUE: "responsable_technique",
  RESPONSABLE_POLE: "responsable_pole",
  RPAF: "rpaf",
  SUPPLY_CHAIN: "supply_chain",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

const API_TO_APP_STATUS: Record<ApiFebStatus, FebStatus> = {
  BROUILLON: "brouillon",
  EN_ATTENTE_TECHNIQUE: "en_attente_technique",
  EN_ATTENTE_POLE: "en_attente_pole",
  EN_ATTENTE_RPAF: "en_attente_rpaf",
  EN_ATTENTE_RECEPTION: "en_attente_reception",
  VALIDEE: "validee",
  REJETEE: "rejetee",
};

const FALLBACK_USER: User = {
  id: "",
  name: "Utilisateur",
  role: "demandeur",
  department: "Direction Générale",
  email: "",
};

function normalizeFileUrl(path?: string | null): string | undefined {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  return `${API_URL}${path}`;
}

function toValidationAction(action: ApiValidationAction): "approuvee" | "rejetee" {
  return action === "APPROUVEE" ? "approuvee" : "rejetee";
}

function toEditAction(action: ApiEditAction): "reouverture" | "modification" {
  return action === "REOUVERTURE" ? "reouverture" : "modification";
}

function toSignatureType(type: ApiSignatureType): "drawn" | "typed" {
  return type === "DRAWN" ? "drawn" : "typed";
}

function toReceivedVia(value?: string | null): ReceivedVia | undefined {
  if (!value) {
    return undefined;
  }

  if (["email", "courrier", "plateforme", "telephone", "autre"].includes(value)) {
    return value as ReceivedVia;
  }

  return undefined;
}

function toFeb(apiFeb: ApiFeb): Feb {
  return {
    id: apiFeb.id,
    numero: apiFeb.numero,
    natureBesoin: apiFeb.natureBesoin,
    departmentId: apiFeb.departmentId,
    departement: apiFeb.departement as Feb["departement"],
    demandeurId: apiFeb.demandeurId,
    demandeurName: apiFeb.demandeurName,
    items: apiFeb.items.map((item) => ({
      id: item.id,
      designation: item.designation,
      quantite: item.quantite,
      caracteristiques: item.caracteristiques,
      prixEstime: Number(item.prixEstime),
      photo: normalizeFileUrl(item.photo),
    })),
    totalEstime: Number(apiFeb.totalEstime),
    delaiLivraison: apiFeb.delaiLivraison,
    fournisseurPotentiel: apiFeb.fournisseurPotentiel ?? "",
    needsTechnicalReview: apiFeb.needsTechnicalReview,
    status: API_TO_APP_STATUS[apiFeb.status],
    validations: apiFeb.validations.map((validation) => ({
      role: API_TO_APP_ROLE[validation.role],
      userName: validation.userName,
      action: toValidationAction(validation.action),
      comment: validation.comment ?? undefined,
      date: validation.date,
      signature: validation.signature?.value
        ? {
            type: toSignatureType(validation.signature.type),
            value: normalizeFileUrl(validation.signature.value) ?? validation.signature.value,
          }
        : undefined,
    })),
    createdAt: apiFeb.createdAt,
    updatedAt: apiFeb.updatedAt,
    receivedDate: apiFeb.receivedDate ?? undefined,
    projectName: apiFeb.projectName ?? undefined,
    febDetails: apiFeb.febDetails ?? undefined,
    receivedVia: toReceivedVia(apiFeb.receivedVia),
    budgetSpend: apiFeb.budgetSpend ?? undefined,
    assignee: apiFeb.assignee ?? undefined,
    poTransmissionDate: apiFeb.poTransmissionDate ?? undefined,
    procurementLeadDays: apiFeb.procurementLeadDays ?? undefined,
    actualDeliveryDate: apiFeb.actualDeliveryDate ?? undefined,
    challenges: apiFeb.challenges ?? undefined,
    actionSolutions: apiFeb.actionSolutions ?? undefined,
    historySpend: apiFeb.historySpend ?? undefined,
    actualSpend: apiFeb.actualSpend ?? undefined,
    savings: apiFeb.savings ?? undefined,
    editLog: apiFeb.editLog?.map((entry) => ({
      date: entry.date,
      by: entry.by,
      byEmail: entry.byEmail ?? undefined,
      action: toEditAction(entry.action),
      reason: entry.reason,
    })),
  };
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

  return "Requête FEB refusée par le serveur.";
}

async function febRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  if (!accessToken) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(mapError(payload));
  }

  return payload as T;
}

function upsertFeb(febs: Feb[], feb: Feb): Feb[] {
  const index = febs.findIndex((item) => item.id === feb.id);
  if (index === -1) {
    return [feb, ...febs];
  }

  return febs.map((item) => (item.id === feb.id ? feb : item));
}

function currentUserFromAuth(): User {
  const authUser = useAuthStore.getState().user;

  if (!authUser) {
    return FALLBACK_USER;
  }

  return {
    id: authUser.id,
    name: authUser.name,
    role: authUser.role,
    department: FALLBACK_USER.department,
    email: authUser.email,
  };
}

export const useFebStore = create<FebStore>()((set, get) => ({
  febs: [],
  isLoading: false,
  isLoaded: false,
  error: null,
  sessionUserId: null,
  setCurrentUser: () => undefined,
  ensureUserFromAuth: () => undefined,
  getCurrentUser: () => currentUserFromAuth(),
  fetchFebs: async () => {
    const sessionUserId = useAuthStore.getState().user?.id ?? null;
    set({ isLoading: true, error: null });

    try {
      const febs = await febRequest<ApiFeb[]>("/feb", { method: "GET" });
      set({ febs: febs.map(toFeb), isLoaded: true, sessionUserId });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Chargement des FEB impossible.",
        isLoaded: true,
        sessionUserId,
      });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  fetchFebById: async (id) => {
    const feb = toFeb(await febRequest<ApiFeb>(`/feb/${id}`, { method: "GET" }));
    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  createFeb: async (input) => {
    const departmentId = useDepartmentsStore.getState().findDepartmentIdByName(input.departement);
    const feb = toFeb(
      await febRequest<ApiFeb>("/feb", {
        method: "POST",
        body: JSON.stringify({
          natureBesoin: input.natureBesoin,
          departmentId,
          departement: input.departement,
          items: input.items.map((item) => ({
            designation: item.designation,
            quantite: item.quantite,
            caracteristiques: item.caracteristiques,
            prixEstime: item.prixEstime,
            photo: item.photo,
          })),
          delaiLivraison: input.delaiLivraison,
          fournisseurPotentiel: input.fournisseurPotentiel,
          needsTechnicalReview: input.needsTechnicalReview,
          submit: input.submit,
        }),
      }),
    );

    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  updateFeb: async (id, patch) => {
    const departmentId = patch.departement
      ? useDepartmentsStore.getState().findDepartmentIdByName(patch.departement)
      : undefined;

    const feb = toFeb(
      await febRequest<ApiFeb>(`/feb/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          natureBesoin: patch.natureBesoin,
          departmentId,
          departement: patch.departement,
          items: patch.items?.map((item) => ({
            designation: item.designation,
            quantite: item.quantite,
            caracteristiques: item.caracteristiques,
            prixEstime: item.prixEstime,
            photo: item.photo,
          })),
          delaiLivraison: patch.delaiLivraison,
          fournisseurPotentiel: patch.fournisseurPotentiel,
          needsTechnicalReview: patch.needsTechnicalReview,
          receivedDate: patch.receivedDate,
          projectName: patch.projectName,
          febDetails: patch.febDetails,
          receivedVia: patch.receivedVia,
          budgetSpend: patch.budgetSpend,
          assignee: patch.assignee,
          historySpend: patch.historySpend,
          poTransmissionDate: patch.poTransmissionDate,
          procurementLeadDays: patch.procurementLeadDays,
          actualDeliveryDate: patch.actualDeliveryDate,
          challenges: patch.challenges,
          actionSolutions: patch.actionSolutions,
          actualSpend: patch.actualSpend,
          savings: patch.savings,
        }),
      }),
    );

    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  submitFeb: async (id) => {
    const feb = toFeb(await febRequest<ApiFeb>(`/feb/${id}/submit`, { method: "PATCH" }));
    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  approveFeb: async (id, comment) => {
    const feb = toFeb(
      await febRequest<ApiFeb>(`/feb/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ comment }),
      }),
    );
    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  rejectFeb: async (id, comment) => {
    const feb = toFeb(
      await febRequest<ApiFeb>(`/feb/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ comment }),
      }),
    );
    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  reopenFeb: async (id, reason) => {
    const feb = toFeb(
      await febRequest<ApiFeb>(`/feb/${id}/reopen`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }),
    );
    set((state) => ({ febs: upsertFeb(state.febs, feb) }));
    return feb;
  },
  deleteFeb: async (id) => {
    await febRequest<{ ok: true }>(`/feb/${id}`, { method: "DELETE" });
    set((state) => ({ febs: state.febs.filter((item) => item.id !== id) }));
  },
}));

export function formatXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Role } from "@/types/feb";
import { API_URL } from "@/lib/api";

const ALLOWED_DOMAIN = "@upowa.org";
type ApiRole =
  | "DEMANDEUR"
  | "RESPONSABLE_TECHNIQUE"
  | "RESPONSABLE_POLE"
  | "RPAF"
  | "SUPPLY_CHAIN"
  | "ADMIN"
  | "SUPER_ADMIN";

const API_TO_APP_ROLE: Record<ApiRole, Role> = {
  DEMANDEUR: "demandeur",
  RESPONSABLE_TECHNIQUE: "responsable_technique",
  RESPONSABLE_POLE: "responsable_pole",
  RPAF: "rpaf",
  SUPPLY_CHAIN: "supply_chain",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

const APP_TO_API_ROLE: Record<Role, ApiRole> = {
  demandeur: "DEMANDEUR",
  responsable_technique: "RESPONSABLE_TECHNIQUE",
  responsable_pole: "RESPONSABLE_POLE",
  rpaf: "RPAF",
  supply_chain: "SUPPLY_CHAIN",
  admin: "ADMIN",
  super_admin: "SUPER_ADMIN",
};

interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: ApiRole;
  departmentId: string | null;
}

interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
}

export function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN);
}

interface RegisteredUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
}

type AuthResult = Promise<{ ok: true } | { ok: false; error: string }>;

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  registeredUsers: RegisteredUser[];
  login: (email: string, password: string) => AuthResult;
  loginWithGoogle: (credential: string) => AuthResult;
  register: (email: string, name: string, password: string) => AuthResult;
  requestPasswordReset: (email: string) => AuthResult;
  confirmPasswordReset: (token: string, newPassword: string) => AuthResult;
  logout: () => Promise<void>;
  fetchUsers: () => AuthResult;
  updateUserRole: (id: string, role: Role) => AuthResult;
  getAllUsers: () => RegisteredUser[];
}

function toAuthUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: API_TO_APP_ROLE[user.role],
    departmentId: user.departmentId,
  };
}

function upsertRegisteredUser(users: RegisteredUser[], user: AuthUser): RegisteredUser[] {
  const nextUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  };

  const exists = users.some((item) => item.email === user.email);
  return exists
    ? users.map((item) => (item.email === user.email ? nextUser : item))
    : [...users, nextUser];
}

function toRegisteredUser(user: ApiUser): RegisteredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: API_TO_APP_ROLE[user.role],
    departmentId: user.departmentId,
  };
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && headers.has("Authorization")) {
      clearAuthSession();
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }

    const message =
      typeof payload?.message === "string"
        ? payload.message
        : Array.isArray(payload?.message)
          ? payload.message.join(" ")
          : "Requête refusée par le serveur.";
    throw new Error(message);
  }

  return payload as T;
}

function errorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Impossible de joindre l'API. Vérifiez que le backend est démarré.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur inattendue est survenue.";
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      registeredUsers: [],
      register: async (rawEmail, name, password) => {
        const email = rawEmail.toLowerCase().trim();
        if (!email || !name || !password) {
          return { ok: false, error: "Tous les champs sont requis." };
        }
        if (!isAllowedEmail(email)) {
          return { ok: false, error: "Accès réservé aux adresses @upowa.org." };
        }
        if (password.length < 6) {
          return { ok: false, error: "Le mot de passe doit contenir au moins 6 caractères." };
        }

        try {
          const response = await apiRequest<AuthResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, name: name.trim(), password }),
          });
          const user = toAuthUser(response.user);
          set((state) => ({
            user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            registeredUsers: upsertRegisteredUser(state.registeredUsers, user),
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      login: async (rawEmail, password) => {
        const email = rawEmail.toLowerCase().trim();
        if (!email || !password) {
          return { ok: false, error: "Email et mot de passe requis." };
        }
        if (!isAllowedEmail(email)) {
          return { ok: false, error: "Accès réservé aux adresses @upowa.org." };
        }

        try {
          const response = await apiRequest<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          const user = toAuthUser(response.user);
          set((state) => ({
            user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            registeredUsers: upsertRegisteredUser(state.registeredUsers, user),
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      loginWithGoogle: async (credential: string) => {
        if (!credential) {
          return { ok: false, error: "Jeton Google manquant." };
        }

        try {
          const response = await apiRequest<AuthResponse>("/auth/google", {
            method: "POST",
            body: JSON.stringify({ credential }),
          });
          const user = toAuthUser(response.user);
          set((state) => ({
            user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            registeredUsers: upsertRegisteredUser(state.registeredUsers, user),
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      requestPasswordReset: async (rawEmail: string) => {
        const email = rawEmail.toLowerCase().trim();
        if (!email) {
          return { ok: false, error: "Adresse e-mail requise." };
        }
        if (!isAllowedEmail(email)) {
          return { ok: false, error: "Accès réservé aux adresses @upowa.org." };
        }

        try {
          await apiRequest<{ ok: true; resetToken?: string }>("/auth/password-reset/request", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      confirmPasswordReset: async (token: string, newPassword: string) => {
        if (!token || !newPassword) {
          return { ok: false, error: "Token et nouveau mot de passe requis." };
        }
        if (newPassword.length < 6) {
          return { ok: false, error: "Le mot de passe doit contenir au moins 6 caractères." };
        }

        try {
          await apiRequest<{ ok: true }>("/auth/password-reset/confirm", {
            method: "POST",
            body: JSON.stringify({ token, newPassword }),
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      logout: async () => {
        const { accessToken, refreshToken } = get();
        set({ user: null, accessToken: null, refreshToken: null });

        if (!accessToken) return;

        await apiRequest<{ ok: true }>("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ refreshToken }),
        }).catch(() => undefined);
      },
      fetchUsers: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          return { ok: false, error: "Session expirée. Veuillez vous reconnecter." };
        }

        try {
          const users = await apiRequest<ApiUser[]>("/users", {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          set((state) => {
            const registeredUsers = users.map(toRegisteredUser);
            const currentUser = state.user
              ? registeredUsers.find((user) => user.id === state.user?.id)
              : undefined;

            return {
              registeredUsers,
              user: currentUser ? { ...state.user, ...currentUser } : state.user,
            };
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      updateUserRole: async (id: string, role: Role) => {
        const { accessToken } = get();
        if (!accessToken) {
          return { ok: false, error: "Session expirée. Veuillez vous reconnecter." };
        }

        try {
          const response = await apiRequest<ApiUser>(`/users/${id}/role`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ role: APP_TO_API_ROLE[role] }),
          });
          const updatedUser = toRegisteredUser(response);
          set((state) => ({
            registeredUsers: state.registeredUsers.map((user) =>
              user.id === id ? updatedUser : user,
            ),
            user: state.user && state.user.id === id ? { ...state.user, ...updatedUser } : state.user,
          }));
          return { ok: true };
        } catch (error) {
          return { ok: false, error: errorMessage(error) };
        }
      },
      getAllUsers: () => get().registeredUsers,
    }),
    { name: "auth-store-v4" },
  ),
);

export function clearAuthSession(): void {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
}

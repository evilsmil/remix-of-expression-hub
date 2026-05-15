import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  History,
  PlusCircle,
  Inbox,
  LogOut,
  PenLine,
  Shield,
  Menu,
  X,
} from "lucide-react";
import logo from "@/assets/upowa-logo.jpg";
import { useDepartmentsStore } from "@/store/departments-store";
import { useFebStore } from "@/store/feb-store";
import { useAuthStore } from "@/store/auth-store";
import { ROLE_LABELS, isValidatorRole, canActOn } from "@/types/feb";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const febs = useFebStore((s) => s.febs);
  const fetchFebs = useFebStore((s) => s.fetchFebs);
  const isLoaded = useFebStore((s) => s.isLoaded);
  const isLoading = useFebStore((s) => s.isLoading);
  const sessionUserId = useFebStore((s) => s.sessionUserId);
  const fetchDepartments = useDepartmentsStore((s) => s.fetchDepartments);
  const fetchSignatories = useDepartmentsStore((s) => s.fetchSignatories);
  const signatoriesByDepartment = useDepartmentsStore((s) => s.signatoriesByDepartment);
  const loadedDepartmentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authUser) {
      return;
    }

    void fetchDepartments().catch(() => undefined);
    void fetchFebs().catch(() => undefined);
  }, [authUser?.id]);

  useEffect(() => {
    if (!febs.length) {
      return;
    }

    const pendingDepartments = new Set(
      febs
        .filter((feb) => feb.status.startsWith("en_attente") && feb.departmentId)
        .map((feb) => feb.departmentId as string),
    );

    for (const departmentId of pendingDepartments) {
      if (loadedDepartmentIdsRef.current.has(departmentId)) {
        continue;
      }

      if (signatoriesByDepartment[departmentId]) {
        loadedDepartmentIdsRef.current.add(departmentId);
        continue;
      }

      void fetchSignatories(departmentId)
        .then(() => {
          loadedDepartmentIdsRef.current.add(departmentId);
        })
        .catch(() => undefined);
      }
  }, [febs, signatoriesByDepartment, fetchSignatories]);

  const waitingForSessionData = Boolean(authUser) && (!isLoaded || sessionUserId !== authUser?.id);

  if (waitingForSessionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground">Chargement des FEB...</p>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Connexion au backend en cours." : "Initialisation de l'espace de travail."}
          </p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  const current = authUser;

  const isValidator = isValidatorRole(current.role);
  const canActAsAssignedSignatory = (departmentId: string | undefined) => {
    if (!departmentId) {
      return true;
    }

    const signatories = signatoriesByDepartment[departmentId];
    if (!signatories) {
      return true;
    }

    return signatories.some(
      (entry) => entry.role === current.role && entry.userId === current.id,
    );
  };

  const pendingCount = isValidator
    ? febs.filter((f) => canActOn(f, current.role) && canActAsAssignedSignatory(f.departmentId)).length
    : 0;

  const canSeeAdministration = current.role === "admin" || current.role === "super_admin";

  const navItems = isValidator
    ? [
        { to: "/", label: "Accueil", icon: LayoutDashboard, end: true },
        {
          to: "/validation",
          label: "FEB en attente",
          icon: Inbox,
          end: false,
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { to: "/historique", label: "Historique FEB", icon: History, end: false },
        { to: "/febs/nouveau", label: "Nouvelle FEB", icon: PlusCircle, end: false },
        { to: "/signature", label: "Ma signature", icon: PenLine, end: false },
        ...(canSeeAdministration
          ? [{ to: "/administration", label: "Administration", icon: Shield, end: false }]
          : []),
      ]
    : [
        { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
        { to: "/historique", label: "Historique FEB", icon: History, end: false },
        { to: "/febs/nouveau", label: "Nouvelle FEB", icon: PlusCircle, end: false },
      ];

  const [sidebarOpen, setSidebarOpen] = useState(true);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - fixed, collapses to icons-only */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border z-40 transition-[width] duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div
          className={cn(
            "border-b border-sidebar-border flex items-center gap-3",
            sidebarOpen ? "p-5" : "p-3 justify-center"
          )}
        >
          <div className="w-10 h-10 shrink-0 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="upöwa logo" className="w-full h-full object-contain" />
          </div>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base leading-tight">upöwa</p>
                <p className="text-xs text-sidebar-foreground/70">FEB Dashboard</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Réduire la barre latérale"
                title="Réduire"
                className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Afficher la barre latérale"
            title="Afficher"
            className="mx-auto mt-2 p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto overflow-x-hidden",
            sidebarOpen ? "p-3" : "p-2"
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={!sidebarOpen ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all relative",
                    sidebarOpen ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                {"badge" in item && item.badge !== undefined && (
                  <span
                    className={cn(
                      "bg-warning text-warning-foreground text-[11px] font-bold rounded-full text-center",
                      sidebarOpen
                        ? "px-2 py-0.5 min-w-[20px]"
                        : "absolute -top-1 -right-1 px-1.5 py-0 min-w-[18px] text-[10px]"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User block */}
        <div
          className={cn(
            "border-t border-sidebar-border space-y-2",
            sidebarOpen ? "p-3" : "p-2"
          )}
        >
          {sidebarOpen && (
            <div className="px-2.5 py-2 rounded-md bg-sidebar-accent/50">
              <p className="font-medium text-white text-sm leading-tight truncate">
                {current.name}
              </p>
              <p className="text-[11px] text-sidebar-foreground/70 mt-0.5 truncate">
                {ROLE_LABELS[current.role]}
              </p>
              {authUser && (
                <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 truncate font-mono">
                  {authUser.email}
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            title={!sidebarOpen ? "Se déconnecter" : undefined}
            className={cn(
              "w-full flex items-center rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors",
              sidebarOpen ? "gap-2 px-2.5 py-2" : "justify-center px-2 py-2"
            )}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {sidebarOpen && <span>Se déconnecter</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <div
          className="max-w-[1400px] mx-auto p-8 animate-fade-in"
          key={location.pathname}
        >
          {children}
        </div>
      </main>
    </div>
  );
}



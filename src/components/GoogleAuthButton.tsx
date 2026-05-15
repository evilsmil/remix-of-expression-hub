import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        fill="#EA4335"
        d="M12 10.2v3.95h5.52c-.24 1.24-.96 2.3-2.04 3.01v2.5h3.31c1.94-1.79 3.06-4.43 3.06-7.56 0-.73-.06-1.43-.18-2.1H12Z"
      />
      <path
        fill="#34A853"
        d="M6.68 14.17 6 14.7l-2.39 1.86A11.99 11.99 0 0 0 12 24c3.25 0 5.98-1.07 7.98-2.9l-3.31-2.5c-.91.61-2.08.98-3.67.98-2.82 0-5.22-1.9-6.08-4.48Z"
      />
      <path
        fill="#4A90E2"
        d="M3.61 8.43a11.93 11.93 0 0 0 0 7.13l4.29-3.33A7.16 7.16 0 0 1 7.5 12c0-.42.07-.83.16-1.2L3.61 8.43Z"
      />
      <path
        fill="#FBBC05"
        d="M12 4.73c1.77 0 3.36.61 4.62 1.82l3.47-3.47A11.71 11.71 0 0 0 12 0 11.99 11.99 0 0 0 3.61 8.43l4.04 3.15A7.2 7.2 0 0 1 12 4.73Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  mode: "login" | "register";
}

export function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const navigate = useNavigate();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGoogleButton() {
      try {
        const response = await fetch(`${API_URL}/auth/google/config`);
        if (!response.ok) {
          throw new Error("Configuration Google indisponible.");
        }

        const payload = (await response.json()) as { clientId?: string };
        const clientId = payload.clientId;
        if (!clientId) {
          throw new Error("Client ID Google manquant.");
        }

        if (!document.getElementById("google-gsi-script")) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.id = "google-gsi-script";
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Impossible de charger Google Sign-In."));
            document.head.appendChild(script);
          });
        }

        if (cancelled || !containerRef.current || !window.google) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            if (!credential) {
              setError("Connexion Google annulée.");
              return;
            }

            setError(null);
            setLoading(true);
            const result = await loginWithGoogle(credential);
            setLoading(false);

            if (!result.ok) {
              setError(result.error);
              return;
            }

            toast.success(mode === "login" ? "Connexion Google réussie" : "Compte créé avec Google");
            navigate("/", { replace: true });
          },
        });

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            theme: "outline",
            size: "large",
            shape: "pill",
            text: mode === "login" ? "signin_with" : "signup_with",
            locale: "fr",
          });
        }

        if (!cancelled) {
          setReady(true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Google Sign-In indisponible.");
          setLoading(false);
        }
      }
    }

    void loadGoogleButton();

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, mode, navigate]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="min-h-11" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className={`w-full justify-center ${ready ? "hidden" : ""}`}
        disabled
      >
        <GoogleIcon />
        {mode === "login" ? "Continuer avec Google" : "Créer avec Google"}
      </Button>
    </div>
  );
}

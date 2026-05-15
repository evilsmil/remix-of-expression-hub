import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import logo from "@/assets/upowa-logo.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);
  const tokenFromUrl = searchParams.get("token") ?? "";
  const token = useMemo(() => tokenFromUrl.trim(), [tokenFromUrl]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Le lien de réinitialisation est incomplet.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await confirmPasswordReset(token, newPassword);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      setSubmitted(true);
      toast.success("Mot de passe mis à jour");
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-lg bg-white border border-border p-1 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="upöwa" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg leading-tight">upöwa</p>
            <p className="text-xs text-muted-foreground">FEB Dashboard</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow-sm">
          {!submitted ? (
            <>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Réinitialiser le mot de passe
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Choisissez un nouveau mot de passe pour votre compte.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nouveau mot de passe</label>
                  <Input
                    type="password"
                    placeholder="Min. 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Confirmer le mot de passe
                  </label>
                  <Input
                    type="password"
                    placeholder="Retapez le mot de passe"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>

                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading || !token}>
                  <LockKeyhole className="w-4 h-4 mr-1.5" />
                  {loading ? "Mise à jour..." : "Modifier le mot de passe"}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <LockKeyhole className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Mot de passe mis à jour</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.
              </p>
            </div>
          )}

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

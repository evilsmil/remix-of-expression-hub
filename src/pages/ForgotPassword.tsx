import { FormEvent, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import logo from "@/assets/upowa-logo.jpg";
import { useAuthStore } from "@/store/auth-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPassword() {
  const user = useAuthStore((s) => s.user);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      setSubmitted(true);
      toast.success("Lien de réinitialisation envoyé");
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
                Mot de passe oublié
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Adresse e-mail</label>
                  <Input
                    type="email"
                    placeholder="prenom.nom@upowa.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={!email || loading}>
                  <Mail className="w-4 h-4 mr-1.5" />
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mt-4">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Vérifiez votre boîte mail</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Si un compte existe avec l'adresse <span className="font-medium text-foreground">{email}</span>,
                vous recevrez un lien de réinitialisation.
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

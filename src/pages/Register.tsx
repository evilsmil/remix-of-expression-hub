import { FormEvent, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import logo from "@/assets/upowa-logo.jpg";
import { useAuthStore } from "@/store/auth-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await register(email, name, password);
      if (res.ok !== true) {
        setError(res.error);
        return;
      }
      toast.success("Compte créé avec succès");
      navigate("/", { replace: true });
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
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Créer un compte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Renseignez vos informations pour accéder à la plateforme.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nom complet</label>
              <Input
                type="text"
                placeholder="Prénom Nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Adresse e-mail</label>
              <Input
                type="email"
                placeholder="prenom.nom@upowa.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Mot de passe</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Confirmer le mot de passe</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Retapez votre mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
            </div>
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !name || !email || !password}>
              {loading ? "Création..." : "Créer mon compte"}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Se connecter
            </Link>
          </div>

          <div className="mt-5 pt-5 border-t border-border flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-success" />
            <p>
              Seules les adresses <span className="font-medium text-foreground">@upowa.org</span>{" "}
              sont autorisées. Les rôles sont attribués automatiquement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

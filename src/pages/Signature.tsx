import { useEffect, useRef, useState } from "react";
import { PenLine, Type, Trash2, Save, CheckCircle2, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { fileToCompressedDataUrl } from "@/lib/image-utils";
import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "drawn" | "typed" | "upload";
type ApiSignatureType = "DRAWN" | "TYPED";

interface ApiSignature {
  id: string;
  type: ApiSignatureType;
  value: string | null;
  imageId: string | null;
  updatedAt: string;
}

interface StoredSignature {
  type: "drawn" | "typed";
  value: string;
  updatedAt: string;
}

function normalizeAssetUrl(value: string | null): string {
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }
  return `${API_URL}${value}`;
}

function toStoredSignature(signature: ApiSignature): StoredSignature | null {
  if (signature.type === "TYPED") {
    return {
      type: "typed",
      value: signature.value ?? "",
      updatedAt: signature.updatedAt,
    };
  }

  const value = normalizeAssetUrl(signature.value);
  if (!value) {
    return null;
  }

  return {
    type: "drawn",
    value,
    updatedAt: signature.updatedAt,
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

  return "Requete signature refusee par le serveur.";
}

async function signatureRequest<T>(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(mapError(payload));
  }

  return payload as T;
}

export default function Signature() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [existing, setExisting] = useState<StoredSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("drawn");
  const [typedName, setTypedName] = useState(user?.name ?? "");
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    if (!accessToken || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSignature() {
      setLoading(true);
      try {
        const response = await signatureRequest<ApiSignature | null>(
          "/signatures/me",
          { method: "GET" },
          accessToken,
        );
        if (cancelled) {
          return;
        }

        const normalized = response ? toStoredSignature(response) : null;
        setExisting(normalized);
        setMode(normalized?.type === "typed" ? "typed" : "drawn");
        setTypedName(normalized?.type === "typed" ? normalized.value : user.name);
        setUploadedDataUrl(normalized?.type === "drawn" ? normalized.value : null);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Impossible de charger la signature.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSignature();

    return () => {
      cancelled = true;
    };
  }, [accessToken, user]);

  useEffect(() => {
    if (mode !== "drawn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    setHasDrawing(false);

    const source = uploadedDataUrl ?? (existing?.type === "drawn" ? existing.value : null);
    if (source) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssW, cssH);
        setHasDrawing(true);
      };
      img.src = source;
    }
  }, [mode, uploadedDataUrl, existing]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setHasDrawing(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 1000, "image/png", 0.9);
      setUploadedDataUrl(dataUrl);
      setMode("upload");
      toast.success("Image chargee. Cliquez sur Enregistrer pour valider.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Echec du chargement de l'image");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!accessToken || !user) {
      toast.error("Session expiree. Veuillez vous reconnecter.");
      return;
    }

    try {
      if (mode === "typed") {
        const name = typedName.trim();
        if (!name) {
          toast.error("Le nom ne peut pas etre vide.");
          return;
        }

        const response = await signatureRequest<ApiSignature>(
          "/signatures/me",
          {
            method: "PUT",
            body: JSON.stringify({ type: "TYPED", value: name }),
          },
          accessToken,
        );
        setExisting(toStoredSignature(response));
        toast.success("Signature enregistree");
        return;
      }

      const drawnValue =
        mode === "upload"
          ? uploadedDataUrl
          : hasDrawing
            ? canvasRef.current?.toDataURL("image/png")
            : undefined;

      if (!drawnValue) {
        toast.error("Veuillez dessiner ou importer une signature.");
        return;
      }

      const response = await signatureRequest<ApiSignature>(
        "/signatures/me",
        {
          method: "PUT",
          body: JSON.stringify({ type: "DRAWN", value: drawnValue }),
        },
        accessToken,
      );
      const normalized = toStoredSignature(response);
      setExisting(normalized);
      setUploadedDataUrl(normalized?.type === "drawn" ? normalized.value : null);
      setMode("drawn");
      toast.success("Signature enregistree");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement de la signature impossible.");
    }
  }

  async function handleDelete() {
    if (!accessToken) {
      toast.error("Session expiree. Veuillez vous reconnecter.");
      return;
    }

    try {
      await signatureRequest<{ ok: true }>(
        "/signatures/me",
        { method: "DELETE" },
        accessToken,
      );
      setExisting(null);
      setUploadedDataUrl(null);
      setMode("drawn");
      handleClear();
      toast.success("Signature supprimee");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression de la signature impossible.");
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Ma signature
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Configurez votre signature personnelle. Elle sera apposee automatiquement
          sur chaque FEB que vous validez.
        </p>
      </header>

      {loading && (
        <div className="mb-6 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          Chargement de la signature...
        </div>
      )}

      {existing && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success-soft/40 px-4 py-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span className="text-foreground">
            Signature configuree — derniere mise a jour le{" "}
            {new Date(existing.updatedAt).toLocaleDateString("fr-FR")}
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex gap-2 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
          {([
            { value: "drawn", label: "Dessiner", icon: PenLine },
            { value: "upload", label: "Importer", icon: Upload },
            { value: "typed", label: "Saisir le nom", icon: Type },
          ] as { value: Mode; label: string; icon: typeof PenLine }[]).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setMode(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  mode === tab.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {mode === "drawn" && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-foreground">
              Tracez votre signature dans la zone ci-dessous
            </label>
            <div className="rounded-lg border-2 border-dashed border-border bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-56 cursor-crosshair touch-none block"
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Effacer
              </Button>
            </div>
          </div>
        )}

        {mode === "upload" && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-foreground">
              Importez une image de votre signature (PNG ou JPG)
            </label>

            {uploadedDataUrl ? (
              <div className="rounded-lg border border-border bg-white p-4 flex flex-col items-center gap-3">
                <img
                  src={uploadedDataUrl}
                  alt="Apercu de la signature"
                  className="max-h-40 object-contain"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Remplacer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedDataUrl(null)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Retirer
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-border bg-white hover:bg-muted/30 transition-colors py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                <ImageIcon className="w-8 h-8" />
                <p className="text-sm font-medium text-foreground">
                  Cliquez pour choisir une image
                </p>
                <p className="text-xs">PNG ou JPG, fond blanc ou transparent recommande</p>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {mode === "typed" && (
          <div className="space-y-3">
            <label className="text-xs font-medium text-foreground">
              Nom a apposer en signature
            </label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Votre nom complet"
            />
            <div className="rounded-lg border border-border bg-white p-6 text-center">
              <p className="text-xs text-muted-foreground mb-2">Apercu</p>
              <p
                className="text-2xl text-foreground"
                style={{ fontFamily: "'Brush Script MT', cursive" }}
              >
                {typedName || "—"}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-6 pt-5 border-t border-border">
          {existing ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleDelete()}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={() => void handleSave()}>
            <Save className="w-4 h-4 mr-1.5" />
            Enregistrer la signature
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Votre signature est stockee cote serveur et utilisee automatiquement lors des validations FEB.
      </p>
    </div>
  );
}

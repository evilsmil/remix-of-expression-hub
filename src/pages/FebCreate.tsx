import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDepartmentsStore } from "@/store/departments-store";
import { useFebStore, formatXAF } from "@/store/feb-store";
import { Department, FebItem } from "@/types/feb";
import { Trash2, Plus, Save, Send, ArrowLeft, ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { fileToCompressedDataUrl } from "@/lib/image-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function FebCreate() {
  const navigate = useNavigate();
  const createFeb = useFebStore((s) => s.createFeb);
  const user = useFebStore((s) => s.getCurrentUser());
  const departments = useDepartmentsStore((s) => s.getDepartmentNames());

  const [natureBesoin, setNatureBesoin] = useState("");
  const [departement, setDepartement] = useState<Department>(user.department || "");
  const [delaiLivraison, setDelaiLivraison] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [needsTechnicalReview, setNeedsTechnicalReview] = useState(false);
  const [items, setItems] = useState<FebItem[]>([
    { id: crypto.randomUUID(), designation: "", quantite: 1, caracteristiques: "", prixEstime: 0 },
  ]);

  const total = items.reduce((s, it) => s + (Number(it.prixEstime) || 0), 0);

  const updateItem = (id: string, patch: Partial<FebItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems([...items, { id: crypto.randomUUID(), designation: "", quantite: 1, caracteristiques: "", prixEstime: 0 }]);

  const removeItem = (id: string) => setItems(items.filter((it) => it.id !== id));

  const handleItemPhoto = async (id: string, file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 800, "image/jpeg", 0.8);
      updateItem(id, { photo: dataUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image invalide");
    }
  };

  const handleSubmit = async (submit: boolean) => {
    if (!natureBesoin.trim()) return toast.error("La nature du besoin est obligatoire.");
    if (!delaiLivraison) return toast.error("Le délai de livraison est obligatoire.");
    if (items.some((it) => !it.designation.trim() || it.quantite <= 0)) {
      return toast.error("Chaque article doit avoir une désignation et une quantité positive.");
    }
    try {
      const feb = await createFeb({
        natureBesoin: natureBesoin.trim(),
        departement,
        items,
        delaiLivraison: new Date(delaiLivraison).toISOString(),
        fournisseurPotentiel: fournisseur.trim() || "—",
        needsTechnicalReview,
        submit,
      });
      toast.success(submit ? `FEB ${feb.numero} soumise pour validation` : `FEB ${feb.numero} enregistrée en brouillon`);
      navigate(`/febs/${feb.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création de la FEB impossible.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <header>
        <h1 className="text-3xl font-bold text-foreground">Nouvelle Fiche d'Expression de Besoin</h1>
        <p className="text-muted-foreground mt-1">
          Remplissez le formulaire ci-dessous. La fiche suivra le circuit de validation après soumission.
        </p>
      </header>

      {/* General info */}
      <section className="card-elevated p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Informations générales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="nature">Nature du besoin *</Label>
            <Input
              id="nature"
              value={natureBesoin}
              onChange={(e) => setNatureBesoin(e.target.value)}
              placeholder="Ex: Achat fournitures de bureau Q2 2025"
              maxLength={200}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Département demandeur *</Label>
            <Select value={departement} onValueChange={(v) => setDepartement(v as Department)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="delai">Délai de livraison souhaité *</Label>
            <Input
              id="delai"
              type="date"
              value={delaiLivraison}
              onChange={(e) => setDelaiLivraison(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="fournisseur">Fournisseur potentiel</Label>
            <Input
              id="fournisseur"
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Ex: DOVV SARL BASTOS"
              maxLength={150}
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Validation technique requise</p>
              <p className="text-xs text-muted-foreground">Active l'étape de validation par le Responsable Pôle Technique.</p>
            </div>
            <Switch checked={needsTechnicalReview} onCheckedChange={setNeedsTechnicalReview} />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="card-elevated p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Identification du besoin</h2>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" /> Ajouter un article
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={it.id} className="grid grid-cols-12 gap-3 items-start p-3 rounded-lg border border-border bg-muted/30">
              <div className="col-span-12 md:col-span-1 text-sm font-bold text-muted-foreground pt-2">#{idx + 1}</div>
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs">Désignation *</Label>
                <Input
                  value={it.designation}
                  onChange={(e) => updateItem(it.id, { designation: e.target.value })}
                  placeholder="Ex: Palette d'eau minérale"
                  maxLength={200}
                  className="mt-1 bg-card"
                />
              </div>
              <div className="col-span-4 md:col-span-1">
                <Label className="text-xs">Qté *</Label>
                <Input
                  type="number"
                  min={1}
                  value={it.quantite}
                  onChange={(e) => updateItem(it.id, { quantite: Number(e.target.value) })}
                  className="mt-1 bg-card"
                />
              </div>
              <div className="col-span-8 md:col-span-3">
                <Label className="text-xs">Caractéristiques techniques</Label>
                <Input
                  value={it.caracteristiques}
                  onChange={(e) => updateItem(it.id, { caracteristiques: e.target.value })}
                  placeholder="Ex: 1,5L"
                  maxLength={200}
                  className="mt-1 bg-card"
                />
              </div>
              <div className="col-span-10 md:col-span-2">
                <Label className="text-xs">Prix estimé (FCFA)</Label>
                <Input
                  type="number"
                  min={0}
                  value={it.prixEstime}
                  onChange={(e) => updateItem(it.id, { prixEstime: Number(e.target.value) })}
                  className="mt-1 bg-card"
                />
              </div>

              {/* Photo column */}
              <div className="col-span-10 md:col-span-1">
                <Label className="text-xs">Photo</Label>
                <ItemPhotoField
                  photo={it.photo}
                  onChange={(file) => handleItemPhoto(it.id, file)}
                  onRemove={() => updateItem(it.id, { photo: undefined })}
                />
              </div>

              <div className="col-span-2 md:col-span-1 flex justify-end pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(it.id)}
                  disabled={items.length === 1}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end items-center gap-3 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">Total estimé :</span>
          <span className="text-2xl font-bold text-foreground">{formatXAF(total)}</span>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => void handleSubmit(false)}>
          <Save className="w-4 h-4 mr-2" /> Enregistrer en brouillon
        </Button>
        <Button type="button" onClick={() => void handleSubmit(true)} className="bg-primary hover:bg-primary-glow">
          <Send className="w-4 h-4 mr-2" /> Soumettre pour validation
        </Button>
      </div>
    </div>
  );
}

interface ItemPhotoFieldProps {
  photo?: string;
  onChange: (file: File | undefined) => void;
  onRemove: () => void;
}

function ItemPhotoField({ photo, onChange, onRemove }: ItemPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (photo) {
    return (
      <div className="mt-1 relative w-full aspect-square rounded-md overflow-hidden border border-border bg-card group">
        <img src={photo} alt="Photo article" className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Retirer la photo"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 w-full aspect-square rounded-md border-2 border-dashed border-border bg-card hover:bg-muted/40 transition-colors flex items-center justify-center text-muted-foreground"
        aria-label="Ajouter une photo"
      >
        <ImagePlus className="w-5 h-5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          onChange(e.target.files?.[0]);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </>
  );
}

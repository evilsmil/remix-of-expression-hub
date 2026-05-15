import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  computeOrderTotals,
} from "@/types/purchase-order";
import { useFebStore } from "@/store/feb-store";

interface CreateInput {
  objet: string;
  description?: string;
  devise: string;
  conditionsPaiement?: string;
  dateLivraisonPrevue?: string;
  febId?: string;
  febNumero?: string;
  lines: PurchaseOrderLine[];
  submit: boolean;
}

interface POStore {
  orders: PurchaseOrder[];
  createOrder: (input: CreateInput) => PurchaseOrder;
  updateOrder: (id: string, patch: Partial<PurchaseOrder>) => void;
  submitOrder: (id: string) => void;
  approveOrder: (id: string, comment?: string) => void;
  rejectOrder: (id: string, comment: string) => void;
  markSent: (id: string) => void;
  markReceived: (id: string) => void;
  closeOrder: (id: string) => void;
  cancelOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
}

function generateNumero(existing: number): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const seq = String(existing + 1).padStart(3, "0");
  return `BA-${seq}/${dd}-${mm}-${yyyy}`;
}

export const usePurchaseOrderStore = create<POStore>()(
  persist(
    (set, get) => ({
      orders: seedOrders(),
      createOrder: ({ objet, description, devise, conditionsPaiement, dateLivraisonPrevue, febId, febNumero, lines, submit }) => {
        const user = useFebStore.getState().getCurrentUser();
        const totals = computeOrderTotals(lines);
        const now = new Date().toISOString();
        const numero = generateNumero(get().orders.length);
        const draft: PurchaseOrder = {
          id: crypto.randomUUID(),
          numero,
          objet,
          description,
          status: "brouillon",
          devise,
          lines,
          ...totals,
          dateLivraisonPrevue,
          conditionsPaiement,
          febId,
          febNumero,
          createdById: user.id,
          createdByName: user.name,
          approvals: [],
          createdAt: now,
          updatedAt: now,
        };
        const finalPo: PurchaseOrder = submit
          ? { ...draft, status: "en_attente_rpaf", submittedAt: now }
          : draft;
        set({ orders: [finalPo, ...get().orders] });
        return finalPo;
      },
      updateOrder: (id, patch) =>
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o
          ),
        }),
      submitOrder: (id) => {
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? { ...o, status: "en_attente_rpaf" as PurchaseOrderStatus, submittedAt: now, updatedAt: now }
              : o
          ),
        });
      },
      approveOrder: (id, comment) => {
        const user = useFebStore.getState().getCurrentUser();
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "approuve" as PurchaseOrderStatus,
                  approvedAt: now,
                  updatedAt: now,
                  approvals: [
                    ...o.approvals,
                    {
                      role: "rpaf",
                      userName: user.name,
                      action: "approuvee",
                      comment,
                      date: now,
                    },
                  ],
                }
              : o
          ),
        });
      },
      rejectOrder: (id, comment) => {
        const user = useFebStore.getState().getCurrentUser();
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "rejete" as PurchaseOrderStatus,
                  updatedAt: now,
                  approvals: [
                    ...o.approvals,
                    { role: "rpaf", userName: user.name, action: "rejetee", comment, date: now },
                  ],
                }
              : o
          ),
        });
      },
      markSent: (id) => {
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, status: "envoye", sentAt: now, updatedAt: now } : o
          ),
        });
      },
      markReceived: (id) => {
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "receptionne",
                  receivedAt: now,
                  dateLivraisonReelle: new Date().toISOString().split("T")[0],
                  updatedAt: now,
                }
              : o
          ),
        });
      },
      closeOrder: (id) => {
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, status: "cloture", closedAt: now, updatedAt: now } : o
          ),
        });
      },
      cancelOrder: (id) => {
        const now = new Date().toISOString();
        set({
          orders: get().orders.map((o) =>
            o.id === id ? { ...o, status: "annule", updatedAt: now } : o
          ),
        });
      },
      deleteOrder: (id) => set({ orders: get().orders.filter((o) => o.id !== id) }),
    }),
    { name: "po-store-v1" }
  )
);

function seedOrders(): PurchaseOrder[] {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const lines1: PurchaseOrderLine[] = [
    {
      id: "l1",
      position: 1,
      designation: "Ramettes papier A4 80g",
      caracteristiques: "Carton de 5 ramettes, blanc",
      quantite: 20,
      unite: "carton",
      prixUnitaireHt: 18000,
      tauxTva: 19.25,
      supplierId: "sup-1",
      supplierName: "DOVV SARL BASTOS",
    },
    {
      id: "l2",
      position: 2,
      designation: "Cartouches HP 305 noires",
      caracteristiques: "Compatible LaserJet Pro",
      quantite: 8,
      unite: "u",
      prixUnitaireHt: 35000,
      tauxTva: 19.25,
      supplierId: "sup-2",
      supplierName: "TECH SOLUTIONS CMR",
    },
  ];
  const t1 = computeOrderTotals(lines1);
  return [
    {
      id: "po-seed-1",
      numero: "BA-001/10-04-2025",
      objet: "Réapprovisionnement consommables Q2",
      description: "Achat groupé multi-fournisseurs pour le 2ème trimestre.",
      status: "en_attente_rpaf",
      devise: "XAF",
      lines: lines1,
      ...t1,
      dateLivraisonPrevue: new Date(now + 14 * day).toISOString().split("T")[0],
      conditionsPaiement: "30 jours fin de mois",
      createdById: "u1",
      createdByName: "Awa Mbarga",
      approvals: [],
      createdAt: new Date(now - 3 * day).toISOString(),
      updatedAt: new Date(now - 3 * day).toISOString(),
      submittedAt: new Date(now - 3 * day).toISOString(),
    },
  ];
}

export function formatXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

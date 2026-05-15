import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PurchaseOrder, distinctSuppliers } from "@/types/purchase-order";

const fmtMoney = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

type AutoTableDocument = jsPDF & { lastAutoTable?: { finalY?: number } };

function autoTableFinalY(doc: jsPDF): number {
  return (doc as AutoTableDocument).lastAutoTable?.finalY ?? 0;
}

export function exportPurchaseOrderPdf(po: PurchaseOrder) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  autoTable(doc, {
    startY: margin,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", textColor: [20, 20, 30] },
    columnStyles: {
      0: { cellWidth: 35, halign: "center" },
      1: { cellWidth: 100, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 45, halign: "center" },
    },
    body: [
      [
        { content: "upöwa", styles: { fontStyle: "bold", fontSize: 14, textColor: [30, 41, 59] } },
        { content: "BON D'ACHAT", styles: { fontSize: 11 } },
        { content: "DS - 0021\nVersion : 1.0", styles: { fontSize: 8 } },
      ],
      [
        { content: "" },
        { content: `Numéro : ${po.numero}`, styles: { fontSize: 9, fontStyle: "bold" } },
        { content: `Émis le : ${format(new Date(po.createdAt), "dd/MM/yyyy")}`, styles: { fontSize: 8 } },
      ],
      [
        { content: "" },
        { content: `Objet : ${po.objet}`, styles: { fontSize: 8 } },
        { content: `Devise : ${po.devise}`, styles: { fontSize: 8 } },
      ],
    ],
  });

  let y = autoTableFinalY(doc) + 6;

  // Section a — Prestataires
  const sups = distinctSuppliers(po);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`a. Prestataire${sups.length > 1 ? "s" : ""} (${sups.length})`, margin, y);
  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    body: sups.map((s) => [
      { content: `● ${s.name}`, styles: { fontStyle: "bold", fillColor: [255, 247, 200] } },
    ]),
  });
  y = autoTableFinalY(doc) + 6;

  // Section b — Lignes
  doc.setFont("helvetica", "bold");
  doc.text("b. Détail des lignes", margin, y);

  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "center", fontStyle: "bold" },
    head: [
      ["N°", "Désignation", "Prestataire", "Qté", "PU HT", "TVA %", "Total HT", "Total TTC"],
    ],
    body: [
      ...po.lines.map((l) => {
        const totalHt = l.quantite * l.prixUnitaireHt;
        const totalTtc = totalHt * (1 + l.tauxTva / 100);
        return [
          String(l.position),
          `${l.designation}${l.caracteristiques ? `\n${l.caracteristiques}` : ""}`,
          l.supplierName,
          `${l.quantite} ${l.unite}`,
          fmtMoney(l.prixUnitaireHt),
          String(l.tauxTva),
          fmtMoney(totalHt),
          fmtMoney(totalTtc),
        ];
      }),
      [
        { content: "TOTAUX", colSpan: 6, styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
        { content: fmtMoney(po.totalHt), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
        { content: fmtMoney(po.totalTtc), styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 13, halign: "center" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
    },
  });

  y = autoTableFinalY(doc) + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (po.dateLivraisonPrevue) {
    doc.text(
      `Délai de livraison souhaité : ${format(new Date(po.dateLivraisonPrevue), "dd MMMM yyyy", { locale: fr })}`,
      margin,
      y
    );
    y += 5;
  }
  if (po.conditionsPaiement) {
    doc.text(`Conditions de paiement : ${po.conditionsPaiement}`, margin, y);
    y += 5;
  }
  doc.text(`Devise : ${po.devise}  ·  Total TVA : ${fmtMoney(po.totalTva)}`, margin, y);
  y += 8;

  // Section c — Validation RPAF
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("c. Validation", margin, y);

  const valRpaf = po.approvals.find((a) => a.action === "approuvee");

  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, valign: "top", halign: "center", minCellHeight: 30 },
    body: [
      [
        { content: "Demandeur", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
        {
          content: "Resp. Pôle Administratif & Financier",
          styles: { fontStyle: "bold", fillColor: [241, 245, 249] },
        },
      ],
      [
        po.createdByName,
        valRpaf ? `${valRpaf.userName}\n✓ Approuvé` : "En attente",
      ],
    ],
    didDrawCell: (data) => {
      if (data.section !== "body" || data.row.index !== 1 || data.column.index !== 1) return;
      if (!valRpaf || !valRpaf.signature) return;
      const cell = data.cell;
      const padding = 2;
      const maxW = cell.width - padding * 2;
      const sigAreaH = 12;
      const x = cell.x + padding;
      const yTop = cell.y + padding;
      if (valRpaf.signature.type === "drawn") {
        try {
          doc.addImage(valRpaf.signature.value, "PNG", x, yTop, maxW, sigAreaH);
        } catch {
          /* ignore */
        }
      } else {
        doc.setFont("times", "italic");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(valRpaf.signature.value, cell.x + cell.width / 2, yTop + sigAreaH - 2, {
          align: "center",
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 30);
      }
    },
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Document interne upöwa. Toute reproduction ou diffusion sans autorisation écrite est interdite.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center", maxWidth: pageW - 2 * margin }
  );

  doc.save(`BA-${po.numero.replace(/\//g, "_")}.pdf`);
}

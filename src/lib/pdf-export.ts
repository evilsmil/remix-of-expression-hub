import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { Feb, ROLE_LABELS } from "@/types/feb";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmtXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

type AutoTableDocument = jsPDF & { lastAutoTable?: { finalY?: number } };

function autoTableFinalY(doc: jsPDF): number {
  return (doc as AutoTableDocument).lastAutoTable?.finalY ?? 0;
}

export function exportFebPdf(feb: Feb) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header table (logo placeholder + title + meta)
  autoTable(doc, {
    startY: margin,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", textColor: [20, 20, 30] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "center" },
    columnStyles: {
      0: { cellWidth: 35, halign: "center" },
      1: { cellWidth: 100, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 45, halign: "center" },
    },
    body: [
      [
        { content: "upöwa", styles: { fontStyle: "bold", fontSize: 14, textColor: [30, 41, 59] } },
        { content: "FICHE D'EXPRESSION DE BESOIN EN ACHAT", styles: { fontSize: 11 } },
        { content: "DS - 0016\nVersion : 1.0", styles: { fontSize: 8 } },
      ],
      [
        { content: "" },
        { content: `Mise en application : 20/01/2025`, styles: { fontSize: 8 } },
        { content: "Procédure de référence : PS-0012", styles: { fontSize: 8 } },
      ],
      [
        { content: "" },
        { content: `Numéro de la fiche : ${feb.numero}`, styles: { fontSize: 9, fontStyle: "bold" } },
        { content: `Nature : ${feb.natureBesoin}`, styles: { fontSize: 8 } },
      ],
    ],
  });

  let y = autoTableFinalY(doc) + 6;

  // Section a — Département
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("a. Département demandeur", margin, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2 },
    body: [[{ content: `● ${feb.departement}`, styles: { fontStyle: "bold", fillColor: [255, 247, 200] } }]],
  });
  y = autoTableFinalY(doc) + 6;

  // Section b — Identification du besoin
  doc.setFont("helvetica", "bold");
  doc.text("b. Identification du besoin", margin, y);

  const hasAnyPhoto = feb.items.some((it) => !!it.photo);

  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "center", fontStyle: "bold" },
    head: hasAnyPhoto
      ? [["N°", "Désignation", "Qté", "Caractéristiques techniques", "Prix estimé (FCFA)", "Photo"]]
      : [["N°", "Désignation", "Quantité", "Caractéristiques techniques", "Prix estimé (FCFA)"]],
    body: [
      ...feb.items.map((it, i) => {
        const base = [
          String(i + 1),
          it.designation,
          String(it.quantite),
          it.caracteristiques || "-",
          new Intl.NumberFormat("fr-FR").format(it.prixEstime),
        ];
        return hasAnyPhoto ? [...base, ""] : base;
      }),
      hasAnyPhoto
        ? [
            { content: "Total estimé", colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
            {
              content: new Intl.NumberFormat("fr-FR").format(feb.totalEstime),
              styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] },
            },
            { content: "", styles: { fillColor: [241, 245, 249] } },
          ]
        : [
            { content: "Total estimé", colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] } },
            {
              content: new Intl.NumberFormat("fr-FR").format(feb.totalEstime),
              styles: { fontStyle: "bold", halign: "right", fillColor: [241, 245, 249] },
            },
          ],
    ],
    columnStyles: hasAnyPhoto
      ? {
          0: { cellWidth: 10, halign: "center" },
          2: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 32, halign: "right" },
          5: { cellWidth: 22, halign: "center", minCellHeight: 22 },
        }
      : {
          0: { cellWidth: 12, halign: "center" },
          2: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 35, halign: "right" },
        },
    didDrawCell: hasAnyPhoto
      ? (data) => {
          if (data.section !== "body") return;
          // Photo column is the last one (index 5); skip the totals row (last row).
          if (data.column.index !== 5) return;
          if (data.row.index >= feb.items.length) return;
          const item = feb.items[data.row.index];
          if (!item?.photo) return;
          const cell = data.cell;
          const padding = 1.5;
          const size = Math.min(cell.width, cell.height) - padding * 2;
          const x = cell.x + (cell.width - size) / 2;
          const yTop = cell.y + (cell.height - size) / 2;
          const fmt = item.photo.startsWith("data:image/png") ? "PNG" : "JPEG";
          try {
            doc.addImage(item.photo, fmt, x, yTop, size, size);
          } catch {
            /* ignore */
          }
        }
      : undefined,
  });

  y = autoTableFinalY(doc) + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "NB : Si cahier de charges, bien vouloir le rattacher en annexe à la présente fiche.",
    margin,
    y
  );
  y += 6;
  doc.text(
    `Délais de livraison souhaité : ${format(new Date(feb.delaiLivraison), "dd MMMM yyyy", { locale: fr })}`,
    margin,
    y
  );
  y += 5;
  doc.text(`Fournisseur potentiel : ${feb.fournisseurPotentiel}`, margin, y);
  y += 6;

  // Section c — Validation
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("c. Validation de la fiche", margin, y);

  const sigRow: RowInput = [
    { content: "Demandeur", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
    { content: "Resp. Pôle Technique", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
    { content: "Responsable du Pôle", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
    { content: "Resp. Pôle Admin & Financier", styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
  ];

  const valTech = feb.validations.find((v) => v.role === "responsable_technique");
  const valPole = feb.validations.find((v) => v.role === "responsable_pole");
  const valRpaf = feb.validations.find((v) => v.role === "rpaf");

  // Cells: only show name + status text. Signatures are drawn afterward via didDrawCell.
  const cellFor = (v?: { userName: string; action: "approuvee" | "rejetee" }, fallbackPending = "En attente") => {
    if (!v) return fallbackPending;
    return `${v.userName}\n${v.action === "approuvee" ? "✓ Validé" : "✗ Rejeté"}`;
  };

  const sigDataRow = [
    feb.demandeurName,
    cellFor(valTech, feb.needsTechnicalReview ? "En attente" : "N/A"),
    cellFor(valPole),
    cellFor(valRpaf),
  ];

  // Map column index → validation step (or null for the demandeur, which has no signature image)
  const colToValidation: Array<typeof valTech | undefined | null> = [
    null, // demandeur: text only
    valTech,
    valPole,
    valRpaf,
  ];

  autoTable(doc, {
    startY: y + 2,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3, valign: "top", halign: "center", minCellHeight: 30 },
    body: [sigRow, sigDataRow],
    didDrawCell: (data) => {
      // Only data row (index 1), and only when an approved signature exists
      if (data.section !== "body" || data.row.index !== 1) return;
      const v = colToValidation[data.column.index];
      if (!v || v.action !== "approuvee" || !v.signature) return;

      const cell = data.cell;
      const padding = 2;
      const maxW = cell.width - padding * 2;
      const sigAreaH = 12; // mm reserved for signature, sits above the name text
      const x = cell.x + padding;
      const yTop = cell.y + padding;

      if (v.signature.type === "drawn") {
        try {
          // Fit centered within the available signature area
          doc.addImage(v.signature.value, "PNG", x, yTop, maxW, sigAreaH);
        } catch {
          /* ignore broken image data */
        }
      } else {
        doc.setFont("times", "italic");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(v.signature.value, cell.x + cell.width / 2, yTop + sigAreaH - 2, {
          align: "center",
        });
        // restore defaults
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 30);
      }
    },
  });

  y = autoTableFinalY(doc) + 4;
  const valRecep = feb.validations.find((v) => v.role === "supply_chain");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Réception au Pôle Operation & Supply Chain : ${valRecep ? `${valRecep.userName} — ${format(new Date(valRecep.date), "dd/MM/yyyy")}` : "_____________"}`,
    margin,
    y
  );
  y += 8;


  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "Ce document est strictement confidentiel et ne peut être partagé avec un tiers sans autorisation écrite d'un membre du Comité de Direction.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center", maxWidth: pageW - 2 * margin }
  );

  doc.save(`FEB-${feb.numero.replace(/\//g, "_")}.pdf`);
}

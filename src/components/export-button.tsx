

"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMonths, getYear, getMonth, addMonths } from "date-fns";
import { es } from "date-fns/locale";

interface ExportButtonProps {
  data: any[];
  title: string;
  filename: string;
  type: 'review' | 'advisory' | 'archived-review' | 'general-review' | 'general-advisory';
}

const formatDate = (date: any, fmt = "dd/MM/yyyy") => {
  try {
    if (!date) return "N/A";
    const dateObj = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    if (isNaN(dateObj.getTime())) return "Fecha Inválida";
    return format(dateObj, fmt, { locale: es });
  } catch {
    return "Fecha Inválida";
  }
};

const drawReviewCard = (doc: jsPDF, plan: any, startY: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const cardWidth = pageWidth - (margin * 2);
    let y = startY;

    const COLORS = { black: '#333333', gray: '#666666', green: '#16A34A', orange: '#F97316', blue: '#3B82F6', lightGrayBg: '#F9FAFB', border: '#E5E7EB' };
    
    // --- Dynamic Height Calculation ---
    let cardContentHeight = 0;
    
    const titleLines = doc.splitTextToSize(plan.titulo || "Sin Título", cardWidth - 20);
    cardContentHeight += 10; // Top padding
    cardContentHeight += 5; // Student Name
    cardContentHeight += titleLines.length * 4.5 + 6; // Title + margin

    const calculateColumnHeight = (revisor: any) => {
        if (!revisor || !revisor.nombre) return 20; // min height
        let height = 0;
        height += 4.5 + 4.5 + 8; // Revisor Name + Oficio line + padding
        height += 6; // Separator

        (revisor.observaciones || []).forEach((obs: any, index: number) => {
            height += 5 + 7; // Ciclo title + status text
            
            const boxWidth = ((cardWidth - 30) / 2) / 2 - 2;
            
            const oficio1Text = `Oficio Notif. Alumno: ${obs.oficioNotificacion || 'N/A'}`;
            const fecha1Text = `Fecha Notif. Alumno: ${formatDate(obs.fechaNotificacion)}`;
            const oficio2Text = `Oficio Notif. Docente: ${obs.oficioNotificacionLevantamiento || 'N/A'}`;
            const fecha2Text = `Fecha Notif. Docente: ${formatDate(obs.fechaNotificacionLevantamiento)}`;

            const oficio1Lines = doc.splitTextToSize(oficio1Text, boxWidth - 6);
            const fecha1Lines = doc.splitTextToSize(fecha1Text, boxWidth - 6);
            const oficio2Lines = doc.splitTextToSize(oficio2Text, boxWidth - 6);
            const fecha2Lines = doc.splitTextToSize(fecha2Text, boxWidth - 6);

            const box1Height = 8 + (oficio1Lines.length * 3.5) + (fecha1Lines.length * 3.5) + 2;
            const box2Height = 8 + (oficio2Lines.length * 3.5) + (fecha2Lines.length * 3.5) + 2;
            
            height += Math.max(box1Height, box2Height) + 8;
        });
        return height;
    };

    const revisor1Height = calculateColumnHeight(plan.revisor1);
    const revisor2Height = calculateColumnHeight(plan.revisor2);
    cardContentHeight += Math.max(revisor1Height, revisor2Height);
    cardContentHeight += 10; // Bottom padding

    if (y + cardContentHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
    }
    
    const cardStartY = y;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, cardWidth, cardContentHeight, 3, 3, "FD");

    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.black);
    doc.text(plan.estudiante.apellidosNombres || 'Nombre no disponible', margin + 10, y, { maxWidth: cardWidth - 20 });
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    doc.text(titleLines, margin + 10, y, { maxWidth: cardWidth - 20 });
    y += titleLines.length * 4.5 + 6;

    const columnStartX1 = margin + 10;
    const columnStartX2 = margin + 10 + (cardWidth - 20) / 2 + 5;
    const columnWidth = (cardWidth - 30) / 2;

    const drawRevisorColumn = (revisor: any, startX: number, startY: number): number => {
        let currentY = startY;
        if (!revisor || !revisor.nombre) return currentY;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(COLORS.black);
        doc.text(revisor.nombre || 'Revisor no asignado', startX, currentY);
        currentY += 4.5;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(COLORS.gray);
        doc.text(`Oficio Designación: ${revisor.oficioDesignacion || 'N/A'}`, startX, currentY, { maxWidth: columnWidth });
        currentY += 4.5;
        doc.text(`Fecha Asignación: ${formatDate(plan.submissionDate)}`, startX, currentY, { maxWidth: columnWidth });
        currentY += 8;

        doc.setDrawColor(230, 230, 230);
        doc.line(startX, currentY, startX + columnWidth, currentY);
        currentY += 6;

        (revisor.observaciones || []).forEach((obs: any, index: number) => {
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(COLORS.black);
            doc.text(`Ciclo de Observación ${index + 1}`, startX, currentY);
            currentY += 5;
            
            let statusColor = COLORS.blue;
            let statusText = 'Pendiente: El docente debe responder al levantamiento del alumno';
            if (obs.fechaNotificacion && !obs.fechaNotificacionLevantamiento) {
                statusColor = COLORS.orange;
                statusText = 'Pendiente: El alumno debe revisar la observación del docente';
            }

            doc.setFontSize(8);
            doc.setTextColor(statusColor);
            doc.text(statusText, startX, currentY, { maxWidth: columnWidth });
            currentY += 7;

            const boxStartY = currentY;
            const boxWidth = (columnWidth / 2) - 2;
            
            const drawInfoBox = (label: string, oficioLabel: string, oficioValue: string, fechaLabel: string, fechaValue: string, x: number, y: number) => {
                const oficioLines = doc.splitTextToSize(`${oficioLabel}: ${oficioValue || 'N/A'}`, boxWidth - 6);
                const fechaLines = doc.splitTextToSize(`${fechaLabel}: ${formatDate(fechaValue)}`, boxWidth - 6);
                const height = 8 + (oficioLines.length * 3.5) + (fechaLines.length * 3.5) + 2;

                doc.setFillColor(COLORS.lightGrayBg);
                doc.setDrawColor(COLORS.border);
                doc.roundedRect(x, y, boxWidth, height, 2, 2, 'FD');
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(COLORS.black);
                doc.text(label, x + 3, y + 4);
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(COLORS.gray);
                doc.text(oficioLines, x + 3, y + 10, { maxWidth: boxWidth - 6 });
                doc.text(fechaLines, x + 3, y + 10 + (oficioLines.length * 3.5), { maxWidth: boxWidth - 6 });
                return height;
            };

            const obsHeight = drawInfoBox("Observación", "Oficio Notif. Alumno", obs.oficioNotificacion, "Fecha Notif. Alumno", obs.fechaNotificacion, startX, boxStartY);
            const levHeight = drawInfoBox("Levantamiento", "Oficio Notif. Docente", obs.oficioNotificacionLevantamiento, "Fecha Notif. Docente", obs.fechaNotificacionLevantamiento, startX + boxWidth + 4, boxStartY);
            
            currentY += Math.max(obsHeight, levHeight) + 8;
        });
        return currentY;
    };

    drawRevisorColumn(plan.revisor1, columnStartX1, y);
    drawRevisorColumn(plan.revisor2, columnStartX2, y);
    
    return cardStartY + cardContentHeight;
};

const drawAdvisoryCard = (doc: jsPDF, plan: any, startY: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const cardWidth = pageWidth - (margin * 2);
    let y = startY;

    const COLORS = { black: '#333333', gray: '#666666', green: '#16A34A', lightGrayBg: '#F9FAFB', border: '#E5E7EB' };
    const showFinalReviews = plan.apaAprobado || plan.listoParaTurnitin || plan.turnitin1?.fecha;


    // --- Dynamic Height Calculation ---
    const titleLines = doc.splitTextToSize(plan.titulo || "Sin Título", cardWidth - 20);
    let cardContentHeight = 10; // Top padding
    cardContentHeight += 5; // Student Name
    cardContentHeight += titleLines.length * 4.5 + 4; // Title
    cardContentHeight += 18; // Advisory info
    if (plan.observaciones) {
        const obsLines = doc.splitTextToSize(plan.observaciones, cardWidth - 20);
        cardContentHeight += 4 + obsLines.length * 4 + 4; // obs title + lines + margin
    }
    cardContentHeight += 8 + 6 + 20; // Timeline section (separator + title + timeline)
    
    if (showFinalReviews) {
        cardContentHeight += 8 + 6 + 6; // Final reviews section (separator + title + content)
    }
    cardContentHeight += 5; // Bottom padding

    if (y + cardContentHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
    }

    const cardStartY = y;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, cardWidth, cardContentHeight, 3, 3, "FD");

    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.black);
    doc.text(plan.estudiante.apellidosNombres || 'Nombre no disponible', margin + 10, y, { maxWidth: cardWidth - 20 });
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.gray);
    doc.text(titleLines, margin + 10, y, { maxWidth: cardWidth - 20 });
    y += titleLines.length * 4.5 + 4;

    doc.setFontSize(8);
    doc.text(`Asesor: ${plan.asesor?.nombre || 'N/A'} ${plan.asesor?.apellidos || ''}`, margin + 10, y);
    doc.text(`Supervisor: ${plan.supervisorAsesores?.nombre || 'N/A'} ${plan.supervisorAsesores?.apellidos || ''}`, margin + cardWidth/2, y);
    y += 5;
    doc.text(`Fecha Asignación: ${formatDate(plan.submissionDate)}`, margin + 10, y);
    doc.text(`Fecha Vencimiento: ${formatDate(plan.fechaVencimientoAsesoria)}`, margin + cardWidth/2, y);
    y += 5;
    doc.text(`Etapa Actual: ${plan.etapaActual || 'N/A'}`, margin + 10, y);
    y += 5;

    if (plan.observaciones) {
        doc.setFont("helvetica", "bold");
        doc.text("Observaciones:", margin + 10, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        const obsLines = doc.splitTextToSize(plan.observaciones, cardWidth - 20);
        doc.text(obsLines, margin + 10, y);
        y += obsLines.length * 4 + 4;
    }
    
    doc.setDrawColor(COLORS.border);
    doc.line(margin + 5, y, margin + cardWidth - 5, y);
    y += 8;

    // Timeline
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Línea de Tiempo de Asistencia", margin + 10, y);
    y += 6;

    const startDate = new Date(plan.submissionDate);
    const endDate = new Date(plan.fechaVencimientoAsesoria);
    const totalMonths = differenceInMonths(endDate, startDate) || 1;
    const attendedMonths = new Set((plan.asistencias || []).map((d:string) => `${getYear(new Date(d))}-${getMonth(new Date(d))}`));

    const timelineWidth = cardWidth - 20;
    const monthBoxWidth = Math.min(20, timelineWidth / totalMonths) - 2;

    for (let i = 0; i < totalMonths; i++) {
        const monthDate = addMonths(startDate, i);
        const monthKey = `${getYear(monthDate)}-${getMonth(monthDate)}`;
        const hasAttended = attendedMonths.has(monthKey);
        const xPos = margin + 10 + i * (monthBoxWidth + 2);

        doc.setFillColor(hasAttended ? COLORS.green : COLORS.lightGrayBg);
        doc.setDrawColor(hasAttended ? COLORS.green : COLORS.border);
        doc.roundedRect(xPos, y, monthBoxWidth, 8, 2, 2, "FD");
        
        if (hasAttended) {
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("✓", xPos + monthBoxWidth/2, y + 5.5, { align: 'center' });
        }
        
        doc.setFontSize(7);
        doc.setTextColor(COLORS.gray);
        doc.text(format(monthDate, "MMM", { locale: es }), xPos + monthBoxWidth / 2, y + 13, { align: 'center' });
    }
    y += 20;

    // Final Reviews (Conditional)
    if (showFinalReviews) {
      doc.setDrawColor(COLORS.border);
      doc.line(margin + 5, y, margin + cardWidth - 5, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Revisiones Finales", margin + 10, y);
      y += 6;

      const isTurnitinApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';
      
      doc.setFontSize(8);
      doc.setTextColor(COLORS.black);
      doc.text(`Formato APA: `, margin + 10, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(plan.apaAprobado ? COLORS.green : COLORS.gray);
      doc.text(plan.apaAprobado ? 'APROBADO' : 'PENDIENTE', margin + 35, y);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.black);
      doc.text(`Análisis Turnitin: `, margin + cardWidth/2, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isTurnitinApproved ? COLORS.green : COLORS.gray);
      doc.text(isTurnitinApproved ? 'APROBADO' : 'PENDIENTE', margin + cardWidth/2 + 30, y);
    }


    return cardStartY + cardContentHeight + 5;
};

export function ExportButton({ data, title, filename, type }: ExportButtonProps) {
  const { toast } = useToast();

  const handleExport = () => {
    if (data.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay datos",
        description: "No hay datos para exportar.",
      });
      return;
    }

    const doc = new jsPDF({ orientation: "portrait" });
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de Reporte: ${format(new Date(), "PPP", { locale: es })}`, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
    y += 12;

    data.forEach((item, index) => {
      if (index > 0) y += 5; // Margin between cards
      
      let cardDrawer;
      switch(type) {
        case 'review':
        case 'archived-review':
        case 'general-review':
          cardDrawer = drawReviewCard;
          break;
        case 'advisory':
          cardDrawer = drawAdvisoryCard;
          break;
        // Add other cases here if needed
        default:
          cardDrawer = (d: any, p: any, cY: any) => cY + 10; // Default drawer
      }
      y = cardDrawer(doc, item, y);
    });
    
    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Button onClick={handleExport} disabled={data.length === 0}>
      <Printer className="mr-2 h-4 w-4" />
      Exportar a PDF
    </Button>
  );
}

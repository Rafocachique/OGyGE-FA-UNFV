

"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { PlanWithDetails } from "@/app/dashboard/thesis-review/page";
import { Docente, User, ThesisPlanObservation } from "@/lib/types";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneralDataTableProps {
  plans: PlanWithDetails[];
}

const formatDate = (date: any) => {
    try {
        if (!date) return "N/A";
        return format(new Date(date.seconds ? date.seconds * 1000 : date), "dd/MM/yyyy");
    } catch {
        return "Inválido";
    }
}

export function GeneralDataTable({ plans }: GeneralDataTableProps) {
  const { toast } = useToast();

  const countObservaciones = (observaciones: ThesisPlanObservation[] = []) => {
    return observaciones.filter(obs => obs.oficioNotificacion && obs.fechaNotificacion).length;
  };

  const countLevantamientos = (observaciones: ThesisPlanObservation[] = []) => {
      return observaciones.filter(obs => obs.oficioNotificacionLevantamiento && obs.fechaNotificacionLevantamiento).length;
  };
  
  const handleExport = () => {
    if (plans.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay datos",
        description: "No hay datos en la tabla para exportar.",
      });
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Títulos
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Reporte General de Revisión de Planes de Tesis", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Reporte: ${format(new Date(), 'PPP', { locale: es })}`, pageWidth / 2, 26, { align: 'center' });

    const tableColumn = [
        "Ítem", "Sup. Revisores", "F. Asignación", "Alumno", "Título", "Especialidad",
        "Revisor 1", "Obs. R1", "Lev. R1", "F. Aprob. R1", "Estado R1",
        "Revisor 2", "Obs. R2", "Lev. R2", "F. Aprob. R2", "Estado R2",
        "Estado Global", "F. Vencimiento", "Días Rest."
    ];
    
    const tableRows: any[] = [];

    plans.forEach((plan, index) => {
      const planData = [
        index + 1,
        `${plan.supervisorRevisores?.nombre || ''} ${plan.supervisorRevisores?.apellidos || ''}`,
        formatDate(plan.submissionDate),
        plan.estudiante.apellidosNombres,
        plan.titulo,
        plan.estudiante.especialidad,
        plan.revisor1?.nombre || 'N/A',
        countObservaciones(plan.revisor1?.observaciones),
        countLevantamientos(plan.revisor1?.observaciones),
        formatDate(plan.revisor1?.fechaAprobado),
        plan.revisor1?.estado || "N/A",
        plan.revisor2?.nombre || "N/A",
        countObservaciones(plan.revisor2?.observaciones),
        countLevantamientos(plan.revisor2?.observaciones),
        formatDate(plan.revisor2?.fechaAprobado),
        plan.revisor2?.estado || "N/A",
        plan.estadoGlobal,
        formatDate(plan.vencimientoRevision),
        plan.diasRestantesRevision?.toString() ?? 'N/A',
      ];
      tableRows.push(planData);
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 8,
            lineColor: [0, 0, 0], 
            lineWidth: 0.1
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
            halign: 'center',
            valign: 'middle',
            lineColor: [0, 0, 0], 
            lineWidth: 0.1,
            minCellHeight: 10,
        },
        columnStyles: {
            4: { cellWidth: 40 }, // Título
        }
    });

    doc.save(`reporte_revisiones_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
        <div className="flex justify-end">
            <Button onClick={handleExport} disabled={plans.length === 0}>
                <Printer className="mr-2 h-4 w-4" />
                Exportar Todo a PDF
            </Button>
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="border rounded-lg">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Sup. Revisores</TableHead>
                    <TableHead>Fecha Asignación</TableHead>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Especialidad</TableHead>
                    
                    <TableHead>Revisor 1</TableHead>
                    <TableHead>Obs. Rev.1</TableHead>
                    <TableHead>Lev. Rev.1</TableHead>
                    <TableHead>Fecha Aprob. Rev.1</TableHead>
                    <TableHead>Estado Rev.1</TableHead>

                    <TableHead>Revisor 2</TableHead>
                    <TableHead>Obs. Rev.2</TableHead>
                    <TableHead>Lev. Rev.2</TableHead>
                    <TableHead>Fecha Aprob. Rev.2</TableHead>
                    <TableHead>Estado Rev.2</TableHead>
                    
                    <TableHead>Estado Global</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead>Días Restantes</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {plans.map((plan, index) => {

                    return (
                        <TableRow key={plan.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{plan.supervisorRevisores?.nombre} {plan.supervisorRevisores?.apellidos}</TableCell>
                            <TableCell>{formatDate(plan.submissionDate)}</TableCell>
                            <TableCell className="font-medium">{plan.estudiante.apellidosNombres}</TableCell>
                            <TableCell className="max-w-xs whitespace-normal">{plan.titulo}</TableCell>
                            <TableCell>{plan.estudiante.especialidad}</TableCell>
                            
                            <TableCell>{plan.revisor1?.nombre || "N/A"}</TableCell>
                            <TableCell>{countObservaciones(plan.revisor1?.observaciones)}</TableCell>
                            <TableCell>{countLevantamientos(plan.revisor1?.observaciones)}</TableCell>
                            <TableCell>{formatDate(plan.revisor1?.fechaAprobado)}</TableCell>
                            <TableCell>
                                <Badge variant={plan.revisor1?.estado === "APROBADO" ? "default" : "secondary"}>
                                    {plan.revisor1?.estado || "N/A"}
                                </Badge>
                            </TableCell>

                            <TableCell>{plan.revisor2?.nombre || "N/A"}</TableCell>
                            <TableCell>{countObservaciones(plan.revisor2?.observaciones)}</TableCell>
                            <TableCell>{countLevantamientos(plan.revisor2?.observaciones)}</TableCell>
                            <TableCell>{formatDate(plan.revisor2?.fechaAprobado)}</TableCell>
                            <TableCell>
                                <Badge variant={plan.revisor2?.estado === "APROBADO" ? "default" : "secondary"}>
                                    {plan.revisor2?.estado || "N/A"}
                                </Badge>
                            </TableCell>

                            <TableCell>
                                <Badge variant={plan.estadoGlobal === "LISTO PARA ASESOR" ? "default" : "outline"}>
                                    {plan.estadoGlobal}
                                </Badge>
                            </TableCell>
                            <TableCell>{formatDate(plan.vencimientoRevision)}</TableCell>
                            <TableCell>
                                <Badge variant={plan.diasRestantesRevision !== undefined && plan.diasRestantesRevision < 0 ? "destructive" : "outline"}>
                                    {plan.diasRestantesRevision}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )
                })}
                {plans.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={19} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
             <ScrollBar orientation="horizontal" />
        </ScrollArea>
    </div>
  );
}

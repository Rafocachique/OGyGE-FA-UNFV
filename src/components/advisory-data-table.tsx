

"use client";

import { useState, useMemo, Fragment } from "react";
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
import { PlanAsesoriaConDetalles } from "@/app/dashboard/advisories/page";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdvisoryDataTableProps {
  plans: PlanAsesoriaConDetalles[];
}

const formatDate = (date: any) => {
    try {
        if (!date) return "N/A";
        return format(new Date(date.seconds ? date.seconds * 1000 : date), "dd/MM/yyyy");
    } catch {
        return "Inválido";
    }
}

const getTurnitinStatusText = (plan: PlanAsesoriaConDetalles) => {
    if (plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO') return "APROBADO";
    if (plan.turnitin2?.estado === 'DESAPROBADO') return "DESAPROBADO";
    if (plan.turnitin1?.estado === 'DESAPROBADO') return "OBSERVADO";
    return "PENDIENTE";
}

export function AdvisoryDataTable({ plans }: AdvisoryDataTableProps) {
  const { toast } = useToast();

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

    // --- Títulos ---
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Reporte General de Avance de Asesorías", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Reporte: ${format(new Date(), 'PPP', { locale: es })}`, pageWidth / 2, 26, { align: 'center' });
    
    const tableColumn = [
        "Ítem", "Sup. Asesores", "Modalidad", "Alumno", "Título", "Especialidad", "Asesor", 
        "F. Asignación", "F. Vencimiento", "Estado APA", "Estado Turnitin", 
        "Observaciones", "F. Aprob. Final", "Días Rest.", "Estado Global"
    ];
    
    const tableRows: any[] = [];

    plans.forEach((plan, index) => {
      const vencimiento = plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento 
          ? plan.ampliacion.fechaNuevoVencimiento
          : plan.fechaVencimientoAsesoria;
          
      const planData = [
        index + 1,
        `${plan.supervisorAsesores?.nombre || ''} ${plan.supervisorAsesores?.apellidos || ''}`,
        plan.modalidad || "N/A",
        plan.estudiante.apellidosNombres,
        plan.titulo,
        plan.estudiante.especialidad,
        `${plan.asesor?.nombre || ''} ${plan.asesor?.apellidos || ''}`,
        formatDate(plan.submissionDate),
        formatDate(vencimiento),
        plan.apaAprobado ? "APROBADO" : "PENDIENTE",
        getTurnitinStatusText(plan),
        plan.observaciones || "N/A",
        formatDate(plan.fechaAprobacionAsesoria),
        plan.diasRestantesAsesoria?.toString() ?? 'N/A',
        plan.estadoGlobal,
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
            cellPadding: 1.5,
            halign: 'center',
            valign: 'middle',
            lineColor: [0, 0, 0], 
            lineWidth: 0.1
        },
        columnStyles: {
            4: { halign: 'left', cellWidth: 50 }, // Título
        }
    });

    doc.save(`reporte_asesorias_${new Date().toISOString().split('T')[0]}.pdf`);
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
                    <TableHead>Sup. Asesores</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Especialidad</TableHead>
                    
                    <TableHead>Asesor</TableHead>
                    
                    <TableHead>Fecha Asignación</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead>Estado APA</TableHead>
                    <TableHead>Estado Turnitin</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead>Fecha Aprobación Final</TableHead>
                    <TableHead>Días Restantes</TableHead>
                    <TableHead>Estado Global</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {plans.map((plan, index) => {
                    const vencimiento = plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento 
                        ? plan.ampliacion.fechaNuevoVencimiento
                        : plan.fechaVencimientoAsesoria;

                    return (
                        <TableRow key={plan.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{plan.supervisorAsesores?.nombre} {plan.supervisorAsesores?.apellidos}</TableCell>
                            <TableCell>
                                {plan.modalidad && <Badge variant="outline">{plan.modalidad}</Badge>}
                            </TableCell>
                            <TableCell className="font-medium">{plan.estudiante.apellidosNombres}</TableCell>
                            <TableCell className="max-w-xs whitespace-normal">{plan.titulo}</TableCell>
                            <TableCell>{plan.estudiante.especialidad}</TableCell>
                            
                            <TableCell>{plan.asesor?.nombre} {plan.asesor?.apellidos}</TableCell>

                            <TableCell>{formatDate(plan.submissionDate)}</TableCell>
                            <TableCell>{formatDate(vencimiento)}</TableCell>
                            <TableCell>
                                {plan.apaAprobado ? <Badge className="bg-green-100 text-green-800">APROBADO</Badge> : <Badge variant="outline">PENDIENTE</Badge>}
                            </TableCell>
                            <TableCell>
                                <Badge className={cn(
                                    "text-xs",
                                    getTurnitinStatusText(plan) === 'APROBADO' && "bg-green-100 text-green-800",
                                    getTurnitinStatusText(plan) === 'OBSERVADO' && "bg-yellow-100 text-yellow-800",
                                    getTurnitinStatusText(plan) === 'DESAPROBADO' && "bg-red-100 text-red-800",
                                )}>{getTurnitinStatusText(plan)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs whitespace-pre-wrap">{plan.observaciones}</TableCell>
                            <TableCell>{formatDate(plan.fechaAprobacionAsesoria)}</TableCell>
                            <TableCell>
                                <Badge variant={plan.diasRestantesAsesoria !== undefined && plan.diasRestantesAsesoria < 0 ? "destructive" : "outline"}>
                                    {plan.diasRestantesAsesoria}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge className={cn(
                                    "border-none",
                                    plan.estadoGlobal === 'CULMINADO' && "bg-green-100 text-green-800",
                                    plan.estadoGlobal === 'EN ASESORIA' && "bg-indigo-100 text-indigo-800",
                                    plan.estadoGlobal === 'DESAPROBADO' && "bg-red-100 text-red-800"
                                    )}>
                                    {plan.estadoGlobal}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )
                })}
                {plans.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={15} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell>
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

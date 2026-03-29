

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  FileText,
  FileCheck2,
  Hourglass,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { PlanWithDetails } from "@/app/dashboard/thesis-review/page";
import { cn } from "@/lib/utils";
import { ThesisPlanObservation } from "@/lib/types";
import { Separator } from "./ui/separator";
import { ExportButton } from "./export-button";


const formatDate = (date: any) => {
    try {
        if (!date) return "N/A";
        const dateObj = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return format(dateObj, "dd/MM/yyyy");
    } catch {
        return "Fecha Inválida";
    }
}

const ObservationCycle = ({ obs, cycleNumber }: { obs: ThesisPlanObservation, cycleNumber: number }) => {
    let status = "";
    let statusColor = "";
    let statusIcon: React.ReactNode;
    let statusText = "";

    const hasObservation = obs.fechaNotificacion;
    const hasCorrection = obs.fechaNotificacionLevantamiento;
    const isApprovedByDocente = obs.description === 'Subsanado';

    if (hasObservation && !hasCorrection) {
        status = "Pendiente: El alumno debe revisar la observación del docente";
        statusColor = "text-orange-600";
        statusIcon = <Hourglass className="h-4 w-4" />;
        statusText = "El docente registró una observación. Se espera el levantamiento del alumno.";
    } else if (hasObservation && hasCorrection && !isApprovedByDocente) {
        status = "Pendiente: El docente debe responder al levantamiento del alumno";
        statusColor = "text-blue-600";
        statusIcon = <Clock className="h-4 w-4" />;
        statusText = "El alumno respondió. Se espera la aprobación del levantamiento por el docente.";
    } else if (isApprovedByDocente) {
        status = "Observación Subsanada";
        statusColor = "text-green-600";
        statusIcon = <CheckCircle2 className="h-4 w-4" />;
        statusText = "El docente aprobó el levantamiento de la observación.";
    }

    if (!status) return null;

    return (
        <div className="flex gap-4">
            <div className="relative">
                <div className="h-full w-px bg-border absolute left-3 top-0"></div>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center bg-background border-2 z-10 relative", statusColor.replace('text-', 'border-'))}>
                   {statusIcon}
                </div>
            </div>
            <div className="flex-1 pb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold">{`Ciclo de Observación ${cycleNumber}`}</p>
                        <p className={`text-sm font-medium ${statusColor}`}>{status}</p>
                        <p className="text-xs text-muted-foreground">{statusText}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2 p-3 rounded-md bg-muted/50 border">
                        <p className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> Observación</p>
                        <p><strong>Oficio Notif. Alumno:</strong> {obs.oficioNotificacion || "N/A"}</p>
                        <p><strong>Fecha Notif. Alumno:</strong> {formatDate(obs.fechaNotificacion)}</p>
                    </div>
                    <div className="space-y-2 p-3 rounded-md bg-muted/50 border">
                         <p className="font-semibold flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-green-500" /> Levantamiento</p>
                         <p><strong>Oficio Notif. Docente:</strong> {obs.oficioNotificacionLevantamiento || "N/A"}</p>
                         <p><strong>Fecha Notif. Docente:</strong> {formatDate(obs.fechaNotificacionLevantamiento)}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

const RevisorCard = ({ plan, revisorKey }: { plan: PlanWithDetails; revisorKey: "revisor1" | "revisor2" }) => {
    const revisorData = plan[revisorKey];
    if (!revisorData) return null;

    const isApproved = revisorData.estado === 'APROBADO';

    return(
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>{revisorKey === 'revisor1' ? 'Revisor 1' : 'Revisor 2'}: {revisorData.nombre}</span>
                    {isApproved ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">APROBADO</Badge>
                    ) : (
                        <Badge variant="outline">En Proceso</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    <strong>Oficio Designación:</strong> {revisorData.oficioDesignacion || 'N/A'} | <strong>Fecha Asignación:</strong> {formatDate(plan.submissionDate)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Separator className="mb-4"/>
                {isApproved ? (
                     <div className="text-center text-muted-foreground p-4">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-green-500"/>
                        <p className="mt-2 font-semibold">Revisión completada y aprobada el {formatDate(revisorData.fechaAprobado)}.</p>
                     </div>
                ) : (
                    revisorData.observaciones && revisorData.observaciones.length > 0 ? (
                        <div className="relative">
                           {revisorData.observaciones.map((obs, index) => (
                               <ObservationCycle key={obs.id} obs={obs} cycleNumber={index + 1} />
                           ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground p-4">
                            <p>No hay observaciones registradas para este revisor.</p>
                        </div>
                    )
                )}
            </CardContent>
        </Card>
    )
}


export function RegisteredDataView({ plans }: { plans: PlanWithDetails[] }) {

  if (plans.length === 0) {
      return <p className="text-muted-foreground text-center py-8">No hay datos para mostrar.</p>;
  }

  return (
    <div className="space-y-4">
       <div className="flex justify-end">
        <ExportButton
          data={plans}
          title="Reporte de Planes en Revisión"
          filename="reporte_planes_en_revision"
          type="review"
        />
      </div>
      <div className="border rounded-lg">
        {/* Header */}
        <div className="flex items-center px-4 py-2 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
            <div className="w-12 flex-shrink-0 px-2">Ítem</div>
            <div className="flex-1 px-2">Alumno y Título del Plan</div>
            <div className="w-48 px-2">Supervisor</div>
            <div className="w-36 px-2">Días Restantes</div>
            <div className="w-12 px-2 text-right">Ver</div>
        </div>

        {/* Body */}
        {plans.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {plans.map((plan, index) => {
              return (
                 <AccordionItem value={plan.id} key={plan.id} className="border-b last:border-b-0">
                    <div className={cn("flex items-center px-4 text-sm w-full")}>
                        <div className="w-12 flex-shrink-0 py-4 px-2">
                          {index + 1}
                        </div>
                        <div className="flex flex-1 items-center min-w-0">
                            <div className="flex-1 px-2">
                              <p className="font-medium">{plan.estudiante.apellidosNombres}</p>
                              <p className="text-muted-foreground text-xs">{plan.titulo}</p>
                            </div>
                            <div className="w-48 px-2 truncate">{plan.supervisorRevisores?.nombre} {plan.supervisorRevisores?.apellidos || ''}</div>
                            <div className="w-36 px-2">
                                <Badge variant={plan.diasRestantesRevision !== undefined && plan.diasRestantesRevision < 0 ? "destructive" : "outline"}>
                                    {plan.diasRestantesRevision}
                                </Badge>
                            </div>
                        </div>
                        <AccordionTrigger className="w-12 py-4 px-2 justify-end hover:no-underline [&>svg]:size-4">
                        </AccordionTrigger>
                    </div>
                  <AccordionContent>
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-muted/30">
                        <RevisorCard plan={plan} revisorKey="revisor1" />
                        <RevisorCard plan={plan} revisorKey="revisor2" />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="text-center text-sm text-muted-foreground h-24 flex items-center justify-center">
            No hay datos de revisión para mostrar.
          </div>
        )}
      </div>
    </div>
  );
}

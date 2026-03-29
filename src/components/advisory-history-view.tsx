

"use client";

import { PlanAsesoriaConDetalles } from "@/app/dashboard/advisories/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  FileText,
  FileCheck2,
  CalendarDays,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Check,
} from "lucide-react";
import { format, differenceInMonths, formatDistanceToNowStrict, getMonth, getYear, addMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { ExportButton } from "./export-button";


const formatDate = (date: any, fmt = "dd/MM/yyyy") => {
  try {
    if (!date) return "N/A";
    const dateObj =
      date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return format(dateObj, fmt, { locale: es });
  } catch {
    return "Fecha Inválida";
  }
};

const Milestone = ({ title, value, icon: Icon }: { title: string, value: string | React.ReactNode, icon: React.ElementType }) => (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-sm text-muted-foreground">{value}</p>
        </div>
    </div>
);

const AttendanceTimeline = ({ plan }: { plan: PlanAsesoriaConDetalles }) => {
    const startDate = new Date(plan.submissionDate);
    const endDate = (plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento)
        ? new Date(plan.ampliacion.fechaNuevoVencimiento)
        : new Date(plan.fechaVencimientoAsesoria);
    
    let totalMonths = differenceInMonths(endDate, startDate);
    totalMonths = totalMonths > 0 ? totalMonths : 1;

    const attendedMonths = new Set(
        (plan.asistencias || []).map(dateString => {
            const d = new Date(dateString);
            return `${getYear(d)}-${getMonth(d)}`;
        })
    );

    const months = Array.from({ length: totalMonths }, (_, i) => {
        const monthDate = addMonths(startDate, i);
        const monthKey = `${getYear(monthDate)}-${getMonth(monthDate)}`;
        const hasAttended = attendedMonths.has(monthKey);
        return {
            date: monthDate,
            attended: hasAttended,
        };
    });

    return (
        <div>
            <p className="text-sm font-medium mb-3">Línea de Tiempo de Asistencia ({totalMonths} meses)</p>
            <TooltipProvider>
                <div className="flex flex-wrap gap-2">
                    {months.map((month, index) => (
                        <div key={index} className="flex flex-col items-center gap-1 w-10">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "h-6 w-6 rounded-full flex items-center justify-center border-2",
                                        month.attended ? "bg-green-500 border-green-600" : "bg-muted border-border"
                                    )}>
                                        {month.attended && <Check className="h-4 w-4 text-white" />}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="capitalize">{format(month.date, "MMMM yyyy", { locale: es })}</p>
                                    <p>{month.attended ? "Asistencia Registrada" : "Sin Asistencia"}</p>
                                </TooltipContent>
                            </Tooltip>
                            <p className="text-xs text-muted-foreground capitalize">{format(month.date, "MMM", { locale: es })}</p>
                        </div>
                    ))}
                </div>
            </TooltipProvider>
        </div>
    );
};


const AdvisoryProcessView = ({ plan }: { plan: PlanAsesoriaConDetalles }) => {
    const showFinalReviews = plan.apaAprobado || plan.listoParaTurnitin || plan.turnitin1?.fecha;
    const isTurnitinProcessApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';


    return (
        <Card className="border-l-4 border-indigo-500">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Progreso Actual de la Asesoría</CardTitle>
                    <Badge variant="outline">{plan.etapaActual || "Etapa no definida"}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Milestone title="Resolución Decanal" value={plan.resolucionDecanalAsesoria || "N/A"} icon={FileText}/>
                    <Milestone title="Oficio de Asignación de Asesoría" value={plan.oficioAsesoria || "N/A"} icon={FileCheck2}/>
                    <Milestone title="Fecha de Asignación" value={formatDate(plan.submissionDate)} icon={CalendarDays}/>
                    <Milestone title="Fecha de Vencimiento" value={formatDate(plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento ? plan.ampliacion.fechaNuevoVencimiento : plan.fechaVencimientoAsesoria)} icon={CalendarDays}/>
                    <Milestone title="Días Restantes" value={plan.diasRestantesAsesoria?.toString() ?? 'N/A'} icon={Clock}/>
                </div>

                 {plan.observaciones && (
                    <>
                        <Separator />
                        <div>
                            <h4 className="font-semibold text-sm mb-2">Observaciones o Comentarios</h4>
                            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md border">{plan.observaciones}</p>
                        </div>
                    </>
                 )}

                <Separator />
                <AttendanceTimeline plan={plan} />
                
                {showFinalReviews && (
                    <>
                        <Separator />
                        <div>
                             <h4 className="font-semibold text-sm mb-2">Revisiones Finales</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-3 border rounded-lg bg-muted/50 flex flex-col justify-between space-y-1">
                                    <p className="font-medium text-xs">Formato APA</p>
                                    {plan.apaAprobado ? <Badge className="bg-green-100 text-green-800 w-fit">APROBADO</Badge> : <Badge variant="outline" className="w-fit">PENDIENTE</Badge>}
                                </div>
                                <div className="p-3 border rounded-lg bg-muted/50 flex flex-col justify-between space-y-1">
                                    <p className="font-medium text-xs">Envío a Turnitin</p>
                                    {plan.listoParaTurnitin ? <Badge className="bg-blue-100 text-blue-800 w-fit">ENVIADO</Badge> : <Badge variant="outline" className="w-fit">PENDIENTE</Badge>}
                                </div>
                                 <div className="p-3 border rounded-lg bg-muted/50 flex flex-col justify-between space-y-1">
                                    <p className="font-medium text-xs">Análisis Turnitin</p>
                                    {isTurnitinProcessApproved 
                                        ? <Badge className="bg-green-100 text-green-800 w-fit">APROBADO</Badge> 
                                        : (plan.turnitin1?.estado === 'DESAPROBADO' ? <Badge className="bg-yellow-100 text-yellow-800 w-fit">OBSERVADO</Badge> : <Badge variant="outline" className="w-fit">PENDIENTE</Badge>)
                                    }
                                </div>
                             </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

const AdvisoryResultView = ({ plan, isApproved }: { plan: PlanAsesoriaConDetalles; isApproved: boolean }) => {
    const title = isApproved ? "Asesoría Culminada y Aprobada" : "Asesoría Desaprobada";
    const date = isApproved ? plan.fechaAprobacionAsesoria : plan.actualizadoEn;
    const dateLabel = isApproved ? "Fecha de Aprobación" : "Fecha de Última Actualización";
    const Icon = isApproved ? CheckCircle2 : AlertCircle;
    const colorClass = isApproved ? "green" : "red";

    return (
         <Card className={`border-l-4 border-${colorClass}-500`}>
             <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
                     <Icon className={`h-16 w-16 text-${colorClass}-500`} />
                     <p className="text-lg font-semibold">
                         {isApproved 
                            ? `La asesoría fue marcada como culminada el ${formatDate(date)}.`
                            : "Esta asesoría ha sido marcada como desaprobada."
                         }
                     </p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Milestone title="Resolución Decanal" value={plan.resolucionDecanalAsesoria || "N/A"} icon={FileText}/>
                    <Milestone title="Oficio de Asignación de Asesoría" value={plan.oficioAsesoria || "N/A"} icon={FileCheck2}/>
                    <Milestone title={dateLabel} value={formatDate(date)} icon={CalendarDays}/>
                </div>
            </CardContent>
        </Card>
    )
}


export function AdvisoryHistoryView({
  plans,
}: {
  plans: PlanAsesoriaConDetalles[];
}) {

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
        <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          No hay planes de tesis en esta categoría.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton
          data={plans}
          title="Reporte de Avance de Asesorías"
          filename="reporte_asesorias"
          type="advisory"
        />
      </div>
      <Accordion type="multiple" className="w-full space-y-2">
        {plans.map((plan) => (
          <AccordionItem value={plan.id} key={plan.id} className="border rounded-lg">
            <AccordionTrigger className="p-4 hover:no-underline">
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col text-left">
                  <div className="font-semibold">
                    {plan.estudiante.apellidosNombres}
                  </div>
                  <div className="truncate max-w-xs text-sm text-muted-foreground">
                    {plan.titulo}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {plan.modalidad && (
                      <Badge
                          variant="outline"
                          className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-900/20"
                      >
                          {plan.modalidad}
                      </Badge>
                  )}
                  {plan.supervisorAsesores && (
                    <Badge
                      variant="outline"
                      className="border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:text-teal-400 dark:bg-teal-900/20"
                    >
                      Sup: {plan.supervisorAsesores.nombre}{" "}
                      {plan.supervisorAsesores.apellidos}
                    </Badge>
                  )}
                  {plan.asesor && (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-900/20"
                    >
                      Ase: {plan.asesor.nombre} {plan.asesor.apellidos}
                    </Badge>
                  )}
                  <Badge
                    className={cn(
                      "border-none",
                      plan.estadoGlobal === "CULMINADO" &&
                        "bg-green-100 text-green-800",
                      plan.estadoGlobal === "EN ASESORIA" &&
                        "bg-indigo-100 text-indigo-800",
                      plan.estadoGlobal === "DESAPROBADO" &&
                        "bg-red-100 text-red-800"
                    )}
                  >
                    {plan.estadoGlobal}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="p-4 border-t bg-muted/20">
                  {plan.estadoGlobal === 'EN ASESORIA' && <AdvisoryProcessView plan={plan} />}
                  {plan.estadoGlobal === 'CULMINADO' && <AdvisoryResultView plan={plan} isApproved={true} />}
                  {plan.estadoGlobal === 'DESAPROBADO' && <AdvisoryResultView plan={plan} isApproved={false} />}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}


"use client";

import { PlanWithDetails } from "@/app/dashboard/thesis-review/page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Archive, CheckCircle2, Clock, CalendarDays, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExportButton } from "./export-button";

const formatDate = (date: any, fmt = "dd/MM/yyyy") => {
    try {
        if (!date) return "N/A";
        // Handle both Firestore timestamp objects and ISO strings correctly
        const dateObj = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        if (isNaN(dateObj.getTime())) {
            return "Fecha Inválida";
        }
        return format(dateObj, fmt, { locale: es });
    } catch {
        return "Fecha Inválida";
    }
};

const RevisorStatusCard = ({ plan, revisorKey }: { plan: PlanWithDetails; revisorKey: "revisor1" | "revisor2" }) => {
    const revisorData = plan[revisorKey];
    if (!revisorData) return null;

    const finalStatus = revisorData.estado || "No definido";
    const isApproved = finalStatus === "APROBADO";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center text-base">
                    <span>{revisorKey === "revisor1" ? "Revisor 1" : "Revisor 2"}: {revisorData.nombre}</span>
                     <Badge className={cn("border-none", 
                        isApproved && "bg-green-100 text-green-800",
                        !isApproved && "bg-gray-100 text-gray-800"
                     )}>
                        {finalStatus}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    El estado final de la revisión al momento de finalizar era: <strong>{finalStatus}</strong>.
                </p>
                {revisorData.fechaAprobado && isApproved && (
                    <p className="text-sm text-green-600 mt-2">Aprobado el: {formatDate(revisorData.fechaAprobado)}</p>
                )}
            </CardContent>
        </Card>
    );
};

export function ArchivedReviewsView({ plans }: { plans: PlanWithDetails[] }) {

    if (plans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
                <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                    No hay planes de revisión archivados o desaprobados.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <ExportButton
                    data={plans}
                    title="Reporte de Planes Archivados y Desaprobados"
                    filename="reporte_archivados_desaprobados"
                    type="archived-review"
                />
            </div>
            <Accordion type="multiple" className="w-full space-y-2">
                {plans.map((plan) => {
                    const isArchived = plan.estadoGlobal === 'ARCHIVADO';
                    const isDisapproved = plan.estadoGlobal === 'DESAPROBADO';
                    
                    let finalDate: any;
                    let finalDateLabel = "";
                    let badgeVariant: "destructive" | "outline" = "outline";
                    let badgeText = "";
                    
                    if (isArchived) {
                        finalDate = plan.archivo?.fecha;
                        finalDateLabel = "Fecha de Archivo";
                        badgeVariant = "destructive";
                        badgeText = "ARCHIVADO";
                    } else if (isDisapproved) {
                        // Find the latest disapproval date
                        const d1 = plan.revisor1?.fechaDesaprobado ? new Date(plan.revisor1.fechaDesaprobado).getTime() : 0;
                        const d2 = plan.revisor2?.fechaDesaprobado ? new Date(plan.revisor2.fechaDesaprobado).getTime() : 0;
                        finalDate = d1 > d2 ? plan.revisor1?.fechaDesaprobado : plan.revisor2?.fechaDesaprobado;
                        finalDateLabel = "Fecha de Desaprobación";
                        badgeVariant = "destructive";
                        badgeText = "DESAPROBADO";
                    }

                    return (
                        <AccordionItem value={plan.id} key={plan.id} className="border rounded-lg">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex flex-col text-left">
                                        <div className="font-semibold">{plan.estudiante.apellidosNombres}</div>
                                        <div className="truncate max-w-xs text-sm text-muted-foreground">{plan.titulo}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{`${finalDateLabel}: ${formatDate(finalDate)}`}</Badge>
                                        <Badge variant={badgeVariant}>{badgeText}</Badge>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="p-4 border-t bg-muted/20 space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Detalles de la Finalización</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                                                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-semibold">Fecha Asignación</p>
                                                    <p>{formatDate(plan.submissionDate, "PPP")}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                                                <XCircle className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-semibold">{finalDateLabel}</p>
                                                    <p>{formatDate(finalDate, "PPP")}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {isArchived && (
                                            <div>
                                                <p className="text-sm font-semibold">Motivo del Archivo:</p>
                                                <p className="text-sm text-muted-foreground">{plan.archivo?.motivo || "No especificado"}</p>
                                            </div>
                                        )}
                                        {isDisapproved && (
                                            <div>
                                                <p className="text-sm font-semibold">Motivo de Desaprobación:</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {plan.revisor1?.motivoDesaprobado || plan.revisor2?.motivoDesaprobado || "El plan no cumplió con las observaciones después de 3 revisiones."}
                                                </p>
                                            </div>
                                        )}

                                        <Separator />
                                        
                                        <div>
                                            <p className="text-sm font-semibold">Estado final de los Revisores:</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                <RevisorStatusCard plan={plan} revisorKey="revisor1" />
                                                <RevisorStatusCard plan={plan} revisorKey="revisor2" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </div>
    );
}

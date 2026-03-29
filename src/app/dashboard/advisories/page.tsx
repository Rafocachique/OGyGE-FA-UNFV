

"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useForm, useFieldArray, SubmitHandler, FormProvider }
from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { onSnapshot, collection, query, where, doc, updateDoc, arrayUnion, arrayRemove, or, and, Query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ThesisPlan, User, Docente, RevisionStatus, ThesisPlanObservation, MonthlyHistory } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInMonths, differenceInCalendarDays, addYears, getYear, getMonth, startOfMonth, formatDistanceStrict, addMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter, useSearchParams } from "next/navigation";


import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderKanban, LoaderCircle, FileScan, CheckCircle2, Clock, AlertTriangle, CalendarIcon, CalendarDays, Milestone, UserCheck, Trash2, History, Check, UserCircle, FileText, Archive, ArchiveRestore, XCircle, ChevronDown, X, Search, FileWarning } from "lucide-react";
import { GeneralDataTable } from "@/components/general-data-table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AdvisoryHistoryView } from "@/components/advisory-history-view";
import { AdvisoryDataTable } from "@/components/advisory-data-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { DaysBadge } from "@/components/days-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const archiveFormSchema = z.object({
  fechaArchivado: z.date({ required_error: "La fecha es requerida." }),
  motivoArchivado: z.string().min(5, { message: "El motivo es requerido (mín. 5 caracteres)." }),
});
type ArchiveFormData = z.infer<typeof archiveFormSchema>;

const advisoryFormSchema = z.object({
  resolucionDecanalAsesoria: z.string().optional(),
  oficioAsesoria: z.string().optional(),
  etapaActual: z.string().optional(),
  observaciones: z.string().optional(),
  apaAprobado: z.boolean().default(false),
  listoParaTurnitin: z.boolean().default(false),
  ampliacion_activa: z.boolean().default(false),
  ampliacion_fechaSolicitud: z.date().optional().nullable(),
  ampliacion_fechaNuevoVencimiento: z.date().optional().nullable(),
  ampliacion_motivo: z.string().optional(),
  asesoriaAprobada: z.boolean().default(false),
  fechaAprobacionAsesoria: z.date().optional().nullable(),
});

type AdvisoryFormData = z.infer<typeof advisoryFormSchema>;

export type PlanAsesoriaConDetalles = ThesisPlan & {
  supervisorAsesores?: User | Docente;
  asesor?: User | Docente;
  diasDesdeUltimaAsistencia?: number;
};

const thesisStages = [
    "I. Introducción",
    "1.1 Descripción y formulación del problema",
    "1.2 Antecedentes",
    "1.3 Objetivos",
    "- Objetivo General",
    "- Objetivos Específicos",
    "1.4 Justificación",
    "1.5 Hipótesis (de ser necesario)",
    "II. Marco Teórico",
    "2.1 Bases teóricas sobre el tema de investigación",
    "III. Método",
    "3.1 Tipo de investigación",
    "3.2 Ámbito temporal y espacial",
    "3.4 Población y muestra",
    "3.5 Instrumentos",
    "3.6 Procedimientos",
    "3.7 Análisis de datos",
    "3.8 Consideraciones éticas (de ser necesario)",
    "IV. Resultados",
    "V. Discusión de resultados",
    "VI. Conclusiones",
    "VII. Recomendaciones",
    "VIII. Referencias",
    "IX. Anexos"
];

function AsesoriaList({ plans, accordionRef, isDecano }: { plans: PlanAsesoriaConDetalles[], accordionRef: React.RefObject<HTMLDivElement>, isDecano: boolean }) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
        <FileScan className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          No hay planes de tesis en esta categoría.
        </p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full" ref={accordionRef}>
      {plans.map((plan, index) => {
        const isApproved = plan.estadoGlobal === 'CULMINADO';
        const dias = plan.diasRestantesAsesoria ?? 0;
        
        return (
          <AccordionItem value={plan.id} key={plan.id}>
            <AccordionTrigger className="hover:no-underline px-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="font-semibold text-sm w-8 text-center">{index + 1}</div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold">{plan.estudiante.apellidosNombres}</p>
                  <p className="text-sm text-muted-foreground whitespace-normal break-words">{plan.titulo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-4">
                 {plan.modalidad && (
                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:text-purple-400 dark:bg-purple-900/20">
                      {plan.modalidad}
                    </Badge>
                  )}
                 {plan.supervisorAsesores && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20">
                      Sup: {plan.supervisorAsesores.nombre} {plan.supervisorAsesores.apellidos}
                    </Badge>
                  )}
                  {plan.asesor && (
                    <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:bg-gray-900/20">
                      Asesor: {plan.asesor.nombre} {plan.asesor.apellidos}
                    </Badge>
                  )}
                <DaysBadge days={dias} isFinished={isApproved} context="advisory" />
                <Badge className={cn(
                  "border-none",
                  plan.estadoGlobal === 'CULMINADO' && "bg-green-100 text-green-800",
                  plan.estadoGlobal === 'EN ASESORIA' && "bg-indigo-100 text-indigo-800",
                  plan.estadoGlobal === 'ARCHIVADO' && "bg-amber-100 text-amber-800",
                  plan.estadoGlobal === 'DESAPROBADO' && "bg-red-100 text-red-800"
                )}>
                  {plan.estadoGlobal === 'CULMINADO' ? 'APROBADO' : plan.estadoGlobal}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4 px-4">
                {isDecano ? <AdvisorySummary plan={plan} /> : <AdvisoryForm plan={plan} />}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  );
}

function DatePickerField({ control, name, label, disabled = false, fromDate, toDate, defaultMonth }: { control: any, name: string, label: string, disabled?: boolean, fromDate?: Date, toDate?: Date, defaultMonth?: Date }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
      <FormField
          control={control}
          name={name}
          render={({ field }) => (
              <FormItem className="flex flex-col">
                  <FormLabel>{label}</FormLabel>
                   <Popover open={isOpen} onOpenChange={setIsOpen}>
                      <PopoverTrigger asChild>
                          <FormControl>
                              <Button variant={"outline"} className={cn("pl-3 pr-1 text-left font-normal w-full justify-between", !field.value && "text-muted-foreground")} disabled={disabled}>
                                  <span className="flex-1">{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}</span>
                                  {field.value && !disabled ? (
                                        <div role="button" aria-label="Limpiar fecha" className="h-6 w-6 p-1 rounded-sm hover:bg-muted" onClick={(e) => { e.stopPropagation(); field.onChange(null); }}>
                                            <X className="h-4 w-4" />
                                        </div>
                                    ) : (
                                        <CalendarIcon className="h-4 w-4 opacity-50" />
                                    )}
                              </Button>
                          </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              locale={es}
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsOpen(false);
                              }}
                              initialFocus
                              defaultMonth={defaultMonth}
                              disabled={disabled || ((date) => {
                                if (fromDate && toDate) return date < fromDate || date > toDate;
                                if (fromDate) return date < fromDate;
                                if (toDate) return date > toDate;
                                return false;
                              })}
                          />
                      </PopoverContent>
                  </Popover>
                  <FormMessage />
              </FormItem>
          )}
      />
  );
}

function AttendanceTimelineManager({ plan, isLocked }: { plan: PlanAsesoriaConDetalles; isLocked: boolean; }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [localAttendedDates, setLocalAttendedDates] = useState(() => {
        const attendedDates = new Map<string, string>();
        (plan.asistencias || []).forEach(dateString => {
            const d = new Date(dateString);
            const monthKey = `${getYear(d)}-${getMonth(d)}`;
            attendedDates.set(monthKey, dateString);
        });
        return attendedDates;
    });

    const { totalMonths, startDate } = useMemo(() => {
        const startDate = new Date(plan.submissionDate);
        const endDate = (plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento)
            ? new Date(plan.ampliacion.fechaNuevoVencimiento)
            : new Date(plan.fechaVencimientoAsesoria);
        
        let months = differenceInMonths(endDate, startDate);
        // Ensure at least 1 month is shown and it's not negative.
        return { totalMonths: months > 0 ? months : 1, startDate };
    }, [plan.submissionDate, plan.fechaVencimientoAsesoria, plan.ampliacion]);

    const handleToggleAsistencia = async (monthDate: Date) => {
        setLoading(true);
        const monthKey = `${getYear(monthDate)}-${getMonth(monthDate)}`;
        const hasAttended = localAttendedDates.has(monthKey);
        const existingDateString = localAttendedDates.get(monthKey);

        try {
            const planRef = doc(db, "thesisPlans", plan.id);
            if (hasAttended && existingDateString) {
                // Remove attendance
                await updateDoc(planRef, {
                    asistencias: arrayRemove(existingDateString),
                    actualizadoEn: new Date(),
                });
                
                // Update local state
                const newDates = new Map(localAttendedDates);
                newDates.delete(monthKey);
                setLocalAttendedDates(newDates);

                toast({ title: "Asistencia Anulada", description: `Se eliminó la asistencia para ${format(monthDate, "MMMM yyyy", { locale: es })}.` });
            } else {
                // Add attendance
                const newDateString = new Date().toISOString();
                await updateDoc(planRef, {
                    asistencias: arrayUnion(newDateString),
                    actualizadoEn: new Date(),
                });
                
                // Update local state
                const newDates = new Map(localAttendedDates);
                newDates.set(monthKey, newDateString);
                setLocalAttendedDates(newDates);

                toast({ title: "Asistencia Registrada", description: `Se marcó la asistencia para ${format(new Date(), "MMMM yyyy", { locale: es })}.` });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la asistencia." });
        } finally {
            setLoading(false);
        }
    };
    
    const months = Array.from({ length: totalMonths }, (_, i) => {
        const monthDate = addMonths(startDate, i);
        const monthKey = `${getYear(monthDate)}-${getMonth(monthDate)}`;
        const existingDateString = localAttendedDates.get(monthKey);
        const hasAttended = !!existingDateString;
        return { date: monthDate, attended: hasAttended, dateString: existingDateString };
    });

    return (
        <div className="space-y-4">
            <h4 className="font-medium">Registro de Asistencia Mensual a Asesoría</h4>
            <FormDescription>
                Marque los meses en los que el alumno asistió. Una ausencia prolongada puede indicar riesgo de abandono.
            </FormDescription>
            <TooltipProvider>
                <div className="flex flex-wrap gap-x-2 gap-y-4 rounded-md border p-4 bg-muted/50">
                    {months.map((month, index) => {
                        const isDisabled = loading || isLocked;

                        return (
                        <div key={index} className="flex flex-col items-center gap-1.5 w-12 text-center">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="relative">
                                       <Checkbox
                                            id={`asistencia-${index}`}
                                            checked={month.attended}
                                            onCheckedChange={() => handleToggleAsistencia(month.date)}
                                            disabled={isDisabled}
                                            aria-label={`Asistencia para ${format(month.date, "MMMM yyyy", { locale: es })}`}
                                            className="h-6 w-6 rounded-full peer"
                                        />
                                        {month.attended && <Check className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white pointer-events-none" />}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="capitalize font-semibold">{format(month.date, "MMMM yyyy", { locale: es })}</p>
                                    {month.attended && month.dateString ? (
                                        <p>Registrada: {format(new Date(month.dateString), "PPP 'a las' h:mm a", { locale: es })}</p>
                                    ) : (
                                        <p>Sin asistencia registrada</p>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                            <label htmlFor={`asistencia-${index}`} className="text-xs text-muted-foreground capitalize">{format(month.date, "MMM yy", { locale: es })}</label>
                        </div>
                    )})}
                </div>
            </TooltipProvider>
        </div>
    );
}

function AttendanceTimelineReadOnly({ plan }: { plan: PlanAsesoriaConDetalles; }) {
    const { totalMonths, startDate } = useMemo(() => {
        const startDate = new Date(plan.submissionDate);
        const endDate = (plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento)
            ? new Date(plan.ampliacion.fechaNuevoVencimiento)
            : new Date(plan.fechaVencimientoAsesoria);
        let months = differenceInMonths(endDate, startDate);
        return { totalMonths: months > 0 ? months : 1, startDate };
    }, [plan.submissionDate, plan.fechaVencimientoAsesoria, plan.ampliacion]);

    const attendedMonths = new Set(
        (plan.asistencias || []).map(dateString => {
            const d = new Date(dateString);
            return `${getYear(d)}-${getMonth(d)}`;
        })
    );

    const months = Array.from({ length: totalMonths }, (_, i) => {
        const monthDate = addMonths(startDate, i);
        const monthKey = `${getYear(monthDate)}-${getMonth(monthDate)}`;
        return { date: monthDate, attended: attendedMonths.has(monthKey) };
    });

    return (
        <div className="space-y-3">
            <h4 className="font-medium">Registro de Asistencia Mensual</h4>
            <TooltipProvider>
                <div className="flex flex-wrap gap-x-2 gap-y-3 rounded-md border p-4 bg-muted/50">
                    {months.map((month, index) => (
                        <Tooltip key={index}>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-1.5 w-12 text-center cursor-default">
                                    <div className={cn(
                                        "h-5 w-5 rounded-full flex items-center justify-center border",
                                        month.attended ? "bg-green-500 border-green-600" : "bg-muted-foreground/20 border-muted-foreground/30"
                                    )}>
                                        {month.attended && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="text-xs text-muted-foreground capitalize">{format(month.date, "MMM yy", { locale: es })}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="capitalize font-semibold">{format(month.date, "MMMM yyyy", { locale: es })}</p>
                                <p>{month.attended ? "Asistencia Registrada" : "Sin Asistencia"}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </TooltipProvider>
        </div>
    );
}

function AdvisorySummary({ plan }: { plan: PlanAsesoriaConDetalles }) {
  const isApproved = plan.estadoGlobal === 'CULMINADO';
  const fechaVencimiento = plan.ampliacion?.activa && plan.ampliacion.fechaNuevoVencimiento ? new Date(plan.ampliacion.fechaNuevoVencimiento) : new Date(plan.fechaVencimientoAsesoria);
  
  const { totalMonths, mesesTranscurridos, progress } = useMemo(() => {
    const startDate = new Date(plan.submissionDate);
    const endDate = fechaVencimiento;
    
    const total = differenceInMonths(endDate, startDate) || 1;
    const transcurridos = differenceInMonths(new Date(), startDate);
    const progressPercentage = (transcurridos / total) * 100;
    
    return {
      totalMonths: total,
      mesesTranscurridos: transcurridos + 1,
      progress: Math.max(0, Math.min(100, progressPercentage))
    };
  }, [plan.submissionDate, fechaVencimiento]);

  const days = plan.diasRestantesAsesoria ?? 0;

  const isTurnitinProcessApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';

  return (
    <Card>
      <CardHeader>
          <div className="flex items-center justify-between w-full">
              <CardTitle className="text-xl flex items-center gap-2">
                <UserCircle className="h-5 w-5"/>
                Asesor: {plan.asesor?.nombre} {plan.asesor?.apellidos}
              </CardTitle>
              <Badge className={cn("border-none", isApproved ? "bg-green-100 text-green-800" : "bg-indigo-100 text-indigo-800")}>
                  {plan.estadoGlobal === 'CULMINADO' ? 'APROBADO' : plan.estadoGlobal}
              </Badge>
          </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                <div><p className="font-semibold">Fecha Asignación</p><p>{plan.submissionDate ? format(new Date(plan.submissionDate), 'PPP', {locale: es}) : 'N/A'}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <div><p className="font-semibold">Fecha Vencimiento</p><p>{format(fechaVencimiento, 'PPP', {locale: es})}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <Milestone className="h-5 w-5 text-muted-foreground" />
                <div><p className="font-semibold">Mes de Asesoría</p><p>{mesesTranscurridos} de {totalMonths}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div><p className="font-semibold">Días Restantes</p><DaysBadge days={days} isFinished={isApproved} context="advisory"/></div>
            </div>
        </div>
        <div className="space-y-2">
            <Progress value={progress} className="h-2"/>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Avance de Plazo ({totalMonths} meses)</span>
                {isApproved ? <span className="font-semibold text-green-600">Asesoría Aprobada</span> : <DaysBadge days={days} isFinished={isApproved} context="advisory"/>}
            </div>
        </div>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1"><p className="font-medium text-muted-foreground">Resolución Decanal</p><p>{plan.resolucionDecanalAsesoria || "No especificado"}</p></div>
            <div className="space-y-1"><p className="font-medium text-muted-foreground">Oficio de Asignación de Asesoría</p><p>{plan.oficioAsesoria || "No especificado"}</p></div>
            <div className="space-y-1"><p className="font-medium text-muted-foreground">Etapa Actual</p><p>{plan.etapaActual || "No especificado"}</p></div>
            <div className="space-y-1"><p className="font-medium text-muted-foreground">Observaciones</p><p>{plan.observaciones || "Ninguna"}</p></div>
        </div>
        <Separator />
        <AttendanceTimelineReadOnly plan={plan} />
        <Separator />
        <div className="space-y-4">
            <h4 className="font-medium">Revisiones Finales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg flex items-center justify-between">
                    <p className="font-medium">Formato APA</p>
                    {plan.apaAprobado ? <Badge className="bg-green-100 text-green-800">Aprobado</Badge> : <Badge variant="outline">Pendiente</Badge>}
                </div>
                 <div className="p-4 border rounded-lg flex items-center justify-between">
                    <p className="font-medium">Enviar a Turnitin</p>
                    {plan.listoParaTurnitin ? <Badge className="bg-green-100 text-green-800">Enviado</Badge> : <Badge variant="outline">Pendiente</Badge>}
                </div>
                <div className="p-4 border rounded-lg flex items-center justify-between">
                     <p className="font-medium">Análisis Turnitin</p>
                    {isTurnitinProcessApproved ? <Badge className="bg-green-100 text-green-800">Aprobado</Badge> : <Badge variant="outline">Pendiente</Badge>}
                </div>
            </div>
        </div>
        {isApproved && (
             <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5"/>
                <p className="font-semibold">Asesoría aprobada el {plan.fechaAprobacionAsesoria ? format(new Date(plan.fechaAprobacionAsesoria), 'PPP', {locale: es}) : 'N/A'}.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}


function ArchiveManager({ plan }: { plan: PlanAsesoriaConDetalles }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const isFormLockedForEdit = plan.estadoGlobal === 'CULMINADO';

    const form = useForm<ArchiveFormData>({
        resolver: zodResolver(archiveFormSchema),
        defaultValues: {
            fechaArchivado: undefined,
            motivoArchivado: "",
        },
    });

    useEffect(() => {
        if (isDialogOpen) {
            form.reset({
                fechaArchivado: undefined,
                motivoArchivado: "",
            });
        }
    }, [isDialogOpen, form]);

    const handleArchive = async (data: ArchiveFormData) => {
        setLoading(true);
        try {
            const planRef = doc(db, "thesisPlans", plan.id);
            await updateDoc(planRef, {
                estadoGlobal: 'ARCHIVADO',
                'archivo.archivado': true,
                'archivo.fecha': data.fechaArchivado.toISOString(),
                'archivo.motivo': data.motivoArchivado,
                actualizadoEn: new Date(),
            });
            toast({ title: "Plan de Asesoría Archivado", description: "El plan de asesoría ha sido movido al archivo." });
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error archiving plan:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo archivar el plan de asesoría." });
        } finally {
            setLoading(false);
        }
    };

    const handleUnarchive = async () => {
        setLoading(true);
        try {
            const planRef = doc(db, "thesisPlans", plan.id);
            await updateDoc(planRef, {
                estadoGlobal: 'EN ASESORIA',
                'archivo.archivado': false,
                'archivo.fecha': null,
                'archivo.motivo': null,
                actualizadoEn: new Date(),
            });
            toast({ title: "Plan Restaurado", description: "El plan de asesoría ha sido sacado del archivo." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo restaurar el plan." });
        } finally {
            setLoading(false);
        }
    };

    if (plan.estadoGlobal === 'ARCHIVADO') {
        return (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="default" disabled={loading} size="sm" type="button" onClick={(e) => e.stopPropagation()}>
                        {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
                        Restaurar
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Está seguro de restaurar este plan de asesoría?</AlertDialogTitle>
                        <AlertDialogDescription>El plan volverá al estado "EN ASESORIA" y estará activo de nuevo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnarchive}>Sí, restaurar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    return (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading || isFormLockedForEdit} size="sm" type="button" onClick={(e) => e.stopPropagation()}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleArchive)}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Archivar Plan de Asesoría</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción marcará el plan como archivado. Úselo para planes vencidos o abandonados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid gap-4 py-4">
                            <DatePickerField control={form.control} name="fechaArchivado" label="Fecha de Archivo" />
                            <FormField control={form.control} name="motivoArchivado" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Motivo del Archivo</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Ej: Vencimiento de plazo, abandono del alumno..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
                            <Button type="submit" disabled={loading}>
                                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Archivo
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AdvisoryForm({ plan }: { plan: PlanAsesoriaConDetalles }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isArchived = plan.estadoGlobal === 'ARCHIVADO';
  
  const sortedAsistencias = useMemo(() => {
    if (!plan.asistencias || plan.asistencias.length === 0) return [];
    return [...plan.asistencias].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [plan.asistencias]);

  const form = useForm<AdvisoryFormData>({
    resolver: zodResolver(advisoryFormSchema),
    defaultValues: {
      resolucionDecanalAsesoria: plan.resolucionDecanalAsesoria || "",
      oficioAsesoria: plan.oficioAsesoria || "",
      etapaActual: plan.etapaActual || "",
      observaciones: plan.observaciones || "",
      apaAprobado: plan.apaAprobado || false,
      listoParaTurnitin: plan.listoParaTurnitin || false,
      ampliacion_activa: plan.ampliacion?.activa || false,
      ampliacion_fechaSolicitud: plan.ampliacion?.fechaSolicitud ? new Date(plan.ampliacion.fechaSolicitud) : undefined,
      ampliacion_fechaNuevoVencimiento: plan.ampliacion?.fechaNuevoVencimiento ? new Date(plan.ampliacion.fechaNuevoVencimiento) : undefined,
      ampliacion_motivo: plan.ampliacion?.motivo || "",
      asesoriaAprobada: plan.estadoGlobal === 'CULMINADO',
      fechaAprobacionAsesoria: plan.fechaAprobacionAsesoria ? new Date(plan.fechaAprobacionAsesoria) : undefined,
    },
  });

  const ampliacionActiva = form.watch("ampliacion_activa");
  const nuevaFechaVencimiento = form.watch("ampliacion_fechaNuevoVencimiento");
  const asesoriaAprobada = form.watch("asesoriaAprobada");

  const isApproved = asesoriaAprobada || plan.estadoGlobal === 'CULMINADO';
  const isFormLockedForEdit = isArchived;
  
  const [duracionAmpliacion, setDuracionAmpliacion] = useState("");
  const fechaVencimientoOriginal = useMemo(() => new Date(plan.fechaVencimientoAsesoria), [plan.fechaVencimientoAsesoria]);
  const fechaMaxAmpliacion = useMemo(() => addYears(fechaVencimientoOriginal, 1), [fechaVencimientoOriginal]);

  const turnitinStatus = useMemo(() => {
    if (plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO') {
      return { text: 'APROBADO', className: 'bg-green-100 text-green-800' };
    }
    if (plan.turnitin2?.estado === 'DESAPROBADO') {
      return { text: 'DESAPROBADO (2do Intento)', className: 'bg-red-100 text-red-800' };
    }
    if (plan.turnitin1?.estado === 'DESAPROBADO') {
      return { text: 'OBSERVADO (1er Intento)', className: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'PENDIENTE', className: 'bg-gray-100 text-gray-800' };
  }, [plan]);

  useEffect(() => {
    if (nuevaFechaVencimiento && fechaVencimientoOriginal) {
      if (nuevaFechaVencimiento > fechaVencimientoOriginal) {
        const duracion = formatDistanceStrict(nuevaFechaVencimiento, fechaVencimientoOriginal, { locale: es });
        setDuracionAmpliacion(duracion);
      } else {
        setDuracionAmpliacion("Fecha inválida");
      }
    } else {
      setDuracionAmpliacion("");
    }
  }, [nuevaFechaVencimiento, fechaVencimientoOriginal]);


  const onSubmit = async (data: AdvisoryFormData) => {
    setLoading(true);

    const validatedData = { ...data };

    if (!validatedData.ampliacion_activa) {
        validatedData.ampliacion_fechaSolicitud = null;
        validatedData.ampliacion_fechaNuevoVencimiento = null;
        validatedData.ampliacion_motivo = "";
    }

    // Validations
    if (validatedData.ampliacion_activa && (!validatedData.ampliacion_fechaSolicitud || !validatedData.ampliacion_fechaNuevoVencimiento)) {
        toast({ variant: "destructive", title: "Datos de Ampliación Incompletos", description: "Debe seleccionar la fecha de solicitud y la nueva fecha de vencimiento." });
        setLoading(false);
        return;
    }
    
    if (validatedData.asesoriaAprobada && !validatedData.fechaAprobacionAsesoria) {
        toast({ variant: "destructive", title: "Datos Incompletos", description: "Debe seleccionar una fecha de aprobación final." });
        setLoading(false);
        return;
    }

    if (validatedData.asesoriaAprobada) {
        if (turnitinStatus.text !== 'APROBADO' && !validatedData.apaAprobado) {
            toast({ variant: "destructive", title: "Prerrequisitos no cumplidos", description: "El alumno debe aprobar tanto el formato APA como el análisis Turnitin para poder finalizar la asesoría." });
            setLoading(false);
            return;
        }
        if (turnitinStatus.text !== 'APROBADO') {
            toast({ variant: "destructive", title: "Prerrequisito no cumplido", description: "El alumno debe aprobar el análisis Turnitin para poder finalizar la asesoría." });
            setLoading(false);
            return;
        }
         if (!validatedData.apaAprobado) {
            toast({ variant: "destructive", title: "Prerrequisito no cumplido", description: "El alumno debe aprobar el formato APA para poder finalizar la asesoría." });
            setLoading(false);
            return;
        }
    }


    try {
      const planRef = doc(db, "thesisPlans", plan.id);
      
      let newEstadoGlobal = plan.estadoGlobal;
      if (plan.estadoGlobal === 'ARCHIVADO') {
         // Don't change the state if it's archived
      } else if (validatedData.asesoriaAprobada && validatedData.fechaAprobacionAsesoria) {
        newEstadoGlobal = 'CULMINADO';
      } else if (plan.estadoGlobal === 'CULMINADO' && !validatedData.asesoriaAprobada) {
         newEstadoGlobal = 'EN ASESORIA';
      } else {
         newEstadoGlobal = 'EN ASESORIA';
      }

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      const newMonthlyRecord: Partial<MonthlyHistory> = {
        month: currentMonth,
        year: currentYear,
        etapaActual: validatedData.etapaActual,
        observaciones: validatedData.observaciones,
        apaAprobado: validatedData.apaAprobado,
        asistencia: plan.asistencias?.some(d => isSameMonth(new Date(d), currentDate)) || false,
      };

      const existingHistory: MonthlyHistory[] = plan.historialMensual || [];
      const monthIndex = existingHistory.findIndex(h => h.year === currentYear && h.month === currentMonth);
      
      let updatedHistory: MonthlyHistory[];
      if (monthIndex > -1) {
        updatedHistory = [...existingHistory];
        updatedHistory[monthIndex] = { ...updatedHistory[monthIndex], ...newMonthlyRecord };
      } else {
        updatedHistory = [...existingHistory, newMonthlyRecord as MonthlyHistory];
      }
      
      const toISOOrNull = (date?: Date | null) => date ? date.toISOString() : null;

      const updateData: any = {
        actualizadoEn: new Date(),
        estadoGlobal: newEstadoGlobal,
        fechaAprobacionAsesoria: newEstadoGlobal === 'CULMINADO' ? toISOOrNull(validatedData.fechaAprobacionAsesoria) : null,
        resolucionDecanalAsesoria: validatedData.resolucionDecanalAsesoria,
        oficioAsesoria: validatedData.oficioAsesoria,
        etapaActual: validatedData.etapaActual,
        observaciones: validatedData.observaciones,
        apaAprobado: validatedData.apaAprobado,
        listoParaTurnitin: validatedData.listoParaTurnitin,
        ampliacion: {
            activa: validatedData.ampliacion_activa,
            fechaSolicitud: validatedData.ampliacion_activa ? toISOOrNull(validatedData.ampliacion_fechaSolicitud) : null,
            fechaNuevoVencimiento: validatedData.ampliacion_activa ? toISOOrNull(validatedData.ampliacion_fechaNuevoVencimiento) : null,
            motivo: validatedData.ampliacion_activa ? validatedData.ampliacion_motivo : null,
        },
        historialMensual: updatedHistory,
      };
      
      await updateDoc(planRef, updateData);
      toast({ title: "Éxito", description: "El progreso de la asesoría ha sido actualizado." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la información." });
    } finally {
      setLoading(false);
    }
  };

  const fechaVencimiento = ampliacionActiva && nuevaFechaVencimiento ? nuevaFechaVencimiento : new Date(plan.fechaVencimientoAsesoria);
  
  const { totalMonths, mesesTranscurridos, progress } = useMemo(() => {
    const startDate = new Date(plan.submissionDate);
    const endDate = ampliacionActiva && nuevaFechaVencimiento ? nuevaFechaVencimiento : new Date(plan.fechaVencimientoAsesoria);
    
    const total = differenceInMonths(endDate, startDate) || 1;
    const transcurridos = differenceInMonths(new Date(), startDate);

    const progressPercentage = (transcurridos / total) * 100;
    
    return {
      totalMonths: total,
      mesesTranscurridos: transcurridos + 1,
      progress: Math.max(0, Math.min(100, progressPercentage))
    };
  }, [plan.submissionDate, ampliacionActiva, nuevaFechaVencimiento, plan.fechaVencimientoAsesoria]);


  const nombreMesActual = format(new Date(), 'MMMM', { locale: es });
  const fechaDefaultAmpliacion = ampliacionActiva && nuevaFechaVencimiento ? nuevaFechaVencimiento : fechaVencimientoOriginal;
  const days = plan.diasRestantesAsesoria ?? 0;

  const isDecano = useAuth().appUser?.roles.includes('decano') && !useAuth().appUser?.roles.includes('admin');

  return (
    <FormProvider {...form}>
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
            <div className="space-y-1.5">
                <h2 className="text-lg font-semibold">Asesor: {plan.asesor?.nombre} {plan.asesor?.apellidos}</h2>
                <Badge className={cn("border-none", isApproved ? "bg-green-100 text-green-800" : (isArchived ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"))}>
                    {plan.estadoGlobal === 'CULMINADO' ? 'APROBADO' : plan.estadoGlobal}
                </Badge>
            </div>
            {!isDecano && (
              <div onClick={(e) => e.stopPropagation()}>
                <ArchiveManager plan={plan} />
              </div>
            )}
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 pt-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">Fecha Asignación</p>
                        <p>{plan.submissionDate ? format(new Date(plan.submissionDate), 'PPP', {locale: es}) : 'N/A'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">Fecha Vencimiento</p>
                        <p>{fechaVencimiento ? format(new Date(fechaVencimiento), 'PPP', {locale: es}) : 'N/A'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <Milestone className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">Mes de Asesoría</p>
                        <p>{mesesTranscurridos} de {totalMonths} <span className="text-muted-foreground capitalize">({nombreMesActual})</span></p>
                    </div>
                </div>
                 <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">Días Restantes</p>
                        <DaysBadge days={days} isFinished={isApproved} context="advisory"/>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Progress value={progress} className="h-2"/>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avance de Plazo ({totalMonths} meses)</span>
                    {isApproved ? (
                        <span className="font-semibold text-green-600">Asesoría Aprobada</span>
                    ) : (
                        <DaysBadge days={days} isFinished={isApproved} context="advisory"/>
                    )}
                </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="resolucionDecanalAsesoria" render={({ field }) => (<FormItem><FormLabel>Resolución Decanal</FormLabel><FormControl><Input placeholder="RESOLUCIÓN..." {...field} value={field.value ?? ''} disabled={isFormLockedForEdit} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="oficioAsesoria" render={({ field }) => (<FormItem><FormLabel>Oficio de Asignación de Asesoría</FormLabel><FormControl><Input placeholder="OFICIO N°..." {...field} value={field.value ?? ''} disabled={isFormLockedForEdit} /></FormControl></FormItem>)} />
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="etapaActual"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Etapa Actual de la Asesoría</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isFormLockedForEdit}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar etapa..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {thesisStages.map(stage => (
                                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="observaciones" render={({ field }) => (<FormItem><FormLabel>Observaciones o Comentarios</FormLabel><FormControl><Textarea placeholder="Anotaciones sobre el progreso del alumno..." {...field} value={field.value ?? ''} disabled={isFormLockedForEdit} /></FormControl></FormItem>)} />
            </div>

            <Separator />

            <AttendanceTimelineManager plan={plan} isLocked={isFormLockedForEdit} />

            <Separator />

            <div className="space-y-4">
                <h4 className="font-medium">Revisiones Finales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 rounded-md border p-4">
                        <FormField
                            control={form.control}
                            name="apaAprobado"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel>Formato APA Aprobado</FormLabel>
                                        <FormDescription>
                                            Marcar si el formato de la tesis cumple con las normas APA.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isFormLockedForEdit}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="rounded-md border p-4 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h5 className="font-medium">Análisis Turnitin</h5>
                            <p className="text-sm text-muted-foreground">
                                Estado de la revisión de similitud.
                            </p>
                        </div>
                        <Badge className={turnitinStatus.className}>
                            {turnitinStatus.text}
                        </Badge>
                    </div>

                    <div className="space-y-2 rounded-md border p-4 md:col-span-2">
                        <FormField
                            control={form.control}
                            name="listoParaTurnitin"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel>Enviar a Revisión Turnitin</FormLabel>
                                        <FormDescription>
                                            Marcar cuando la tesis esté lista para ser revisada por el supervisor de Turnitin.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isFormLockedForEdit}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    {plan.turnitinApaObservado && (
                        <div className="rounded-md border p-4 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 md:col-span-2">
                            <div className="flex items-center gap-2">
                                <FileWarning className="h-5 w-5 text-amber-600" />
                                <div className="space-y-0.5">
                                    <h5 className="font-medium text-amber-800 dark:text-amber-300">
                                        Observación de Formato APA
                                    </h5>
                                    <p className="text-sm text-muted-foreground">El Supervisor de Turnitin ha marcado este plan. Revise las correcciones.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                 <h4 className="font-medium">Gestión de Ampliación de Plazo</h4>
                 <div className="rounded-md border p-4 space-y-4">
                    <FormField control={form.control} name="ampliacion_activa" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><div className="space-y-0.5"><FormLabel>Solicitud de Ampliación Aceptada</FormLabel><FormDescription>Activar para conceder un plazo adicional (máximo 1 año).</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isFormLockedForEdit} /></FormControl></FormItem>)} />
                    {ampliacionActiva && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t items-start">
                            <DatePickerField control={form.control} name="ampliacion_fechaSolicitud" label="Fecha de Solicitud" disabled={isFormLockedForEdit} />
                             <FormField control={form.control} name="ampliacion_motivo" render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Motivo de la Ampliación</FormLabel><FormControl><Textarea placeholder="Describa el motivo de la ampliación..." {...field} value={field.value ?? ''} disabled={isFormLockedForEdit} /></FormControl></FormItem>)} />
                            <div className="space-y-2">
                              <DatePickerField 
                                  control={form.control} 
                                  name="ampliacion_fechaNuevoVencimiento" 
                                  label="Nueva Fecha de Vencimiento" 
                                  disabled={isFormLockedForEdit}
                                  fromDate={fechaVencimientoOriginal}
                                  toDate={fechaMaxAmpliacion}
                                  defaultMonth={fechaDefaultAmpliacion}
                              />
                              {duracionAmpliacion && (
                                <FormDescription>Duración de la ampliación: <span className="font-semibold">{duracionAmpliacion}</span></FormDescription>
                              )}
                            </div>
                        </div>
                    )}
                 </div>
            </div>
            
            <Separator />

            <div className="space-y-4">
                <h4 className="font-medium">Aprobación Final de Asesoría</h4>
                <div className="rounded-md border p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <FormField 
                        control={form.control} 
                        name="asesoriaAprobada" 
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-1">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Asesoría Aprobada</FormLabel>
                                    <FormDescription>Marcar para dar por finalizado el proceso de asesoría.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isArchived}
                                    />
                                </FormControl>
                            </FormItem>
                        )} 
                    />
                    <div className={cn(!asesoriaAprobada && "opacity-50 pointer-events-none")}>
                        <DatePickerField 
                            control={form.control} 
                            name="fechaAprobacionAsesoria" 
                            label="Fecha de Aprobación Final"
                            disabled={!asesoriaAprobada || isArchived}
                        />
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            <Button type="submit" disabled={loading || isArchived}>
                {loading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (isArchived ? 'Plan Archivado' : 'Guardar Progreso')}
            </Button>
        </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}

function ArchivedAdvisoryView({ plans }: { plans: PlanAsesoriaConDetalles[] }) {
    if (plans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
                <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">No hay planes archivados.</p>
            </div>
        );
    }

    const formatDate = (date: any) => {
        try {
            if (!date) return "N/A";
            const dateObj = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
            if (isNaN(dateObj.getTime())) return "Fecha Inválida";
            return format(dateObj, "PPP", { locale: es });
        } catch {
            return "Fecha Inválida";
        }
    };

    return (
        <Accordion type="multiple" className="w-full space-y-2">
            {plans.map((plan, index) => {
                const finalDate: any = plan.archivo?.fecha;
                const finalDateLabel = "Fecha de Archivo";

                return (
                    <AccordionItem value={plan.id} key={plan.id} className="border rounded-lg">
                        <AccordionTrigger className="p-4 hover:no-underline flex justify-between w-full">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="font-semibold text-sm w-8 text-center">{index + 1}</div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="font-semibold">{plan.estudiante.apellidosNombres}</p>
                                    <p className="text-sm text-muted-foreground whitespace-normal break-words">{plan.titulo}</p>
                                </div>
                            </div>
                            <div className="flex justify-center items-center gap-2 pl-4 shrink-0">
                                <Badge variant="outline">{`${finalDateLabel}: ${formatDate(finalDate)}`}</Badge>
                                <Badge variant="destructive">ARCHIVADO</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="p-4 border-t bg-muted/20 space-y-4">
                                <Card>
                                    <CardHeader className="flex flex-row justify-between items-center">
                                        <CardTitle>Detalles del archivado</CardTitle>
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ArchiveManager plan={plan} />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <p className="text-sm">
                                            <span className="font-semibold">Motivo:</span> {plan.archivo?.motivo}
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-semibold">Asesor:</span> {plan.asesor?.nombre} {plan.asesor?.apellidos}
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-semibold">Supervisor:</span> {plan.supervisorAsesores?.nombre} {plan.supervisorAsesores?.apellidos}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
    );
}

function AdvisoriesPageContent() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanAsesoriaConDetalles[]>([]);
  const [docentes, setDocentes] = useState<(User | Docente)[]>([]);
  const { appUser } = useAuth();
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();


  const searchParams = useSearchParams();
  const router = useRouter();
  
  const accordionRef = useRef<HTMLDivElement>(null);
  
  const isDecano = appUser?.roles.includes('decano') && !appUser?.roles.includes('admin');
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (isDecano ? 'datos-en-proceso' : 'en-asesoria'));
  const [isDataViewOpen, setIsDataViewOpen] = useState(false);

  useEffect(() => {
    if (isDecano) {
        setActiveTab(searchParams.get('tab') || 'datos-en-proceso');
    } else {
        setActiveTab(searchParams.get('tab') || 'en-asesoria');
    }
  }, [isDecano, searchParams]);

  useEffect(() => {
    const expandId = searchParams.get('expand');
    if (expandId && accordionRef.current) {
        setTimeout(() => {
            const item = accordionRef.current?.querySelector(`[data-radix-collection-item][value="${expandId}"]`);
            const trigger = item?.querySelector('[data-state="closed"]');
            if (trigger) {
                (trigger as HTMLElement).click();
                item?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
  }, [searchParams, plans]);


  useEffect(() => {
    const usersQuery = query(
      collection(db, "users"),
      where("roles", "array-contains", "docente")
    );
    const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
      const docenteUsers = usersSnapshot.docs.map(
        (doc) => ({ ...doc.data(), uid: doc.id, id: doc.id } as unknown as User)
      );

      const recordsQuery = collection(db, "docentes");
      const unsubRecords = onSnapshot(recordsQuery, (recordsSnapshot) => {
        const docenteRecords = recordsSnapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as Docente)
        );

        const combinedDocentes: (User | Docente)[] = [...docenteUsers];
        const userEmails = new Set(docenteUsers.map((d) => d.correo));

        docenteRecords.forEach((record) => {
          if (record.correo && !userEmails.has(record.correo)) {
            combinedDocentes.push(record);
          } else if (!record.correo) {
            combinedDocentes.push(record);
          }
        });
        setDocentes(combinedDocentes);
      });
      return () => unsubRecords();
    });
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    if (!appUser || docentes.length === 0) return;
  
    setLoading(true);
  
    const processAndSetPlans = (plansData: ThesisPlan[]) => {
      const processed = plansData.map((plan) => {
          const fechaAsignacion = new Date(plan.submissionDate);
          const vencimientoOriginal = addYears(fechaAsignacion, 1);
          
          const fechaVencimientoFinal = (plan.ampliacion?.activa && plan.ampliacion?.fechaNuevoVencimiento) 
              ? new Date(plan.ampliacion.fechaNuevoVencimiento) 
              : vencimientoOriginal;

          let diasRestantes;
          if (plan.estadoGlobal === 'CULMINADO' && plan.fechaAprobacionAsesoria) {
              diasRestantes = differenceInCalendarDays(fechaVencimientoFinal, new Date(plan.fechaAprobacionAsesoria));
          } else {
              diasRestantes = differenceInCalendarDays(fechaVencimientoFinal, new Date());
          }

          let diasDesdeUltimaAsistencia: number | undefined;
          if (plan.asistencias && plan.asistencias.length > 0) {
              const ultimaAsistencia = new Date(plan.asistencias.sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0]);
              diasDesdeUltimaAsistencia = differenceInCalendarDays(new Date(), ultimaAsistencia);
          } else {
              diasDesdeUltimaAsistencia = differenceInCalendarDays(new Date(), fechaAsignacion);
          }

          const supervisorAsesores = docentes.find(d => d.uid === plan.supervisorAsesoresId);
          const asesor = docentes.find(d => d.uid === plan.asesorId);

          return {
            ...plan,
            fechaVencimientoAsesoria: vencimientoOriginal.toISOString(),
            diasRestantesAsesoria: diasRestantes,
            diasDesdeUltimaAsistencia,
            supervisorAsesores,
            asesor,
          } as PlanAsesoriaConDetalles;
        })
        .sort((a, b) => a.estudiante.apellidosNombres.localeCompare(b.estudiante.apellidosNombres));
        
      setPlans(processed);
      setLoading(false);
    };
  
    const isAdminOrDecano = appUser.roles.includes("admin") || appUser.roles.includes("decano");
    const isSupervisor = appUser.roles.includes("docente_supervisor_asesores");
    const isAsesor = appUser.roles.includes("docente_asesor");

    let finalQuery: Query | null = null;
    
    if (isAdminOrDecano) {
        finalQuery = query(collection(db, "thesisPlans"));
    } else if (isSupervisor) {
        finalQuery = query(collection(db, "thesisPlans"), where("supervisorAsesoresId", "==", appUser.uid));
    } else if (isAsesor) {
        finalQuery = query(collection(db, "thesisPlans"), where("asesorId", "==", appUser.uid));
    }

    if (!finalQuery) {
        setPlans([]);
        setLoading(false);
        return;
    }
  
    const unsubscribe = onSnapshot(finalQuery, (snapshot) => {
        const advisoryStates = ["EN ASESORIA", "CULMINADO", "ARCHIVADO", "VENCIDO", "DESAPROBADO"];
        const plansData = snapshot.docs
            .map(doc => ({ ...doc.data(), id: doc.id } as ThesisPlan))
            .filter(plan => !!plan.asesorId && advisoryStates.includes(plan.estadoGlobal));
        processAndSetPlans(plansData);
    }, (error) => {
        console.error("Error fetching advisory plans:", error);
        toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar los planes de asesoría." });
        setLoading(false);
    });

    return () => unsubscribe();

  }, [appUser, docentes, toast]);


  const supervisors = useMemo(() => {
    return Array.from(new Set(plans.map((p) => p.supervisorAsesoresId).filter(Boolean)))
      .map((id) => docentes.find((d) => d.uid === id))
      .filter((d): d is User | Docente => !!d);
  }, [plans, docentes]);

  const filteredPlans = useMemo(() => {
    let currentPlans = plans;
    
    if (selectedSupervisor !== "all") {
      currentPlans = currentPlans.filter(p => p.supervisorAsesoresId === selectedSupervisor);
    }

    if (searchTerm) {
        currentPlans = currentPlans.filter(p =>
            p.estudiante.apellidosNombres.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    return currentPlans;
  }, [plans, selectedSupervisor, searchTerm]);
  
  const {
    enAsesoriaPlans,
    aprobadoPlans,
    archivadoPlans,
    registeredInProcessAdvisory,
    registeredApprovedAdvisory,
  } = useMemo(() => {
    const basePlans = filteredPlans; 
    return {
      enAsesoriaPlans: basePlans.filter(p => p.estadoGlobal === "EN ASESORIA"),
      aprobadoPlans: basePlans.filter(p => p.estadoGlobal === "CULMINADO"),
      archivadoPlans: basePlans.filter(p => p.estadoGlobal === "ARCHIVADO" || p.estadoGlobal === "DESAPROBADO" || p.estadoGlobal === "VENCIDO"),
      registeredInProcessAdvisory: basePlans.filter(p => p.estadoGlobal === "EN ASESORIA"),
      registeredApprovedAdvisory: basePlans.filter(p => p.estadoGlobal === "CULMINADO"),
    };
  }, [filteredPlans]);

  const NavLink = ({ value, label }: { value: string; label: string }) => (
    <Button
      variant="ghost"
      onClick={() => setActiveTab(value)}
      className={cn(
        "text-muted-foreground transition-all h-auto px-4 py-2.5",
        activeTab === value &&
          "text-primary border-b-2 border-primary rounded-none font-semibold"
      )}
    >
      {label}
    </Button>
  );

  const DropdownNavLink = ({ value, label }: { value: string; label: string }) => (
    <DropdownMenuItem
      onSelect={() => setActiveTab(value)}
      className={cn(activeTab === value && "font-bold bg-accent/50")}
    >
      {label}
    </DropdownMenuItem>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
       <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <CardTitle className="flex items-center gap-2">
                <FolderKanban className="w-6 h-6"/>
                Gestión de Asesorías de Tesis
            </CardTitle>
            <CardDescription>
            Supervise y gestione el progreso de las asesorías de tesis asignadas, incluyendo revisiones APA y Turnitin.
            </CardDescription>
        </div>
         <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative flex-1 md:grow-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Buscar por alumno..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                  />
              </div>
            <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
            <SelectTrigger className="w-full md:w-[280px]">
                <SelectValue placeholder="Filtrar por supervisor..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos los Supervisores</SelectItem>
                {supervisors.map(supervisor => (
                <SelectItem key={supervisor.uid} value={supervisor.uid}>
                    {supervisor.nombre} {supervisor.apellidos}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b">
            <nav className="flex justify-center w-full">
              <div className="flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-4 md:gap-x-6 lg:gap-x-8">
                {isDecano ? (
                  <DropdownMenu onOpenChange={setIsDataViewOpen} open={isDataViewOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" onMouseEnter={() => setIsDataViewOpen(true)} className="flex items-center gap-1.5 text-base font-semibold px-4 py-2">
                            Vistas de Datos
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onMouseLeave={() => setIsDataViewOpen(false)}>
                        <DropdownNavLink label={`Datos en Proceso (${registeredInProcessAdvisory.length})`} value="datos-en-proceso" />
                        <DropdownNavLink label={`Datos Aprobados (${registeredApprovedAdvisory.length})`} value="datos-aprobados" />
                        <DropdownMenuSeparator />
                        <DropdownNavLink label="Registro General" value="registro-general" />
                    </DropdownMenuContent>
                </DropdownMenu>
                ) : (
                  <>
                    <NavLink value="en-asesoria" label={`Planes en Asesoría (${enAsesoriaPlans.length})`} />
                    <NavLink value="aprobado" label={`Asesorías Aprobadas (${aprobadoPlans.length})`} />
                    <NavLink value="archivado" label={`Archivados (${archivadoPlans.length})`} />
                    <DropdownMenu onOpenChange={setIsDataViewOpen} open={isDataViewOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" onMouseEnter={() => setIsDataViewOpen(true)} className={cn("text-muted-foreground transition-all h-auto px-4 py-2.5 flex items-center gap-1.5", isDataViewOpen && "text-primary font-semibold")}>
                                Vistas de Datos
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onMouseLeave={() => setIsDataViewOpen(false)}>
                          <DropdownNavLink label={`Datos en Proceso (${registeredInProcessAdvisory.length})`} value="datos-en-proceso" />
                          <DropdownNavLink label={`Datos Aprobados (${registeredApprovedAdvisory.length})`} value="datos-aprobados" />
                          <DropdownMenuSeparator />
                          <DropdownNavLink label="Registro General" value="registro-general" />
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </nav>
          </div>

          <TabsContent value="en-asesoria" className="mt-4">
            <AsesoriaList plans={enAsesoriaPlans} accordionRef={accordionRef} isDecano={isDecano ?? false}/>
          </TabsContent>
          <TabsContent value="aprobado" className="mt-4">
            <AsesoriaList plans={aprobadoPlans} accordionRef={accordionRef} isDecano={isDecano ?? false}/>
          </TabsContent>
           <TabsContent value="archivado" className="mt-4">
            <ArchivedAdvisoryView plans={archivadoPlans} />
          </TabsContent>
           <TabsContent value="datos-en-proceso" className="mt-4">
              <AdvisoryHistoryView plans={registeredInProcessAdvisory} />
          </TabsContent>
           <TabsContent value="datos-aprobados" className="mt-4">
              <AdvisoryHistoryView plans={registeredApprovedAdvisory} />
          </TabsContent>
          <TabsContent value="registro-general" className="mt-4">
            <RegistroGeneralAsesorias plans={filteredPlans.filter(p => p.estadoGlobal === "EN ASESORIA")} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RegistroGeneralAsesorias({ plans }: { plans: PlanAsesoriaConDetalles[] }) {
  if (plans.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No hay datos de asesorías para mostrar.</p>;
  }
  return <AdvisoryDataTable plans={plans} />;
}

export default function AdvisoriesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><LoaderCircle className="h-12 w-12 animate-spin text-primary" /></div>}>
      <AdvisoriesPageContent />
    </Suspense>
  )
}

    

    

    

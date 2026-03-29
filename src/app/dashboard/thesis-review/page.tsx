

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, SubmitHandler, FormProvider }
from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { onSnapshot, collection, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ThesisPlan, User, Docente, RevisionStatus, ThesisPlanObservation } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format, addDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { logKeyAction } from "@/lib/actions";


import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
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
import { CalendarIcon, FileScan, LoaderCircle, Trash2, Download, Replace, Upload, CalendarDays, Clock, CheckCircle2, UserCircle, FileText, Archive, ArchiveRestore, X, Search, ChevronDown, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegisteredDataView } from "@/components/registered-data-view";
import { GeneralDataTable } from "@/components/general-data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DaysBadge } from "@/components/days-badge";
import { Switch } from "@/components/ui/switch";
import { ArchivedReviewsView } from "@/components/archived-reviews-view";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MultiSelectFilter } from "@/components/multi-select-filter";


export type PlanWithDetails = ThesisPlan & {
  supervisorRevisores?: User | Docente;
};

const archiveFormSchema = z.object({
  fechaArchivado: z.date({ required_error: "La fecha es requerida." }),
  motivoArchivado: z.string().min(5, { message: "El motivo es requerido (mín. 5 caracteres)." }),
});
type ArchiveFormData = z.infer<typeof archiveFormSchema>;

const observationSchema = z.object({
    id: z.string().default(() => doc(collection(db, 'temp')).id), // Fake ID for mapping
    oficioInforme: z.string().optional().nullable(),
    fechaInforme: z.date().optional().nullable(),
    oficioNotificacion: z.string().optional().nullable(),
    fechaNotificacion: z.date().optional().nullable(),
    description: z.string().optional().nullable(),
    informeUrl: z.string().optional().nullable(),

    fechaLevantamiento: z.date().optional().nullable(),
    oficioNotificacionLevantamiento: z.string().optional().nullable(),
    fechaNotificacionLevantamiento: z.date().optional().nullable(),
    levantamientoDescription: z.string().optional().nullable(),
    levantamientoUrl: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    // To be considered a valid observation, both notification fields must be present
    if (data.oficioNotificacion || data.fechaNotificacion) {
        if (!data.oficioNotificacion) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El oficio es requerido.", path: ["oficioNotificacion"] });
        }
        if (!data.fechaNotificacion) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha es requerida.", path: ["fechaNotificacion"] });
        }
    }
    // If a correction has started, both notification fields are required for it as well
    if (data.oficioNotificacionLevantamiento || data.fechaNotificacionLevantamiento) {
        if (!data.oficioNotificacionLevantamiento) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El oficio es requerido.", path: ["oficioNotificacionLevantamiento"] });
        }
        if (!data.fechaNotificacionLevantamiento) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha es requerida.", path: ["fechaNotificacionLevantamiento"] });
        }
    }
});


const revisorFormSchema = z.object({
  oficioDesignacion: z.string().optional().nullable(),
  aprobado: z.boolean().default(false),
  fechaAprobado: z.date().optional().nullable(),
  observaciones: z.array(observationSchema).optional(),
  fechaDesaprobado: z.date().optional().nullable(),
  motivoDesaprobado: z.string().optional().nullable(),
  revertirDesaprobacion: z.boolean().default(false),
});

type RevisorFormData = z.infer<typeof revisorFormSchema>;

const adminNotificationSchema = z.object({
  notificacionAdmin_comentario: z.string().optional().nullable(),
  notificacionAdmin_fecha: z.date().optional().nullable(),
  notificacionAdmin_activa: z.boolean().default(false),
}).refine(data => {
    if (data.notificacionAdmin_activa) {
        return !!data.notificacionAdmin_comentario && !!data.notificacionAdmin_fecha;
    }
    return true;
}, {
    message: "El comentario y la fecha son requeridos si el aviso está activo.",
    path: ["notificacionAdmin_comentario"],
});

type AdminNotificationFormData = z.infer<typeof adminNotificationSchema>;


// Helper component for date pickers to manage their state
function DatePickerField({ control, name, label, disabled = false }: { control: any, name: string, label: string, disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
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
                                selected={field.value ?? undefined}
                                onSelect={(date) => {
                                    field.onChange(date);
                                    setIsOpen(false);
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function SmallDatePickerField({ control, name, label, disabled = false }: { control: any, name: string, label: string, disabled?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-xs">{label}</FormLabel>
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 pr-1 text-left font-normal text-xs h-9 w-full justify-between", !field.value && "text-muted-foreground")} disabled={disabled}>
                                    <span className="flex-1">{field.value ? format(field.value, "P", { locale: es }) : <span>Seleccionar</span>}</span>
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
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage className="min-h-[1.25rem]"/>
                </FormItem>
            )}
        />
    );
}

function ReviewSummary({ plan, revisorKey }: { plan: PlanWithDetails, revisorKey: 'revisor1' | 'revisor2' }) {
    const revisorData = plan[revisorKey];
    if (!revisorData || !revisorData.id) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <h2 className="text-lg font-semibold">{revisorKey === 'revisor1' ? 'Revisor 1' : 'Revisor 2'}: No Asignado</h2>
                    <CardDescription>No hay un docente asignado a este rol.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const obsCount = revisorData.observaciones?.length || 0;
    const isApproved = revisorData.estado === "APROBADO" || !!revisorData.fechaAprobado;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{revisorKey === 'revisor1' ? 'Revisor 1' : 'Revisor 2'}</p>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <UserCircle className="h-5 w-5"/>
                            {revisorData.nombre}
                        </CardTitle>
                    </div>
                    <Badge className={cn("border-none", isApproved ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                        {revisorData.estado || RevisionStatus.RevisionPendiente}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <span className="font-medium text-muted-foreground">Oficio de Designación</span>
                    <span className="font-semibold">{revisorData.oficioDesignacion || "No especificado"}</span>
                </div>
                 {isApproved && (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                        <span className="font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/>Aprobado el</span>
                        <span className="font-semibold">{revisorData.fechaAprobado ? format(new Date(revisorData.fechaAprobado), 'PPP', {locale: es}) : 'N/A'}</span>
                    </div>
                )}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                    <span className="font-medium text-muted-foreground">Observaciones Registradas</span>
                    <span className="font-semibold">{obsCount}</span>
                </div>
                {obsCount > 0 && (
                    <div className="p-3 border rounded-lg">
                        <p className="font-medium text-muted-foreground mb-2">Ciclos de Observación</p>
                        <ul className="space-y-2">
                            {revisorData.observaciones?.map((obs, index) => (
                                <li key={obs.id} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 shrink-0"/>
                                    <span>Ciclo {index + 1}: Notificado el {obs.fechaNotificacion ? format(new Date(obs.fechaNotificacion), 'P', {locale: es}) : 'N/A'}. 
                                    {obs.fechaLevantamiento ? ` Levantado el ${format(new Date(obs.fechaLevantamiento), 'P', {locale: es})}.` : ' Pendiente de levantamiento.'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const getTimelineForRevisor = (plan: ThesisPlan, revisorKey: 'revisor1' | 'revisor2') => {
    const revisorData = plan[revisorKey];
    if (!revisorData || !plan.submissionDate) return { days: Infinity, turn: 'N/A', progress: 0, label: "Plazo de Revisión", isFinished: true };

    if (revisorData.estado === "APROBADO" || !!revisorData.fechaAprobado) {
        return { days: 0, progress: 100, label: "Revisión Aprobada", turn: 'Aprobado', isFinished: true };
    }
    
    // Find the last observation that is actually a valid entry (has notification date)
    const lastValidObservation = (revisorData.observaciones || [])
        .filter(obs => obs.fechaNotificacion)
        .sort((a, b) => new Date(b.fechaNotificacion!).getTime() - new Date(a.fechaNotificacion!).getTime())[0];

    // Turno del Alumno (7 días)
    if (lastValidObservation?.fechaNotificacion && !lastValidObservation.fechaNotificacionLevantamiento) {
        const startDate = new Date(lastValidObservation.fechaNotificacion);
        const endDate = addDays(startDate, 7);
        const totalDuration = 7;
        const daysRemaining = differenceInDays(endDate, new Date());
        const daysElapsed = totalDuration - daysRemaining;
        const progress = (daysElapsed / totalDuration) * 100;
        return { days: daysRemaining, progress: Math.max(0, Math.min(100, progress)), label: "Plazo del Alumno (7 días)", turn: "alumno", isFinished: false };
    }
    // Turno del Docente post-levantamiento (30 días)
    else if (lastValidObservation?.fechaNotificacionLevantamiento) {
        const startDate = new Date(lastValidObservation.fechaNotificacionLevantamiento);
        const endDate = addDays(startDate, 30);
        const totalDuration = 30;
        const daysRemaining = differenceInDays(endDate, new Date());
        const daysElapsed = totalDuration - daysRemaining;
        const progress = (daysElapsed / totalDuration) * 100;
        return { days: daysRemaining, progress: Math.max(0, Math.min(100, progress)), label: "Plazo del Docente (30 días)", turn: "docente", isFinished: false };
    }
    // Turno inicial del Docente (30 días)
    else {
        const startDate = new Date(plan.submissionDate);
        const endDate = addDays(startDate, 30);
        const totalDuration = 30;
        const daysRemaining = differenceInDays(endDate, new Date());
        const daysElapsed = totalDuration - daysRemaining;
        const progress = (daysElapsed / totalDuration) * 100;
        return { days: daysRemaining, progress: Math.max(0, Math.min(100, progress)), label: "Plazo Inicial del Docente (30 días)", turn: "docente", isFinished: false };
    }
};

const ReviewTimeline = ({ plan, revisorKey }: { plan: PlanWithDetails; revisorKey: 'revisor1' | 'revisor2' }) => {
    const timeline = useMemo(() => {
        return getTimelineForRevisor(plan, revisorKey);
    }, [plan, revisorKey]);

    return (
        <div className="space-y-2 mb-4">
            <p className="text-sm font-medium">{timeline.label}</p>
            <Progress value={timeline.progress} className="h-2"/>
            <div className="flex justify-end text-xs text-muted-foreground">
                <DaysBadge days={timeline.days} isFinished={timeline.isFinished} context="review" />
            </div>
        </div>
    );
};


function RevisorForm({ plan, revisorKey }: { plan: PlanWithDetails, revisorKey: 'revisor1' | 'revisor2' }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const revisorData = plan[revisorKey];
    const otroRevisorKey = revisorKey === 'revisor1' ? 'revisor2' : 'revisor1';
    const { appUser } = useAuth();
    
    const [isUploading, setIsUploading] = useState(false);
    
    const isArchived = plan.estadoGlobal === 'ARCHIVADO';
    
    const form = useForm<RevisorFormData>({
        resolver: zodResolver(revisorFormSchema),
        defaultValues: {
            aprobado: revisorData?.estado === "APROBADO" || !!revisorData?.fechaAprobado,
            oficioDesignacion: revisorData?.oficioDesignacion || "",
            observaciones: [],
            fechaAprobado: revisorData?.fechaAprobado ? new Date(revisorData.fechaAprobado) : undefined,
            fechaDesaprobado: revisorData?.fechaDesaprobado ? new Date(revisorData.fechaDesaprobado) : undefined,
            motivoDesaprobado: revisorData?.motivoDesaprobado || "",
            revertirDesaprobacion: false,
        },
    });
    
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "observaciones",
    });

    const isApproved = form.watch('aprobado');
    const isDisapproved = (revisorData?.estado === "DESAPROBADO" || !!revisorData?.fechaDesaprobado) && !form.watch('revertirDesaprobacion');
    const observacionesActuales = form.watch('observaciones');
    
    const canAddObservation = useMemo(() => {
        if (!observacionesActuales || observacionesActuales.length >= 3) return false;
        if (observacionesActuales.length === 0) return true;
        const lastObservation = observacionesActuales[observacionesActuales.length - 1];
        // Can add if the last one has been fully lifted (notification part)
        return !!(lastObservation.oficioNotificacion && lastObservation.fechaNotificacion && lastObservation.oficioNotificacionLevantamiento && lastObservation.fechaNotificacionLevantamiento);
    }, [observacionesActuales]);

    useEffect(() => {
        if (revisorData) {
            const obsData = (revisorData.observaciones || []).map(obs => ({
                ...obs,
                fechaInforme: obs.fechaInforme ? new Date(obs.fechaInforme) : null,
                fechaNotificacion: obs.fechaNotificacion ? new Date(obs.fechaNotificacion) : null,
                fechaLevantamiento: obs.fechaLevantamiento ? new Date(obs.fechaLevantamiento) : null,
                fechaNotificacionLevantamiento: obs.fechaNotificacionLevantamiento ? new Date(obs.fechaNotificacionLevantamiento) : null,
            }));

            form.reset({
                aprobado: revisorData.estado === "APROBADO" || !!revisorData.fechaAprobado,
                oficioDesignacion: revisorData.oficioDesignacion || "",
                fechaAprobado: revisorData.fechaAprobado ? new Date(revisorData.fechaAprobado) : undefined,
                observaciones: obsData,
                fechaDesaprobado: revisorData.fechaDesaprobado ? new Date(revisorData.fechaDesaprobado) : undefined,
                motivoDesaprobado: revisorData.motivoDesaprobado || "",
                revertirDesaprobacion: false,
            });
        }
    }, [revisorData, form]);

    const revertirDesaprobacion = form.watch('revertirDesaprobacion');
    useEffect(() => {
        if (revertirDesaprobacion) {
            form.setValue('fechaDesaprobado', undefined);
            form.setValue('motivoDesaprobado', '');
        }
    }, [revertirDesaprobacion, form]);

    const toISOOrNull = (date?: Date | null | string) => {
        if (!date) return null;
        try {
            const d = new Date(date);
            return !isNaN(d.getTime()) ? d.toISOString() : null;
        } catch (e) {
            return null;
        }
    }

    const isObservationEmpty = (obs: any) => {
        return !obs.oficioInforme && !obs.fechaInforme && !obs.oficioNotificacion && !obs.fechaNotificacion && !obs.description && !obs.informeUrl && !obs.fechaLevantamiento && !obs.oficioNotificacionLevantamiento && !obs.fechaNotificacionLevantamiento && !obs.levantamientoDescription && !obs.levantamientoUrl;
    };
      
    const handleIndividualFileUpload = async (index: number, type: 'informe' | 'levantamiento', file: File) => {
        if (!file) return;
        setIsUploading(true);
      
        try {
            if (file.size > 1048487) { // 1MB limit for Firestore document
                toast({
                    variant: "destructive",
                    title: "Archivo demasiado grande",
                    description: "El PDF es muy grande. Por favor, use archivos de menos de 1MB."
                });
                setIsUploading(false);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const dataUrl = reader.result as string;
                const urlField = type === 'informe' ? `observaciones.${index}.informeUrl` : `observaciones.${index}.levantamientoUrl`;
                form.setValue(urlField as any, dataUrl);
                toast({ title: "Archivo listo", description: "El PDF se ha cargado. Presione 'Guardar Cambios' para persistirlo." });
            };
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                toast({ variant: "destructive", title: "Error de Lectura", description: "No se pudo leer el archivo." });
            }
        } catch (error) {
          console.error("Error handling file:", error);
          toast({ variant: "destructive", title: "Error de Archivo", description: "No se pudo procesar el archivo." });
        } finally {
          setIsUploading(false);
        }
      };
      
    const onSubmit: SubmitHandler<RevisorFormData> = async (data) => {
        setLoading(true);
        
        // --- VALIDATION LOGIC ---
        if (data.aprobado && !data.fechaAprobado) {
            toast({ variant: "destructive", title: "Error de Validación", description: "Debe seleccionar una fecha de aprobación.", });
            setLoading(false);
            return;
        }

        const isDisapproving = !!data.fechaDesaprobado && !data.revertirDesaprobacion;
        if (isDisapproving && !data.motivoDesaprobado) {
            toast({ variant: "destructive", title: "Error de Validación", description: "Debe especificar un motivo de desaprobación." });
            setLoading(false);
            return;
        }

        for (const obs of data.observaciones || []) {
            if (obs.oficioNotificacion && !obs.fechaNotificacion) {
                toast({ variant: "destructive", title: "Observación Incompleta", description: "Una observación debe tener fecha de notificación si tiene oficio.", });
                setLoading(false);
                return;
            }
            if (!obs.oficioNotificacion && obs.fechaNotificacion) {
                toast({ variant: "destructive", title: "Observación Incompleta", description: "Una observación debe tener oficio de notificación si tiene fecha.", });
                setLoading(false);
                return;
            }
            if (obs.oficioNotificacionLevantamiento && !obs.fechaNotificacionLevantamiento) {
                toast({ variant: "destructive", title: "Levantamiento Incompleto", description: "Un levantamiento debe tener fecha de notificación si tiene oficio.", });
                setLoading(false);
                return;
            }
             if (!obs.oficioNotificacionLevantamiento && obs.fechaNotificacionLevantamiento) {
                toast({ variant: "destructive", title: "Levantamiento Incompleto", description: "Un levantamiento debe tener oficio de notificación si tiene fecha.", });
                setLoading(false);
                return;
            }
        }
        
        try {
            const planRef = doc(db, "thesisPlans", plan.id);
            
            const otroRevisor = plan[otroRevisorKey];
            const esteRevisorAprobado = data.aprobado;
            const esteRevisorDesaprobado = isDisapproving;
            const otroRevisorAprobado = otroRevisor?.estado === "APROBADO" || !!otroRevisor?.fechaAprobado;
            const otroRevisorDesaprobado = otroRevisor?.estado === "DESAPROBADO" || !!otroRevisor?.fechaDesaprobado;

            const filteredObservaciones = (data.observaciones || []).filter(obs => !isObservationEmpty(obs));
            
            const updatedObservaciones = filteredObservaciones.map(obs => ({
                id: obs.id || doc(collection(db, 'temp')).id,
                description: obs.description || null,
                oficioInforme: obs.oficioInforme || null,
                fechaInforme: toISOOrNull(obs.fechaInforme),
                oficioNotificacion: obs.oficioNotificacion || null,
                fechaNotificacion: toISOOrNull(obs.fechaNotificacion),
                informeUrl: obs.informeUrl || null,
                levantamientoDescription: obs.levantamientoDescription || null,
                fechaLevantamiento: toISOOrNull(obs.fechaLevantamiento),
                oficioNotificacionLevantamiento: obs.oficioNotificacionLevantamiento || null,
                fechaNotificacionLevantamiento: toISOOrNull(obs.fechaNotificacionLevantamiento),
                levantamientoUrl: obs.levantamientoUrl || null,
            })) || [];

            const updatePayload: any = { actualizadoEn: new Date() };
            
            if (!isApproved) {
                updatePayload[`${revisorKey}.oficioDesignacion`] = data.oficioDesignacion || null;
                updatePayload[`${revisorKey}.observaciones`] = updatedObservaciones;
            }
            
            if (data.revertirDesaprobacion) {
                updatePayload[`${revisorKey}.fechaDesaprobado`] = null;
                updatePayload[`${revisorKey}.motivoDesaprobado`] = null;
            } else {
                 updatePayload[`${revisorKey}.fechaDesaprobado`] = isDisapproving ? toISOOrNull(data.fechaDesaprobado) : null;
                 updatePayload[`${revisorKey}.motivoDesaprobado`] = isDisapproving ? data.motivoDesaprobado : null;
            }

            updatePayload[`${revisorKey}.fechaAprobado`] = data.aprobado ? toISOOrNull(data.fechaAprobado) : null;

            let finalStatus = "REVISION PENDIENTE";
            if (esteRevisorAprobado) finalStatus = "APROBADO";
            else if (esteRevisorDesaprobado) finalStatus = "DESAPROBADO";
            else if ((data.observaciones?.length ?? 0) > 0) finalStatus = "EN PROCESO";
            
            updatePayload[`${revisorKey}.estado`] = finalStatus;

            if (esteRevisorDesaprobado || otroRevisorDesaprobado) {
                if (!data.revertirDesaprobacion) updatePayload.estadoGlobal = 'DESAPROBADO';
            } else if (esteRevisorAprobado && otroRevisorAprobado) {
                updatePayload.estadoGlobal = 'LISTO PARA ASESOR';
                updatePayload.listoParaAsignacionAsesor = true;
            } else if(plan.estadoGlobal !== 'ARCHIVADO') {
                updatePayload.estadoGlobal = 'EN REVISION';
                updatePayload.listoParaAsignacionAsesor = false;
            }

            await updateDoc(planRef, updatePayload);

            if (appUser) {
                await logKeyAction({ userId: appUser.uid, action: 'update_review_plan', details: `Plan ID: ${plan.id}` });
            }
            
            toast({ title: "Éxito", description: `Los datos para ${revisorData?.nombre} han sido actualizados.` });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la información." });
        } finally {
            setLoading(false);
        }
    };
    
    if (!revisorData || !revisorData.id) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <h2 className="text-lg font-semibold">{revisorKey === 'revisor1' ? 'Revisor 1' : 'Revisor 2'}: No Asignado</h2>
                    <CardDescription>No hay un docente asignado a este rol.</CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    const showDisapprovalForm = (observacionesActuales?.length ?? 0) >= 3 && !canAddObservation;
    const isFormDisabled = isArchived;
    const isPartiallyLocked = isApproved || isDisapproved;


    return (
        <FormProvider {...form}>
            <Form {...form}>
                <Accordion type="single" collapsible className="w-full border rounded-lg">
                    <AccordionItem value={`revisor-item-${revisorKey}`}>
                        <AccordionTrigger className="hover:no-underline p-4">
                             <div className="flex flex-col w-full text-left">
                                <h2 className="text-lg font-semibold">{revisorKey === 'revisor1' ? 'Revisor 1' : 'Revisor 2'}: {revisorData.nombre}</h2>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col pt-0">
                                <CardContent className="flex-1 space-y-6">
                                     <ReviewTimeline plan={plan} revisorKey={revisorKey} />

                                     <FormField control={form.control} name="oficioDesignacion" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Oficio de Designación</FormLabel>
                                            <FormControl><Input placeholder="OFICIO-XXXX-YYYY" {...field} value={field.value ?? ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Observaciones</h4>
                                        <Accordion type="multiple" className="w-full space-y-2">
                                            {fields.map((field, index) => (
                                                <AccordionItem value={`item-${revisorKey}-${index}`} className="border bg-muted/30 rounded-md" key={field.id}>
                                                    <AccordionTrigger className="w-full text-left hover:no-underline py-3 px-4 flex-1">
                                                        <span className="font-semibold">Observacion y Levantamiento {index + 1}</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-0">
                                                        <div className="p-4 border-t space-y-6">
                                                            <div className="space-y-4">
                                                                <p className="text-xs font-semibold text-muted-foreground">Observacion del docente</p>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField control={form.control} name={`observaciones.${index}.oficioInforme`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Informe o documento de la observacion</FormLabel>
                                                                            <FormControl><Input placeholder="OFICIO-INF-XXXX" {...field} value={field.value ?? ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                    <SmallDatePickerField control={form.control} name={`observaciones.${index}.fechaInforme`} label="Fecha del informe" disabled={isFormDisabled || isPartiallyLocked} />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField control={form.control} name={`observaciones.${index}.oficioNotificacion`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Oficio de notificacion del alumno</FormLabel>
                                                                            <FormControl><Input placeholder="OFICIO-NOT-XXXX" {...field} value={field.value ?? ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                    <SmallDatePickerField control={form.control} name={`observaciones.${index}.fechaNotificacion`} label="Fecha de notificacion" disabled={isFormDisabled || isPartiallyLocked} />
                                                                </div>
                                                                 <FormField
                                                                    control={form.control}
                                                                    name={`observaciones.${index}.informeUrl`}
                                                                    render={({ field: urlField }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Adjuntar informe de observación (PDF)</FormLabel>
                                                                            {urlField.value ? (
                                                                                <div className="flex items-center gap-2 text-sm">
                                                                                    <p className="flex-grow p-2 bg-background border rounded-md truncate">Informe Cargado</p>
                                                                                     <Button variant="outline" size="sm" className="gap-2" asChild>
                                                                                        <a href={urlField.value} download={`informe_${plan.estudiante.codigo}_${index}.pdf`}><Download size={14}/>Ver</a>
                                                                                     </Button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-2">
                                                                                    <FormControl>
                                                                                        <Input type="file" accept=".pdf" className="text-xs" disabled={isFormDisabled || isPartiallyLocked || isUploading} onChange={(e) => e.target.files && handleIndividualFileUpload(index, 'informe', e.target.files[0])}/>
                                                                                    </FormControl>
                                                                                    {isUploading && <LoaderCircle size={14} className="animate-spin" />}
                                                                                </div>
                                                                            )}
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField control={form.control} name={`observaciones.${index}.description`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs">Descripción de la Observación (Opcional)</FormLabel>
                                                                        <FormControl><Textarea placeholder="Detalle la observación del revisor..." {...field} value={field.value || ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </div>
                                                            
                                                            <Separator />

                                                            <div className="space-y-4">
                                                                <p className="text-xs font-semibold text-muted-foreground">Levantamiento del Alumno</p>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <SmallDatePickerField control={form.control} name={`observaciones.${index}.fechaLevantamiento`} label="Fecha de Levantamiento" disabled={isFormDisabled || isPartiallyLocked} />
                                                                    <div></div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <FormField control={form.control} name={`observaciones.${index}.oficioNotificacionLevantamiento`} render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Oficio Notif. Levantamiento al Docente</FormLabel>
                                                                            <FormControl><Input placeholder="OFICIO-NOT-LEV-XXXX" {...field} value={field.value || ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                    <SmallDatePickerField control={form.control} name={`observaciones.${index}.fechaNotificacionLevantamiento`} label="Fecha Notif. Levantamiento" disabled={isFormDisabled || isPartiallyLocked} />
                                                                </div>
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`observaciones.${index}.levantamientoUrl`}
                                                                    render={({ field: urlField }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Adjuntar levantamiento de observaciones (PDF)</FormLabel>
                                                                            {urlField.value ? (
                                                                                <div className="flex items-center gap-2 text-sm">
                                                                                    <p className="flex-grow p-2 bg-background border rounded-md truncate">Levantamiento Cargado</p>
                                                                                     <Button variant="outline" size="sm" className="gap-2" asChild>
                                                                                        <a href={urlField.value} download={`levantamiento_${plan.estudiante.codigo}_${index}.pdf`}><Download size={14}/>Ver</a>
                                                                                     </Button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-2">
                                                                                    <FormControl>
                                                                                         <Input type="file" accept=".pdf" className="text-xs" disabled={isFormDisabled || isPartiallyLocked || isUploading} onChange={(e) => e.target.files && handleIndividualFileUpload(index, 'levantamiento', e.target.files[0])}/>
                                                                                    </FormControl>
                                                                                    {isUploading && <LoaderCircle size={14} className="animate-spin" />}
                                                                                </div>
                                                                            )}
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField control={form.control} name={`observaciones.${index}.levantamientoDescription`} render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs">Descripción del Levantamiento</FormLabel>
                                                                        <FormControl><Textarea placeholder="Detalle del levantamiento del alumno..." {...field} value={field.value || ''} disabled={isFormDisabled || isPartiallyLocked} /></FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </div>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (canAddObservation) {
                                                    append({
                                                        id: doc(collection(db, 'temp')).id,
                                                        oficioInforme: "",
                                                        fechaInforme: null,
                                                        oficioNotificacion: '',
                                                        fechaNotificacion: null,
                                                        description: "",
                                                        fechaLevantamiento: null,
                                                        oficioNotificacionLevantamiento: '',
                                                        fechaNotificacionLevantamiento: null,
                                                        levantamientoDescription: "",
                                                    });
                                                }
                                            }}
                                            className="mt-2"
                                            disabled={!canAddObservation || isFormDisabled || isPartiallyLocked}
                                        >
                                            Añadir Observacion
                                        </Button>
                                    </div>
                                    
                                     {showDisapprovalForm && !isApproved && (
                                        <div className="space-y-4 pt-4 border-t border-destructive/50">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-sm font-medium text-destructive">Desaprobación del Plan de Tesis</h4>
                                                {isDisapproved && (
                                                    <FormField control={form.control} name="revertirDesaprobacion" render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isArchived} /></FormControl>
                                                            <FormLabel className="text-xs">Revertir Desaprobación</FormLabel>
                                                        </FormItem>
                                                    )} />
                                                )}
                                            </div>
                                            <div className={cn("grid grid-cols-2 gap-4 items-start", (isDisapproved && !revertirDesaprobacion) && "opacity-50 pointer-events-none")}>
                                                <DatePickerField control={form.control} name="fechaDesaprobado" label="Fecha Desaprobado" disabled={isArchived || (isDisapproved && !revertirDesaprobacion)} />
                                                <FormField control={form.control} name="motivoDesaprobado" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Motivo de Desaprobación</FormLabel>
                                                        <FormControl><Textarea placeholder="El alumno no ha subsanado las observaciones..." {...field} value={field.value ?? ''} disabled={isArchived || (isDisapproved && !revertirDesaprobacion)} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4 pt-4">
                                        <h4 className="text-sm font-medium">Aprobación Final del Plan de Tesis</h4>
                                        <div className={cn("grid grid-cols-2 gap-4 items-end", isDisapproved && 'opacity-50 pointer-events-none')}>
                                            <DatePickerField control={form.control} name="fechaAprobado" label="Fecha Aprobado" disabled={isArchived || isDisapproved} />
                                            <FormField
                                                control={form.control}
                                                name="aprobado"
                                                render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        disabled={isArchived || isDisapproved}
                                                    />
                                                    </FormControl>
                                                    <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        Plan Aprobado
                                                    </FormLabel>
                                                    </div>
                                                </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button type="submit" disabled={loading || isArchived} className="w-full">
                                        {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                        {isArchived ? 'Plan de Tesis Archivado' : 'Guardar Cambios del Revisor'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Form>
        </FormProvider>
    )
}

function AdminNotificationForm({ plan }: { plan: PlanWithDetails }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const { appUser } = useAuth();
    
    const form = useForm<AdminNotificationFormData>({
        resolver: zodResolver(adminNotificationSchema),
        defaultValues: {
            notificacionAdmin_comentario: plan.notificacionAdmin?.comentario || "",
            notificacionAdmin_fecha: plan.notificacionAdmin?.fecha ? new Date(plan.notificacionAdmin.fecha) : undefined,
            notificacionAdmin_activa: plan.notificacionAdmin?.activa || false,
        },
    });

    const notificacionActiva = form.watch('notificacionAdmin_activa');

    useEffect(() => {
        form.reset({
            notificacionAdmin_comentario: plan.notificacionAdmin?.comentario || "",
            notificacionAdmin_fecha: plan.notificacionAdmin?.fecha ? new Date(plan.notificacionAdmin.fecha) : undefined,
            notificacionAdmin_activa: plan.notificacionAdmin?.activa || false,
        });
    }, [plan, form]);
    
    const toISOOrNull = (date?: Date | null | string) => {
        if (!date) return null;
        try {
            const d = new Date(date);
            return !isNaN(d.getTime()) ? d.toISOString() : null;
        } catch (e) {
            return null;
        }
    }

    const onSubmit: SubmitHandler<AdminNotificationFormData> = async (data) => {
        setLoading(true);
        try {
            const planRef = doc(db, "thesisPlans", plan.id);
            
            const updatePayload = {
                notificacionAdmin: {
                    activa: data.notificacionAdmin_activa,
                    comentario: data.notificacionAdmin_activa ? data.notificacionAdmin_comentario : null,
                    fecha: data.notificacionAdmin_activa ? toISOOrNull(data.notificacionAdmin_fecha) : null,
                },
                actualizadoEn: new Date(),
            };
            
            await updateDoc(planRef, updatePayload);
            toast({ title: "Éxito", description: "La notificación administrativa ha sido actualizada." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la notificación." });
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteNotification = async () => {
        setLoading(true);
        form.reset({
            notificacionAdmin_comentario: "",
            notificacionAdmin_fecha: undefined,
            notificacionAdmin_activa: false,
        });
        try {
            const planRef = doc(db, "thesisPlans", plan.id);
             const updatePayload = {
                notificacionAdmin: {
                    activa: false,
                    comentario: null,
                    fecha: null,
                },
                actualizadoEn: new Date(),
            };
            await updateDoc(planRef, updatePayload);
            toast({ title: "Aviso Eliminado", description: "La notificación administrativa ha sido eliminada." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el aviso." });
        } finally {
            setLoading(false);
        }
    };

    if (!appUser?.roles.includes('admin')) return null;

    return (
        <Card>
            <Form {...form}>
                 <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-blue-600 flex items-center gap-2">
                                <Megaphone size={20}/>
                                Notificación Administrativa
                                </CardTitle>
                                <CardDescription>Añade un aviso general a este plan de tesis. Será visible para todos los roles involucrados.</CardDescription>
                            </div>
                            <FormField
                                control={form.control}
                                name="notificacionAdmin_activa"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={(checked) => {
                                                    field.onChange(checked);
                                                    if (!checked) {
                                                        form.setValue("notificacionAdmin_comentario", "");
                                                        form.setValue("notificacionAdmin_fecha", undefined);
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel>Activar</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardHeader>
                    {notificacionActiva && (
                        <>
                        <CardContent className="space-y-4 pt-4 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <FormField control={form.control} name="notificacionAdmin_comentario" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Comentario del Aviso</FormLabel>
                                        <FormControl><Textarea placeholder="Ej: Contactar urgentemente con secretaría..." {...field} value={field.value || ''} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <DatePickerField control={form.control} name="notificacionAdmin_fecha" label="Fecha del Aviso" />
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button type="button" variant="destructive" disabled={loading} size="sm">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar Aviso
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción eliminará el aviso de forma permanente.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteNotification}>Sí, eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button type="submit" disabled={loading} size="sm">
                                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Notificación
                            </Button>
                        </CardFooter>
                        </>
                    )}
                </form>
            </Form>
        </Card>
    );
}

function ArchiveManager({ plan }: { plan: PlanWithDetails }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isPlanLocked = plan.estadoGlobal === 'LISTO PARA ASESOR';
  const { appUser } = useAuth();

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

  const toISOOrNull = (date?: Date | null) => (date ? date.toISOString() : null);

  const handleArchive = async (data: ArchiveFormData) => {
    setLoading(true);
    try {
      const planRef = doc(db, "thesisPlans", plan.id);
      await updateDoc(planRef, {
        estadoGlobal: 'ARCHIVADO',
        'archivo.archivado': true,
        'archivo.fecha': toISOOrNull(data.fechaArchivado),
        'archivo.motivo': data.motivoArchivado,
        actualizadoEn: new Date(),
      });
      if (appUser) {
        await logKeyAction({ userId: appUser.uid, action: 'archive_plan', details: `Plan ID: ${plan.id}` });
      }
      toast({ title: "Plan de Tesis Archivado", description: "El plan de tesis ha sido movido al archivo." });
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo archivar el plan de tesis." });
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async () => {
    setLoading(true);
    try {
      const planRef = doc(db, "thesisPlans", plan.id);
      await updateDoc(planRef, {
        estadoGlobal: 'EN REVISION',
        'archivo.archivado': false,
        'archivo.fecha': null,
        'archivo.motivo': null,
        actualizadoEn: new Date(),
      });
      if (appUser) {
        await logKeyAction({ userId: appUser.uid, action: 'unarchive_plan', details: `Plan ID: ${plan.id}` });
      }
      toast({ title: "Plan de Tesis Restaurado", description: "El plan de tesis ha sido sacado del archivo." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo restaurar el plan de tesis." });
    } finally {
      setLoading(false);
    }
  };

  if (plan.estadoGlobal === 'ARCHIVADO') {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={loading}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <ArchiveRestore className="mr-2 h-4 w-4"/>}
              Restaurar Plan de Tesis
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Está seguro de restaurar este plan de tesis?</AlertDialogTitle>
                <AlertDialogDescription>
                    El plan de tesis volverá al estado "EN REVISION" y estará activo de nuevo.
                </AlertDialogDescription>
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
        <Button variant="destructive" disabled={isPlanLocked || loading}>
          <Archive className="mr-2 h-4 w-4" />
          Archivar Plan de Tesis
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleArchive)}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Archivar Plan de Tesis</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción marcará el plan de tesis como archivado. Úselo para planes vencidos o abandonados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                    <DatePickerField control={form.control} name="fechaArchivado" label="Fecha de Archivo"/>
                    <FormField control={form.control} name="motivoArchivado" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Motivo del Archivo</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Ej: Vencimiento de plazo, abandono del alumno..." {...field} />
                            </FormControl>
                            <FormMessage/>
                        </FormItem>
                    )} />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <Button type="submit" disabled={loading}>
                        {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirmar Archivo
                    </Button>
                </AlertDialogFooter>
            </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PlanList({ plans, docentes, accordionRef, isDecano }: { plans: PlanWithDetails[], docentes: (User | Docente)[], accordionRef: React.RefObject<HTMLDivElement>, isDecano: boolean }) {
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
            const revisor1 = docentes.find((d) => d.uid === plan.docenteRevisor1Id);
            const revisor2 = docentes.find((d) => d.uid === plan.docenteRevisor2Id);
      
            const isApproved = plan.estadoGlobal === "LISTO PARA ASESOR";
      
            const hasAdminNotification = plan.notificacionAdmin?.activa && plan.notificacionAdmin?.comentario;

            const timeline1 = getTimelineForRevisor(plan, "revisor1");
            const timeline2 = getTimelineForRevisor(plan, "revisor2");
      
            return (
              <AccordionItem value={plan.id} key={plan.id}>
                <AccordionTrigger className="hover:no-underline px-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="font-semibold text-sm w-8 text-center">{index + 1}</div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold">{plan.estudiante.apellidosNombres}</p>
                      <p className="text-sm text-muted-foreground whitespace-normal break-words">{plan.titulo}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                        {plan.supervisorRevisores && (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20">
                            Sup: {plan.supervisorRevisores.nombre} {plan.supervisorRevisores.apellidos}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                            {revisor1 && (
                                <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:bg-gray-900/20">
                                    Rev.1: {revisor1.nombre} {revisor1.apellidos}
                                </Badge>
                            )}
                            {(timeline1.days < 8 && !timeline1.isFinished) && (
                                 <DaysBadge days={timeline1.days} isFinished={timeline1.isFinished} prefix={timeline1.turn === "alumno" ? "Alumno:" : "Docente:"} context="review" />
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {revisor2 && (
                                <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:bg-gray-900/20">
                                    Rev.2: {revisor2.nombre} {revisor2.apellidos}
                                </Badge>
                            )}
                             {(timeline2.days < 8 && !timeline2.isFinished) && (
                                <DaysBadge days={timeline2.days} isFinished={timeline2.isFinished} prefix={timeline2.turn === "alumno" ? "Alumno:" : "Docente:"} context="review" />
                            )}
                        </div>
                        {hasAdminNotification && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div onClick={(e) => e.stopPropagation()} className="inline-block">
                                            <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1.5">
                                                <Megaphone size={12} />
                                                {plan.notificacionAdmin!.comentario}
                                                {plan.notificacionAdmin!.fecha && ` (${format(new Date(plan.notificacionAdmin!.fecha), "P", { locale: es })})`}
                                            </Badge>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{plan.notificacionAdmin!.comentario}</p>
                                        {plan.notificacionAdmin!.fecha && <p className="text-xs text-muted-foreground">{format(new Date(plan.notificacionAdmin!.fecha), "PPP", { locale: es })}</p>}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                     <Badge className={cn("border-none", isApproved ? "bg-cyan-100 text-cyan-800" : (plan.estadoGlobal === "EN REVISION" ? "bg-blue-100 text-blue-800" : (plan.estadoGlobal === "ARCHIVADO" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800")))}>
                      {isApproved ? "APROBADO" : plan.estadoGlobal}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <div className="flex w-full items-center gap-4 text-sm px-4">
                    <div className="flex flex-1 items-center gap-3 p-3 rounded-lg border bg-muted/50 h-full">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">Fecha Asignación</p>
                        <p>{plan.submissionDate ? format(new Date(plan.submissionDate), "PPP", { locale: es }) : "N/A"}</p>
                      </div>
                    </div>
                    {!isDecano && (
                      <div className="flex-shrink-0">
                        <ArchiveManager plan={plan} />
                      </div>
                    )}
                  </div>

                  <div className="px-4">
                    <AdminNotificationForm plan={plan} />
                  </div>
      
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start px-4">
                    {isDecano ? <ReviewSummary plan={plan} revisorKey="revisor1" /> : <RevisorForm key={`revisor1-${plan.id}`} plan={plan} revisorKey="revisor1" />}
                    {isDecano ? <ReviewSummary plan={plan} revisorKey="revisor2" /> : <RevisorForm key={`revisor2-${plan.id}`} plan={plan} revisorKey="revisor2" />}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      );
}

export default function ThesisReviewPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanWithDetails[]>([]);
  const [docentes, setDocentes] = useState<(User | Docente)[]>([]);
  const { appUser } = useAuth();
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");


  const searchParams = useSearchParams();
  const router = useRouter();
  const accordionRef = useRef<HTMLDivElement>(null);
  
  const isDecano = appUser?.roles.includes('decano') && !appUser?.roles.includes('admin');
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || (isDecano ? 'datos-en-proceso' : 'in-review'));
  const [isDataViewOpen, setIsDataViewOpen] = useState(false);


  useEffect(() => {
    if (isDecano) {
        setActiveTab(searchParams.get('tab') || 'datos-en-proceso');
    } else {
        setActiveTab(searchParams.get('tab') || 'in-review');
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

    const isAdminOrDecano = appUser.roles.includes("admin") || appUser.roles.includes("decano");
    
    let plansQuery: any;
    
    if (isAdminOrDecano) {
        plansQuery = query(collection(db, "thesisPlans"));
    } else if (appUser.roles.includes("docente_supervisor_revisores")) {
        plansQuery = query(collection(db, "thesisPlans"), where("supervisorRevisoresId", "==", appUser.uid));
    } else {
        setPlans([]);
        setLoading(false);
        return;
    }

    const unsubscribe = onSnapshot(plansQuery, (snapshot: any) => {
        const reviewStates = ["EN REVISION", "LISTO PARA ASESOR", "ARCHIVADO", "DESAPROBADO"];
        const allPlans = snapshot.docs
            .map((doc: any) => ({...doc.data(), id: doc.id}))
            .filter((plan: any) => {
                const p = plan as ThesisPlan;
                return p.supervisorRevisoresId && reviewStates.includes(p.estadoGlobal);
            }) as ThesisPlan[];

        const plansData = allPlans.map((plan: any) => {
            const timeline1 = getTimelineForRevisor(plan, "revisor1");
            const timeline2 = getTimelineForRevisor(plan, "revisor2");
            
            const getRevisorStatus = (revisorData: ThesisPlan['revisor1'], timeline: ReturnType<typeof getTimelineForRevisor>): RevisionStatus => {
                if (!revisorData || !revisorData.id) return RevisionStatus.RevisionPendiente;
                
                if (revisorData.fechaAprobado) return RevisionStatus.APROBADO;
                if (revisorData.fechaDesaprobado) return RevisionStatus.Desaprobado;
                
                if (timeline.days < 0) return RevisionStatus.Vencido;
                if (timeline.days <= 7) return RevisionStatus.PorVencer;

                return RevisionStatus.EnProceso;
            };

            const supervisorRevisores = docentes.find((d) => d.uid === plan.supervisorRevisoresId);
            const revisor1Docente = docentes.find((d) => d.uid === plan.docenteRevisor1Id);
            const revisor2Docente = docentes.find((d) => d.uid === plan.docenteRevisor2Id);

            return {
            ...plan,
            id: plan.id, // Ensure document ID is present
            diasRestantesRevision: Math.min(timeline1.days, timeline2.days),
            supervisorRevisores,
            revisor1: {
                ...(plan.revisor1 || {}),
                id: revisor1Docente?.uid || '',
                nombre: revisor1Docente ? `${revisor1Docente.nombre} ${revisor1Docente.apellidos}`: 'No asignado',
                estado: getRevisorStatus(plan.revisor1, timeline1),
            },
            revisor2: {
                ...(plan.revisor2 || {}),
                id: revisor2Docente?.uid || '',
                nombre: revisor2Docente ? `${revisor2Docente.nombre} ${revisor2Docente.apellidos}` : 'No asignado',
                estado: getRevisorStatus(plan.revisor2, timeline2),
            },
            } as PlanWithDetails;
        }).sort((a, b) => a.estudiante.apellidosNombres.localeCompare(b.estudiante.apellidosNombres));
        
        setPlans(plansData);
        setLoading(false);
    });

    return () => unsubscribe();
}, [appUser, docentes]);

  const supervisors = useMemo(() => {
    return Array.from(new Set(plans.map((p) => p.supervisorRevisoresId).filter(Boolean)))
      .map((id) => docentes.find((d) => d.uid === id))
      .filter((d): d is User | Docente => !!d);
  }, [plans, docentes]);

  const filteredPlans = useMemo(() => {
      let currentPlans = plans;
      if (selectedSupervisor !== "all") {
        currentPlans = currentPlans.filter(p => p.supervisorRevisoresId === selectedSupervisor);
      }
      if (searchTerm) {
        currentPlans = currentPlans.filter(p =>
            p.estudiante.apellidosNombres.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return currentPlans;
  }, [plans, selectedSupervisor, searchTerm]);

  const {
    inReviewPlans,
    approvedPlans,
    archivedOrDisapprovedPlans,
    registeredInProcess,
    registeredApproved,
    registeredArchivedAndDisapproved,
  } = useMemo(() => {
    const basePlans = filteredPlans.filter(p => !p.asesorId); // Only revision plans
    const desaprobados = basePlans.filter(p => p.estadoGlobal === "DESAPROBADO");
    const archivados = basePlans.filter(p => p.estadoGlobal === "ARCHIVADO");
    
    return {
      inReviewPlans: basePlans.filter(p => p.estadoGlobal === "EN REVISION"),
      approvedPlans: basePlans.filter(p => p.estadoGlobal === "LISTO PARA ASESOR"),
      archivedOrDisapprovedPlans: [...desaprobados, ...archivados],
      registeredInProcess: basePlans.filter(p => p.estadoGlobal === "EN REVISION"),
      registeredApproved: basePlans.filter(p => p.estadoGlobal === "LISTO PARA ASESOR"),
      registeredArchivedAndDisapproved: [...archivados, ...desaprobados],
    };
  }, [filteredPlans]);


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const NavLink = ({ value, label }: { value: string, label: string }) => (
    <Button
      variant="ghost"
      onClick={() => setActiveTab(value)}
      className={cn(
        "text-muted-foreground transition-all h-auto px-4 py-2.5",
        activeTab === value && "text-primary border-b-2 border-primary rounded-none font-semibold"
      )}
    >
      {label}
    </Button>
  );

  const DropdownNavLink = ({ value, label }: { value: string, label: string }) => (
    <DropdownMenuItem onSelect={() => setActiveTab(value)} className={cn(activeTab === value && "font-bold bg-accent/50")}>
      {label}
    </DropdownMenuItem>
  );

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileScan className="w-6 h-6" />
              <div className="text-2xl font-semibold leading-none tracking-tight">Gestión de Planes de Tesis</div>
            </div>
            <CardDescription className="mt-2">
              Supervise el proceso de revisión de los planes de tesis asignados a
              su cargo. Expanda cada panel para ver y gestionar los detalles.
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
                    {isDecano ? null : (
                      <>
                        <NavLink value="in-review" label={`En Revisión (${inReviewPlans.length})`} />
                        <NavLink value="approved" label={`Aprobados (${approvedPlans.length})`} />
                        <NavLink value="desaprobado-archivado" label={`Desaprobados / Archivados (${archivedOrDisapprovedPlans.length})`} />
                      </>
                    )}
                    <DropdownMenu onOpenChange={setIsDataViewOpen} open={isDataViewOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" onMouseEnter={() => setIsDataViewOpen(true)} className={cn("text-muted-foreground transition-all h-auto px-4 py-2.5 flex items-center gap-1.5", isDataViewOpen && "text-primary font-semibold")}>
                                Vistas de Datos
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onMouseLeave={() => setIsDataViewOpen(false)}>
                            <DropdownNavLink label={`Datos en Proceso (${registeredInProcess.length})`} value="datos-en-proceso" />
                            <DropdownNavLink label={`Datos Aprobados (${registeredApproved.length})`} value="datos-aprobados" />
                            <DropdownNavLink label={`Datos Archivados (${registeredArchivedAndDisapproved.length})`} value="datos-archivados" />
                            <DropdownMenuSeparator />
                            <DropdownNavLink label="Registro General" value="general-data" />
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </nav>
              </div>


                <TabsContent value="in-review" className="mt-4">
                    <PlanList plans={inReviewPlans} docentes={docentes} accordionRef={accordionRef} isDecano={isDecano ?? false} />
                </TabsContent>
                <TabsContent value="approved" className="mt-4">
                    <PlanList plans={approvedPlans} docentes={docentes} accordionRef={accordionRef} isDecano={isDecano ?? false}/>
                </TabsContent>
                 <TabsContent value="desaprobado-archivado" className="mt-4">
                    <PlanList plans={archivedOrDisapprovedPlans} docentes={docentes} accordionRef={accordionRef} isDecano={isDecano ?? false}/>
                </TabsContent>
                <TabsContent value="datos-en-proceso" className="mt-4">
                    <RegisteredDataView plans={registeredInProcess} />
                </TabsContent>
                <TabsContent value="datos-aprobados" className="mt-4">
                    <RegisteredDataView plans={registeredApproved} />
                </TabsContent>
                <TabsContent value="datos-archivados" className="mt-4">
                    <ArchivedReviewsView plans={registeredArchivedAndDisapproved} />
                </TabsContent>
                <TabsContent value="general-data" className="mt-4">
                    <GeneralDataTable plans={filteredPlans.filter(p => p.estadoGlobal !== 'ARCHIVADO' && p.estadoGlobal !== 'LISTO PARA ASESOR')} />
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

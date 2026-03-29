

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, SubmitHandler, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { onSnapshot, collection, query, where, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ThesisPlan, User, Docente } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInCalendarDays, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { LoaderCircle, FileScan, CheckCircle2, CalendarIcon, X, Search, FileClock, FileCheck2, FileX2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DaysBadge } from "@/components/days-badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { createNotification } from "@/lib/notifications";
import { Textarea } from "@/components/ui/textarea";

type PlanAsesoriaConDetalles = ThesisPlan & {
  supervisorAsesores?: User | Docente;
  asesor?: User | Docente;
};

const turnitinFormSchema = z.object({
  turnitinApaObservado: z.boolean().default(false),
  turnitinSupervisorComentario: z.string().optional().nullable(),
  turnitinOficioNotificacionAlumno: z.string().optional().nullable(),
  turnitinFechaNotificacionAlumno: z.date().optional().nullable(),
  turnitinOficioNotificacionDocente: z.string().optional().nullable(),
  turnitinFechaNotificacionDocente: z.date().optional().nullable(),

  turnitin1_enabled: z.boolean().default(true),
  turnitin1_fecha: z.date().optional().nullable(),
  turnitin1_porcentaje: z.coerce
    .number({ invalid_type_error: "Debe ser un número." })
    .int({ message: "El porcentaje debe ser un número entero." })
    .min(0, { message: "El porcentaje no puede ser negativo." })
    .max(100, { message: "El porcentaje no puede ser mayor a 100." })
    .optional()
    .nullable(),
  turnitin1_estado: z.string().optional(),

  turnitin2_enabled: z.boolean().default(false),
  turnitin2_fecha: z.date().optional().nullable(),
  turnitin2_porcentaje: z.coerce
    .number({ invalid_type_error: "Debe ser un número." })
    .int({ message: "El porcentaje debe ser un número entero." })
    .min(0, { message: "El porcentaje no puede ser negativo." })
    .max(100, { message: "El porcentaje no puede ser mayor a 100." })
    .optional()
    .nullable(),
  turnitin2_estado: z.string().optional(),
  revertirArchivado: z.boolean().default(false),
}).superRefine((data, ctx) => {
    // Validación para el 1er Análisis
    if (data.turnitin1_enabled) {
        const hasDate1 = !!data.turnitin1_fecha;
        const hasPercentage1 = data.turnitin1_porcentaje !== null && data.turnitin1_porcentaje !== undefined;

        if (hasDate1 && !hasPercentage1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["turnitin1_porcentaje"],
                message: "El % es requerido si hay una fecha.",
            });
        }
        if (!hasDate1 && hasPercentage1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["turnitin1_fecha"],
                message: "La fecha es requerida si hay un %.",
            });
        }
    }

    // Validación para el 2do Análisis
    if (data.turnitin2_enabled) {
        const hasDate2 = !!data.turnitin2_fecha;
        const hasPercentage2 = data.turnitin2_porcentaje !== null && data.turnitin2_porcentaje !== undefined;

        if (hasDate2 && !hasPercentage2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["turnitin2_porcentaje"],
                message: "El % es requerido si hay una fecha.",
            });
        }
        if (!hasDate2 && hasPercentage2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["turnitin2_fecha"],
                message: "La fecha es requerida si hay un %.",
            });
        }
    }
});

type TurnitinFormData = z.infer<typeof turnitinFormSchema>;

function DatePickerField({ control, name, label, disabled = false }: { control: any; name: string; label: string; disabled?: boolean }) {
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
                selected={field.value}
                onSelect={(date) => { field.onChange(date); setIsOpen(false); }}
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

function TurnitinForm({ plan }: { plan: PlanAsesoriaConDetalles }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<TurnitinFormData>({
    resolver: zodResolver(turnitinFormSchema),
    defaultValues: {
      turnitinApaObservado: plan.turnitinApaObservado || false,
      turnitinSupervisorComentario: plan.turnitinSupervisorComentario || "",
      turnitinOficioNotificacionAlumno: plan.turnitinOficioNotificacionAlumno || undefined,
      turnitinFechaNotificacionAlumno: plan.turnitinFechaNotificacionAlumno ? new Date(plan.turnitinFechaNotificacionAlumno) : undefined,
      turnitinOficioNotificacionDocente: plan.turnitinOficioNotificacionDocente || undefined,
      turnitinFechaNotificacionDocente: plan.turnitinFechaNotificacionDocente ? new Date(plan.turnitinFechaNotificacionDocente) : undefined,

      turnitin1_enabled: true,
      turnitin1_fecha: plan.turnitin1?.fecha ? new Date(plan.turnitin1.fecha) : undefined,
      turnitin1_porcentaje: plan.turnitin1?.porcentaje ?? undefined,
      turnitin1_estado: plan.turnitin1?.estado || "PENDIENTE",
      
      turnitin2_enabled: !!plan.turnitin2?.fecha || !!plan.turnitin2?.porcentaje,
      turnitin2_fecha: plan.turnitin2?.fecha ? new Date(plan.turnitin2.fecha) : undefined,
      turnitin2_porcentaje: plan.turnitin2?.porcentaje ?? undefined,
      turnitin2_estado: plan.turnitin2?.estado || "PENDIENTE",
      revertirArchivado: false,
    },
  });

  const { watch, setValue } = form;
  const turnitin1_porcentaje = watch("turnitin1_porcentaje");
  const turnitin2_porcentaje = watch("turnitin2_porcentaje");
  const turnitin1_estado = watch("turnitin1_estado");
  const turnitin2_estado = watch("turnitin2_estado");
  const turnitin1Enabled = watch("turnitin1_enabled");
  const turnitin2Enabled = watch("turnitin2_enabled");
  const fechaNotifAlumno = watch("turnitinFechaNotificacionAlumno");
  const fechaNotifDocente = watch("turnitinFechaNotificacionDocente");
  const turnitinApaObservado = watch("turnitinApaObservado");
  const revertirArchivado = watch("revertirArchivado");

  const { diasRestantesAlumno, progresoAlumno } = useMemo(() => {
    if (!fechaNotifAlumno) return { diasRestantesAlumno: null, progresoAlumno: 0 };
    const plazoTotal = 5;
    const diasRestantes = differenceInDays(addDays(fechaNotifAlumno, plazoTotal), new Date());
    const diasTranscurridos = plazoTotal - diasRestantes;
    const progreso = (diasTranscurridos / plazoTotal) * 100;
    return { diasRestantesAlumno: diasRestantes, progresoAlumno: Math.max(0, Math.min(100, progreso)) };
  }, [fechaNotifAlumno]);

  const diasTranscurridosDocente = useMemo(() => fechaNotifDocente ? differenceInDays(new Date(), fechaNotifDocente) : null, [fechaNotifDocente]);
  
  const isTurnitin1Aprobado = turnitin1_estado === 'APROBADO';
  const isTurnitin1Desaprobado = turnitin1_estado === 'DESAPROBADO';
  const segundoAnalisisHabilitado = isTurnitin1Desaprobado;

  useEffect(() => {
    if (!turnitin1Enabled) {
      setValue("turnitin1_fecha", undefined);
      setValue("turnitin1_porcentaje", undefined);
    }
  }, [turnitin1Enabled, setValue]);

  useEffect(() => {
    if (!turnitin2Enabled) {
      setValue("turnitin2_fecha", undefined);
      setValue("turnitin2_porcentaje", undefined);
    }
  }, [turnitin2Enabled, setValue]);

  useEffect(() => {
    if (turnitin1_porcentaje !== undefined && turnitin1_porcentaje !== null && !isNaN(Number(turnitin1_porcentaje))) {
      setValue("turnitin1_estado", Number(turnitin1_porcentaje) <= 30 ? "APROBADO" : "DESAPROBADO");
    } else {
      setValue("turnitin1_estado", "PENDIENTE");
    }
  }, [turnitin1_porcentaje, setValue]);

  useEffect(() => {
    if (turnitin2_porcentaje !== undefined && turnitin2_porcentaje !== null && !isNaN(Number(turnitin2_porcentaje))) {
      setValue("turnitin2_estado", Number(turnitin2_porcentaje) <= 30 ? "APROBADO" : "DESAPROBADO");
    } else {
      setValue("turnitin2_estado", "PENDIENTE");
    }
  }, [turnitin2_porcentaje, setValue]);

  const onSubmit = async (data: TurnitinFormData) => {
    setLoading(true);

    const toISOorNull = (date: Date | null | undefined) => date ? date.toISOString() : null;

    const planRef = doc(db, "thesisPlans", plan.id);
    const batch = writeBatch(db);

    const updateData: any = {
      turnitinApaObservado: data.turnitinApaObservado,
      turnitinSupervisorComentario: data.turnitinSupervisorComentario || null,
      turnitinOficioNotificacionAlumno: data.turnitinOficioNotificacionAlumno || null,
      turnitinFechaNotificacionAlumno: toISOorNull(data.turnitinFechaNotificacionAlumno),
      turnitinOficioNotificacionDocente: data.turnitinOficioNotificacionDocente || null,
      turnitinFechaNotificacionDocente: toISOorNull(data.turnitinFechaNotificacionDocente),
      actualizadoEn: new Date(),
    };

    updateData.turnitin1 = data.turnitin1_enabled ? {
        fecha: toISOorNull(data.turnitin1_fecha),
        porcentaje: data.turnitin1_porcentaje ?? null,
        estado: data.turnitin1_estado ?? 'PENDIENTE',
    } : null;

    updateData.turnitin2 = data.turnitin2_enabled ? {
        fecha: toISOorNull(data.turnitin2_fecha),
        porcentaje: data.turnitin2_porcentaje ?? null,
        estado: data.turnitin2_estado ?? 'PENDIENTE',
    } : null;
    
    if (data.revertirArchivado) {
        updateData.estadoGlobal = 'EN ASESORIA';
        updateData.archivo = {
            archivado: false,
            fecha: null,
            motivo: null,
        };
        // Also reset the second turnitin attempt
        updateData.turnitin2 = null; 
    } else if (data.turnitin2_estado === 'DESAPROBADO' && !data.revertirArchivado) {
        updateData.estadoGlobal = 'ARCHIVADO';
        updateData.archivo = {
            archivado: true,
            fecha: new Date().toISOString(),
            motivo: 'Desaprobado en el segundo análisis de similitud de Turnitin.'
        };
    }

    batch.update(planRef, updateData);

    const hasNewDocenteNotification = data.turnitinFechaNotificacionDocente && (!plan.turnitinFechaNotificacionDocente || new Date(data.turnitinFechaNotificacionDocente).getTime() !== new Date(plan.turnitinFechaNotificacionDocente).getTime());

    if (hasNewDocenteNotification && plan.turnitinSupervisorId) {
        createNotification({
            userId: plan.turnitinSupervisorId,
            message: `Se le ha asignado una nueva tesis para revisión de Turnitin: ${plan.estudiante.apellidosNombres}.`,
            link: `/turnitin-review?expand=${plan.id}`,
            batch, // Pass the batch to the notification function
        });
    }
    
    try {
      await batch.commit();
      toast({ title: "Éxito", description: "Los datos de Turnitin han sido actualizados." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la información de Turnitin." });
    } finally {
      setLoading(false);
    }
  };

  const isTurnitinProcessApproved = turnitin1_estado === 'APROBADO' || turnitin2_estado === 'APROBADO';
  const fueArchivadoPorTurnitin = plan.estadoGlobal === 'ARCHIVADO' && plan.archivo?.motivo?.includes('Turnitin');

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="pt-4 space-y-6">

          <Card className="bg-muted/30">
            <CardHeader>
                <CardTitle className="text-base">Notificaciones y Plazos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-4 p-4 rounded-md border bg-background">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Notificación al Alumno</h4>
                        {diasRestantesAlumno !== null && <DaysBadge days={diasRestantesAlumno} isFinished={diasRestantesAlumno < 0} prefix="Plazo Alumno:" />}
                        {diasRestantesAlumno !== null && (
                          <Progress
                            value={progresoAlumno}
                            className="h-1.5 mt-1"
                            indicatorClassName={cn(
                              progresoAlumno > 80 && "bg-destructive",
                              progresoAlumno > 60 && progresoAlumno <= 80 && "bg-amber-500"
                            )}
                          />
                        )}
                    </div>
                    <FormField control={form.control} name="turnitinOficioNotificacionAlumno" render={({ field }) => (<FormItem><FormLabel>Oficio Notif. Alumno</FormLabel><FormControl><Input placeholder="OFICIO-NOT-AL-XXXX" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <DatePickerField control={form.control} name="turnitinFechaNotificacionAlumno" label="Fecha Notif. Alumno" />
                </div>
                 <div className="space-y-4 p-4 rounded-md border bg-background">
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium">Notificación al Docente</h4>
                        {diasTranscurridosDocente !== null && <Badge variant="outline">Transcurridos: {diasTranscurridosDocente} días</Badge>}
                    </div>
                    <FormField control={form.control} name="turnitinOficioNotificacionDocente" render={({ field }) => (<FormItem><FormLabel>Oficio Notif. Docente</FormLabel><FormControl><Input placeholder="OFICIO-NOT-DOC-XXXX" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <DatePickerField control={form.control} name="turnitinFechaNotificacionDocente" label="Fecha Notif. Docente" />
                </div>
            </CardContent>
          </Card>
          
          <Separator />
          
          <div className="space-y-4">
            <FormField
                control={form.control}
                name="turnitinApaObservado"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">Observado por formato APA</FormLabel>
                            <FormDescription>
                                Active si la tesis tiene observaciones en el formato APA que deban ser corregidas.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                }}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="turnitinSupervisorComentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentarios del Supervisor de Turnitin</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Añadir observaciones generales o específicas sobre el formato APA u otros aspectos..."
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 rounded-md bg-muted/50">
              <FormField control={form.control} name="turnitin1_enabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><div className="space-y-0.5"><FormLabel>Registrar 1er Análisis</FormLabel></div><FormControl><Switch defaultChecked={true} checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <div className={cn("space-y-4 pt-4 border-t", !turnitin1Enabled && "opacity-50 pointer-events-none")}>
                <h4 className="text-sm font-medium">Registro de Análisis</h4>
                <DatePickerField control={form.control} name="turnitin1_fecha" label="Fecha Análisis" disabled={!turnitin1Enabled} />
                <FormField control={form.control} name="turnitin1_porcentaje" render={({ field }) => (<FormItem><FormLabel>% Similitud</FormLabel><FormControl><Input type="number" {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} value={field.value ?? ''} disabled={!turnitin1Enabled} /></FormControl><FormMessage /></FormItem>)} />
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <div>
                    {form.getValues("turnitin1_estado") === 'PENDIENTE' ? (
                      <Badge variant="outline">Pendiente</Badge>
                    ) : (
                      <Badge className={cn(isTurnitin1Aprobado ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>{form.getValues("turnitin1_estado")}</Badge>
                    )}
                  </div>
                </FormItem>
              </div>
            </div>
            <div className={cn("space-y-4 p-4 rounded-md bg-muted/50", !segundoAnalisisHabilitado && "opacity-50 pointer-events-none")}>
              <FormField control={form.control} name="turnitin2_enabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between"><div className="space-y-0.5"><FormLabel>Registrar 2do Análisis</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!segundoAnalisisHabilitado} /></FormControl></FormItem>)} />
              <div className={cn("space-y-4 pt-4 border-t", !turnitin2Enabled && "opacity-50 pointer-events-none")}>
                <h4 className="text-sm font-medium">Registro de Análisis</h4>
                <DatePickerField control={form.control} name="turnitin2_fecha" label="Fecha Análisis" disabled={!segundoAnalisisHabilitado || !turnitin2Enabled} />
                <FormField control={form.control} name="turnitin2_porcentaje" render={({ field }) => (<FormItem><FormLabel>% Similitud</FormLabel><FormControl><Input type="number" {...field} disabled={!segundoAnalisisHabilitado || !turnitin2Enabled} onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <div>
                    {form.getValues("turnitin2_estado") === 'PENDIENTE' ? (
                      <Badge variant="outline">Pendiente</Badge>
                    ) : (
                      <Badge className={cn(form.getValues("turnitin2_estado") === 'APROBADO' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>{form.getValues("turnitin2_estado")}</Badge>
                    )}
                  </div>
                </FormItem>
              </div>
            </div>
          </div>
          {isTurnitinProcessApproved && (
            <div className="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                <p className="font-semibold">EL ALUMNO ESTÁ APTO PARA CONTINUAR CON EL PROCESO DE SUSTENTACIÓN.</p>
              </div>
            </div>
          )}
          {fueArchivadoPorTurnitin && (
            <FormField
              control={form.control}
              name="revertirArchivado"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-4 mt-4">
                      <div className="space-y-0.5">
                          <FormLabel className="text-base text-yellow-800 dark:text-yellow-300">Revertir archivado por desaprobación</FormLabel>
                          <FormDescription>
                              Active esta opción para restaurar el plan al estado "EN ASESORIA" y permitir un nuevo intento.
                          </FormDescription>
                      </div>
                      <FormControl>
                          <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                          />
                      </FormControl>
                  </FormItem>
              )}
            />
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Cambios de Turnitin"}
          </Button>
        </CardFooter>
      </form>
    </FormProvider>
  );
}

function TurnitinPlanList({ plans }: { plans: PlanAsesoriaConDetalles[] }) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-lg">
        <FileScan className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">No hay planes de tesis en esta categoría.</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      {plans.map((plan) => {
        const observationReasons = [];
        if (plan.turnitinApaObservado) {
          observationReasons.push(<Badge key="apa" variant="destructive" className="bg-orange-100 text-orange-800">Observado por APA</Badge>);
        }
        if (plan.turnitin1?.estado === 'DESAPROBADO' && plan.turnitin2?.estado !== 'DESAPROBADO') {
            observationReasons.push(<Badge key="t1" variant="destructive">1er Análisis Desaprobado</Badge>);
        }
        if (plan.turnitin2?.estado === 'DESAPROBADO') {
            observationReasons.push(<Badge key="t2" variant="destructive">2do Análisis Desaprobado</Badge>);
        }

        return (
            <AccordionItem value={plan.id} key={plan.id}>
            <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                <Avatar className="h-9 w-9">
                    <AvatarFallback>{plan.estudiante.apellidosNombres.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold">{plan.estudiante.apellidosNombres}</p>
                    <p className="text-sm text-muted-foreground whitespace-normal break-words">{plan.titulo}</p>
                </div>
                </div>
                <div className="flex items-center gap-2 pl-4">
                    {observationReasons}
                    <Badge variant="outline">Asesor: {plan.asesor?.nombre} {plan.asesor?.apellidos}</Badge>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 px-4">
                <TurnitinForm plan={plan} />
            </AccordionContent>
            </AccordionItem>
        )
      })}
    </Accordion>
  );
}

export default function TurnitinReviewPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanAsesoriaConDetalles[]>([]);
  const [docentes, setDocentes] = useState<(User | Docente)[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { appUser } = useAuth();
  
  useEffect(() => {
    const usersQuery = query(collection(db, "users"));
    const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
      const allUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as unknown as User));
      
      const recordsQuery = collection(db, "docentes");
      const unsubRecords = onSnapshot(recordsQuery, (recordsSnapshot) => {
        const docenteRecords = recordsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Docente));
        
        const combined: (User | Docente)[] = [...allUsers];
        const userEmails = new Set(allUsers.map(d => d.correo));
        
        docenteRecords.forEach(record => {
          if (record.correo && !userEmails.has(record.correo)) combined.push(record);
          else if (!record.correo) combined.push(record);
        });

        setDocentes(combined);
      });
      return () => unsubRecords();
    });
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    if (!appUser || docentes.length === 0) return;

    setLoading(true);
    const plansQuery = query(
        collection(db, "thesisPlans"), 
        where("listoParaTurnitin", "==", true)
    );

    const unsubscribe = onSnapshot(plansQuery, (snapshot) => {
      const plansData = snapshot.docs.map((doc) => {
        const plan = doc.data() as ThesisPlan;
        const asesor = docentes.find(d => d.uid === plan.asesorId);
        return { ...plan, asesor } as PlanAsesoriaConDetalles;
      }).sort((a, b) => a.estudiante.apellidosNombres.localeCompare(b.estudiante.apellidosNombres));
      setPlans(plansData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [appUser, docentes]);

  const filteredPlans = useMemo(() => {
    if (!searchTerm) {
        return plans;
    }
    return plans.filter(p => 
        p.estudiante.apellidosNombres.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plans, searchTerm]);


  const { pendingPlans, observedPlans, approvedPlans, disapprovedPlans } = useMemo(() => {
    const isApproved = (p: ThesisPlan) => p.turnitin1?.estado === 'APROBADO' || p.turnitin2?.estado === 'APROBADO';
    const isFinallyDisapproved = (p: ThesisPlan) => p.turnitin2?.estado === 'DESAPROBADO';
    const isObservedByAPA = (p: ThesisPlan) => p.turnitinApaObservado;
    const isObservedByFirstTurnitin = (p: ThesisPlan) => p.turnitin1?.estado === 'DESAPROBADO' && !isFinallyDisapproved(p);
    
    const observed = filteredPlans.filter(p => 
      !isApproved(p) && !isFinallyDisapproved(p) && (isObservedByAPA(p) || isObservedByFirstTurnitin(p))
    );
    
    const disapproved = filteredPlans.filter(p => isFinallyDisapproved(p));

    const approved = filteredPlans.filter(p => isApproved(p));

    const pending = filteredPlans.filter(p => !observed.some(op => op.id === p.id) && !disapproved.some(dp => dp.id === p.id) && !approved.some(ap => ap.id === p.id));

    return {
      pendingPlans: pending,
      observedPlans: observed,
      approvedPlans: approved,
      disapprovedPlans: disapproved,
    };
  }, [filteredPlans]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileScan className="w-6 h-6" />
                    Revisión de Turnitin
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Gestione el análisis de similitud de Turnitin para los planes de tesis en etapa de asesoría.
                  </CardDescription>
              </div>
              <div className="relative w-full md:w-auto md:min-w-[320px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Buscar por alumno..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg bg-background pl-8"
                  />
              </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pendientes ({pendingPlans.length})</TabsTrigger>
              <TabsTrigger value="observed">Observados ({observedPlans.length})</TabsTrigger>
              <TabsTrigger value="approved">Aprobados ({approvedPlans.length})</TabsTrigger>
              <TabsTrigger value="disapproved">Desaprobados ({disapprovedPlans.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="mt-4">
              <TurnitinPlanList plans={pendingPlans} />
            </TabsContent>
            <TabsContent value="observed" className="mt-4">
              <TurnitinPlanList plans={observedPlans} />
            </TabsContent>
            <TabsContent value="approved" className="mt-4">
              <TurnitinPlanList plans={approvedPlans} />
            </TabsContent>
            <TabsContent value="disapproved" className="mt-4">
              <TurnitinPlanList plans={disapprovedPlans} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

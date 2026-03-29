

"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, setDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student, DocenteResponsabilidad, ThesisPlan, AppUser } from "@/lib/types";
import { DocenteConResponsabilidad } from "@/app/dashboard/assignment/page";
import { logKeyAction } from "@/lib/actions";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { CalendarIcon, LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addDays, addYears, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "./ui/calendar";
import { es } from "date-fns/locale";

const formSchema = z.object({
  submissionDate: z.date({
    required_error: "La fecha de asignación es requerida.",
  }),
  assignmentType: z.enum(["revisores", "asesor"], {
    required_error: "Debe seleccionar un tipo de asignación.",
  }),
  modalidad: z.enum(["Tesis", "Suficiencia Profesional"]).optional(),
  revisor1: z.string().optional(),
  revisor2: z.string().optional(),
  supervisorRevisores: z.string().optional(),
  asesor: z.string().optional(),
  supervisorAsesores: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.assignmentType === 'revisores') {
        if (!data.revisor1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un revisor.", path: ["revisor1"] });
        if (!data.revisor2) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un revisor.", path: ["revisor2"] });
        if (!data.supervisorRevisores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un supervisor.", path: ["supervisorRevisores"] });
        if (data.revisor1 && data.revisor1 === data.revisor2) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Los revisores deben ser diferentes.", path: ["revisor2"] });
        }
    }
    if (data.assignmentType === 'asesor') {
        if (!data.asesor) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un asesor.", path: ["asesor"] });
        if (!data.supervisorAsesores) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar un supervisor.", path: ["supervisorAsesores"] });
        if (!data.modalidad) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe seleccionar una modalidad.", path: ["modalidad"] });
    }
});


type FormData = z.infer<typeof formSchema>;

interface AssignmentFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  student: Student | null;
  docentes: DocenteConResponsabilidad[];
  editingPlan?: ThesisPlan | null;
  currentUser: AppUser | null;
}

function DatePickerField({ control, name, label }: { control: any, name: string, label: string }) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>{label}</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                        format(field.value, "PPP", { locale: es })
                                    ) : (
                                        <span>Seleccionar fecha</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                locale={es}
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export function AssignmentFormDialog({ 
  isOpen, 
  onOpenChange, 
  student,
  docentes,
  editingPlan,
  currentUser,
}: AssignmentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEditing = !!editingPlan;

  const userRoles = currentUser?.roles || [];
  const isAdminOrDecano = userRoles.includes('admin') || userRoles.includes('decano');
  
  const canAssignRevisores = isAdminOrDecano || userRoles.includes('docente_supervisor_revisores');
  const canAssignAsesores = isAdminOrDecano || userRoles.includes('docente_supervisor_asesores');

  const defaultAssignmentType = useMemo<"asesor" | "revisores">(() => {
    if (editingPlan) {
      if (editingPlan.estadoGlobal === 'LISTO PARA ASESOR') return 'asesor';
      return editingPlan.asesorId ? 'asesor' : 'revisores';
    }
    // If student has a pre-assigned supervisor for reviews, default to reviewers.
    if (student?.supervisorRevisoresId) {
        return 'revisores';
    }
    // For new assignments by non-admin roles
    if (!isAdminOrDecano) {
      if (canAssignRevisores) return 'revisores';
      if (canAssignAsesores) return 'asesor';
    }
    return canAssignRevisores ? 'revisores' : 'asesor';
  }, [editingPlan, isAdminOrDecano, userRoles, student, canAssignRevisores, canAssignAsesores]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      submissionDate: new Date(),
      assignmentType: defaultAssignmentType,
      modalidad: "Tesis",
    }
  });

  const assignmentType = form.watch("assignmentType");
  const selectedRevisor1 = form.watch("revisor1");
  const selectedRevisor2 = form.watch("revisor2");
  
  const supervisorIsLocked = !isAdminOrDecano && !!currentUser?.uid;

  useEffect(() => {
    if (isOpen) {
        let type = defaultAssignmentType;

        let defaultSupervisorRevisores: string | undefined = undefined;
        let defaultSupervisorAsesores: string | undefined = undefined;

        if (supervisorIsLocked) {
          if (canAssignRevisores) defaultSupervisorRevisores = currentUser?.uid;
          if (canAssignAsesores) defaultSupervisorAsesores = currentUser?.uid;
        } else if (student?.supervisorRevisoresId) {
            defaultSupervisorRevisores = student.supervisorRevisoresId;
        }

        const resetValues = isEditing && editingPlan ? {
          submissionDate: new Date(),
          assignmentType: type,
          modalidad: (editingPlan.modalidad as "Tesis" | "Suficiencia Profesional") || "Tesis",
          revisor1: editingPlan.docenteRevisor1Id || undefined,
          revisor2: editingPlan.docenteRevisor2Id || undefined,
          supervisorRevisores: editingPlan.supervisorRevisoresId || defaultSupervisorRevisores,
          asesor: editingPlan.asesorId || undefined,
          supervisorAsesores: editingPlan.supervisorAsesoresId || defaultSupervisorAsesores,
        } : {
          submissionDate: new Date(),
          assignmentType: type,
          modalidad: "Tesis",
          revisor1: undefined,
          revisor2: undefined,
          supervisorRevisores: defaultSupervisorRevisores,
          asesor: undefined,
          supervisorAsesores: defaultSupervisorAsesores,
        };

        form.reset(resetValues as any);
    }
  }, [isOpen, isEditing, editingPlan, form, currentUser?.uid, supervisorIsLocked, defaultAssignmentType, student, canAssignRevisores, canAssignAsesores]);


  const filterDocentesByResponsabilidad = (responsabilidad: DocenteResponsabilidad) => {
    return docentes.filter(d => d.responsabilidades.includes(responsabilidad));
  };
  
  const getFilteredSupervisors = (responsabilidad: DocenteResponsabilidad) => {
    return filterDocentesByResponsabilidad(responsabilidad);
  }

  const revisores = useMemo(() => filterDocentesByResponsabilidad('docente_revisor'), [docentes]);
  const supervisoresRevisores = useMemo(() => getFilteredSupervisors('docente_supervisor_revisores'), [docentes]);
  const asesores = useMemo(() => filterDocentesByResponsabilidad('docente_asesor'), [docentes]);
  const supervisoresAsesores = useMemo(() => getFilteredSupervisors('docente_supervisor_asesores'), [docentes]);
  
  const revisoresParaRevisor1 = useMemo(() => {
    return revisores.filter(d => d.uid !== selectedRevisor2);
  }, [revisores, selectedRevisor2]);

  const revisoresParaRevisor2 = useMemo(() => {
    return revisores.filter(d => d.uid !== selectedRevisor1);
  }, [revisores, selectedRevisor1]);
  
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!student || !student.codigo || !currentUser) {
      toast({
        variant: "destructive",
        title: "Error Crítico",
        description: "No se ha seleccionado un estudiante válido, el estudiante no tiene código, o el usuario actual no está definido.",
      });
      return;
    }
    setLoading(true);

    try {
        const submissionDate = data.submissionDate;
        const studentData = {
          codigo: student.codigo,
          apellidosNombres: student.apellidosNombres,
          especialidad: student.especialidad,
          temaBachiller: student.temaBachiller,
          avatarUrl: student.avatarUrl || undefined,
        }

        const turnitinSupervisor = docentes.find(d => d.responsabilidades.includes('docente_supervisor_turnitin'));

        if (isEditing && editingPlan) {
            const planRef = doc(db, "thesisPlans", editingPlan.id);
            let updateData: any = { actualizadoEn: serverTimestamp() };

            if(assignmentType === 'asesor') {
                updateData = {
                    ...updateData,
                    estadoGlobal: "EN ASESORIA",
                    asesorId: data.asesor,
                    supervisorAsesoresId: data.supervisorAsesores,
                    modalidad: data.modalidad,
                    turnitinSupervisorId: turnitinSupervisor?.uid || undefined,
                    submissionDate: submissionDate.toISOString(),
                    fechaVencimientoAsesoria: addYears(submissionDate, 1).toISOString(),
                    progress: 0,
                };
            } else { // Editing reviewers
                updateData = {
                    ...updateData,
                    docenteRevisor1Id: data.revisor1,
                    docenteRevisor2Id: data.revisor2,
                    supervisorRevisoresId: data.supervisorRevisores,
                    submissionDate: submissionDate.toISOString(),
                    vencimientoRevision: addDays(submissionDate, 30).toISOString(),
                };
            }
            
            await updateDoc(planRef, updateData);
            await logKeyAction({ userId: currentUser.uid, action: 'update_assignment', details: `Plan ID: ${editingPlan.id}` });
            toast({
                title: "Asignación Actualizada",
                description: `Se han actualizado los datos para ${student.apellidosNombres}.`,
            });
        } else {
            // Create new plan for a student without one
            const newPlanRef = doc(collection(db, "thesisPlans"));
            let planData: Partial<ThesisPlan> = {
                id: newPlanRef.id,
                titulo: student.temaBachiller,
                estudiante: studentData,
                submissionDate: submissionDate.toISOString(),
                creadoEn: serverTimestamp(),
            };

            if (data.assignmentType === 'revisores') {
                planData = {
                    ...planData,
                    estadoGlobal: "EN REVISION",
                    docenteRevisor1Id: data.revisor1,
                    docenteRevisor2Id: data.revisor2,
                    supervisorRevisoresId: data.supervisorRevisores,
                    vencimientoRevision: addDays(submissionDate, 30).toISOString(),
                    listoParaAsignacionAsesor: false,
                };
            } else { // 'asesor'
                 planData = {
                    ...planData,
                    estadoGlobal: "EN ASESORIA",
                    asesorId: data.asesor,
                    supervisorAsesoresId: data.supervisorAsesores,
                    modalidad: data.modalidad,
                    turnitinSupervisorId: turnitinSupervisor?.uid || undefined,
                    progress: 0,
                    fechaVencimientoAsesoria: addYears(submissionDate, 1).toISOString(),
                 };
            }
            
            await setDoc(newPlanRef, planData);
            await logKeyAction({ userId: currentUser.uid, action: 'create_assignment', details: `Plan ID: ${newPlanRef.id}` });
            toast({
                title: "Asignación Exitosa",
                description: `Se ha asignado correctamente al alumno ${student.apellidosNombres}.`,
            });
        }
        
        onOpenChange(false);
    } catch (error: any) {
        console.error("Error en la asignación:", error);
        toast({
            variant: "destructive",
            title: "Error en la Asignación",
            description: error.message || "Ocurrió un error inesperado al guardar la asignación.",
        });
    } finally {
        setLoading(false);
    }
  };

  const title = isEditing ? `Editar Asignación para ${student?.apellidosNombres}` : `Asignar Docentes para ${student?.apellidosNombres}`;
  const isReadyForAdvisory = editingPlan?.estadoGlobal === 'LISTO PARA ASESOR';
  const isTypeLocked = isReadyForAdvisory;
  const disableReviewerOption = !canAssignRevisores || (isEditing && isReadyForAdvisory);
  const disableAdvisorOption = !canAssignAsesores || (isEditing && !isReadyForAdvisory);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Seleccione el tipo de asignación y los docentes correspondientes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Tipo de Asignación</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                        disabled={isTypeLocked}
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="revisores" disabled={disableReviewerOption} />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Plan de tesis
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="asesor" disabled={disableAdvisorOption} />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Asesoria
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DatePickerField control={form.control} name="submissionDate" label="Fecha de Asignación" />
            </div>

            {assignmentType === 'revisores' && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <FormField
                  control={form.control}
                  name="supervisorRevisores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor de Revisores</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={supervisorIsLocked}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Supervisor" /></SelectTrigger></FormControl>
                          <SelectContent>{supervisoresRevisores.map(d => <SelectItem key={`sup-rev-${d.uid}`} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="revisor1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revisor 1</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Revisor" /></SelectTrigger></FormControl>
                            <SelectContent>{revisoresParaRevisor1.map(d => <SelectItem key={`rev1-${d.uid}`} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="revisor2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revisor 2</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Revisor" /></SelectTrigger></FormControl>
                            <SelectContent>{revisoresParaRevisor2.map(d => <SelectItem key={`rev2-${d.uid}`} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            {assignmentType === 'asesor' && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <FormField
                    control={form.control}
                    name="modalidad"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Modalidad</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    className="flex flex-row space-x-4"
                                >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="Tesis" /></FormControl>
                                        <FormLabel className="font-normal">Tesis</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="Suficiencia Profesional" /></FormControl>
                                        <FormLabel className="font-normal">Suficiencia Profesional</FormLabel>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="supervisorAsesores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor de Asesores</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={supervisorIsLocked}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Supervisor" /></SelectTrigger></FormControl>
                          <SelectContent>{supervisoresAsesores.map(d => <SelectItem key={`sup-ase-${d.uid}`} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="asesor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asesor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Asesor" /></SelectTrigger></FormControl>
                            <SelectContent>{asesores.map(d => <SelectItem key={`ase-${d.uid}`} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
            )}


            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Guardar Cambios" : "Confirmar Asignación"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

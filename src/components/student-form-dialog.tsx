

"use client";

import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import { AppUser, Student, Docente, DocenteResponsabilidad, ThesisPlan } from "@/lib/types";
import { DocenteConResponsabilidad } from "@/app/dashboard/assignment/page";
import { addDays } from "date-fns";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, LoaderCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";

const createFormSchema = (allStudents: Student[]) => z.object({
  apellidosNombres: z.string().min(2, "Los apellidos y nombres son requeridos."),
  temaBachiller: z.string().optional(),
  especialidad: z.string().optional(),
  // Optional fields for direct assignment
  supervisorRevisoresId: z.string().optional(),
  fechaExpediente: z.date().optional().nullable(),
}).refine(data => (data.supervisorRevisoresId && !data.fechaExpediente) || (!data.supervisorRevisoresId && data.fechaExpediente) ? false : true, {
    message: "Debe seleccionar tanto un supervisor como una fecha de expediente para la asignación inicial.",
    path: ["supervisorRevisoresId"],
});

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface StudentFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editingStudent: Student | null;
  allStudents: Student[];
  docentes: DocenteConResponsabilidad[];
  currentUser: AppUser | null;
  thesisPlans: ThesisPlan[];
}

const generateUniqueCode = async (name: string, allStudents: Student[]): Promise<string> => {
    const parts = name.split(',').map(part => part.trim());
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';

    let baseCode = ((firstName.charAt(0) || '') + (lastName.split(' ')[0].charAt(0) || '')).toUpperCase();
    if (baseCode.length < 2) baseCode = "XX";

    let finalCode = baseCode;
    let counter = 1;
    
    // Check for existing codes in the local list first for immediate feedback
    const localCodes = new Set(allStudents.map(s => s.codigo));
    while (localCodes.has(finalCode)) {
        finalCode = `${baseCode}${counter}`;
        counter++;
    }

    // Now check in Firestore to be absolutely sure
    let codeExistsInDB = true;
    while(codeExistsInDB) {
        const q = query(collection(db, "students"), where("codigo", "==", finalCode));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            codeExistsInDB = false;
        } else {
            finalCode = `${baseCode}${counter}`;
            counter++;
        }
    }
    
    return finalCode;
}

function DatePickerField({ control, name, label }: { control: any; name: string; label: string }) {
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
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "pl-3 pr-1 text-left font-normal w-full justify-between",
                                        !field.value && "text-muted-foreground"
                                    )}
                                >
                                    <span className="flex-1">{field.value ? (
                                        format(field.value, "PPP", { locale: es })
                                    ) : (
                                        <span>Seleccionar fecha</span>
                                    )}</span>
                                    {field.value ? (
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
    )
}

export function StudentFormDialog({ 
  isOpen, 
  onOpenChange, 
  editingStudent,
  allStudents,
  docentes,
  currentUser,
  thesisPlans,
}: StudentFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEditing = !!editingStudent;
  const isAdminOrDecano = currentUser?.roles.includes('admin') || currentUser?.roles.includes('decano');
  
  const studentHasPlan = isEditing && thesisPlans.some(p => p.estudiante.codigo === editingStudent?.codigo);

  const formSchema = createFormSchema(allStudents.filter(s => s.id !== editingStudent?.id));
  const form = useForm<FormData>({ resolver: zodResolver(formSchema), defaultValues: { /* ... */ } });


  useEffect(() => {
    if (isOpen) {
        if (isEditing && editingStudent) {
            form.reset({
                apellidosNombres: editingStudent.apellidosNombres || "",
                temaBachiller: editingStudent.temaBachiller === "No especificado" ? "" : editingStudent.temaBachiller,
                especialidad: editingStudent.especialidad === "No especificado" ? "" : editingStudent.especialidad,
                supervisorRevisoresId: editingStudent.supervisorRevisoresId || undefined,
                fechaExpediente: editingStudent.fechaExpediente ? new Date(editingStudent.fechaExpediente) : undefined,
            });
        } else {
            form.reset({
                apellidosNombres: "",
                temaBachiller: "",
                especialidad: "",
                supervisorRevisoresId: undefined,
                fechaExpediente: undefined,
            });
        }
    }
  }, [isOpen, isEditing, editingStudent, form]);

  const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };
  
  const capitalizeSentence = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);

    try {
        if (isEditing && editingStudent) {
            const studentRef = doc(db, "students", editingStudent.id);
            
            const supervisorId = data.supervisorRevisoresId === 'none' ? null : data.supervisorRevisoresId;

            const updateData:any = {
                apellidosNombres: capitalizeWords(data.apellidosNombres),
                temaBachiller: data.temaBachiller ? capitalizeSentence(data.temaBachiller) : "",
                especialidad: data.especialidad ? capitalizeWords(data.especialidad) : "",
                actualizadoEn: serverTimestamp()
            };
            
            if(!studentHasPlan) {
              updateData.supervisorRevisoresId = supervisorId || null;
              updateData.fechaExpediente = data.fechaExpediente ? data.fechaExpediente.toISOString() : null;
            }


            await updateDoc(studentRef, updateData);
            toast({ title: "Alumno Actualizado" });

        } else { // Creando nuevo alumno
            const studentExists = allStudents.some(
                student => student.apellidosNombres.toLowerCase() === data.apellidosNombres.toLowerCase()
            );
            if (studentExists) {
                form.setError("apellidosNombres", { type: "manual", message: "Ya existe un alumno con este nombre." });
                setLoading(false);
                return;
            }

            const studentCollectionRef = collection(db, "students");
            const newStudentRef = doc(studentCollectionRef);
            
            const newStudentCode = await generateUniqueCode(data.apellidosNombres, allStudents);
            const supervisorId = data.supervisorRevisoresId === 'none' ? null : data.supervisorRevisoresId;

            const newStudentData: any = {
                apellidosNombres: capitalizeWords(data.apellidosNombres),
                temaBachiller: data.temaBachiller ? capitalizeSentence(data.temaBachiller) : "",
                especialidad: data.especialidad ? capitalizeWords(data.especialidad) : "",
                id: newStudentRef.id, 
                codigo: newStudentCode,
                creadoEn: serverTimestamp(),
                supervisorId: isAdminOrDecano ? null : currentUser?.uid || null,
                supervisorRevisoresId: supervisorId || null,
                fechaExpediente: data.fechaExpediente ? data.fechaExpediente.toISOString() : null,
            };

            await setDoc(newStudentRef, newStudentData);

            if (supervisorId && data.fechaExpediente) {
                 toast({ title: "Alumno Creado y Pre-asignado", description: "El alumno está pendiente de asignación por el supervisor." });
            } else {
                toast({ title: "Alumno Creado", description: "El alumno está pendiente de asignación." });
            }
        }
        
        onOpenChange(false);
    } catch (error: any) {
        console.error("Error procesando alumno:", error);
        toast({ variant: "destructive", title: "Error", description: "Ocurrió un error inesperado." });
    } finally {
        setLoading(false);
    }
  };

  const supervisoresRevisores = docentes.filter(d => d.responsabilidades.includes('docente_supervisor_revisores'));

  const title = isEditing ? "Editar Alumno" : "Añadir Nuevo Alumno";
  const description = isEditing ? "Actualice los datos del alumno." : "Complete los datos para registrar un nuevo alumno.";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
             <FormField
              control={form.control}
              name="apellidosNombres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellidos y Nombres</FormLabel>
                  <FormControl>
                    <Input placeholder="Perez, Juan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="temaBachiller"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tema de Trabajo de Bachiller</FormLabel>
                  <FormControl>
                    <Input placeholder="Título del trabajo de investigación..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="especialidad"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Especialidad</FormLabel>
                    <FormControl>
                    <Input placeholder="Ingeniería de Software" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            
            {(!isEditing || !studentHasPlan) && (
              <>
                <Separator />
                
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">Asignación Inicial (Opcional)</h4>
                    <FormDescription>
                       Si asigna un supervisor, el alumno le aparecerá como pendiente para que le asigne revisores.
                    </FormDescription>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="supervisorRevisoresId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Supervisor de Revisores</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="No asignar..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">No asignar</SelectItem>
                                        {supervisoresRevisores.map(d => (
                                            <SelectItem key={d.uid} value={d.uid}>{d.nombre} {d.apellidos}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                 <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DatePickerField control={form.control} name="fechaExpediente" label="Fecha de Expediente" />
                </div>
              </>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Guardar Cambios" : "Crear Alumno"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

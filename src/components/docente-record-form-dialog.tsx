

"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db, firebaseConfig } from "@/lib/firebase";
import { DocenteResponsabilidad } from "@/lib/types";
import { useAuth as useAppAuth } from "@/hooks/use-auth";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "./ui/checkbox";
import { initializeApp } from "firebase/app";
import { DocenteConteo } from "@/app/dashboard/teachers/page";

const responsabilidadesItems: { id: DocenteResponsabilidad; label: string }[] = [
    { id: 'docente_revisor', label: 'Revisor' },
    { id: 'docente_asesor', label: 'Asesor' },
    { id: 'docente_supervisor_revisores', label: 'Sup. de Revisores' },
    { id: 'docente_supervisor_asesores', label: 'Sup. de Asesores' },
    { id: 'docente_supervisor_turnitin', label: 'Sup. Turnitin'},
    { id: 'jurado', label: 'Jurado' },
];

const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

const normalizeString = (str: string) => {
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

const createFormSchema = (allDocentes: DocenteConteo[]) => z.object({
  nombre: z.string().min(2, "El nombre es requerido."),
  apellidos: z.string().min(2, "Los apellidos son requeridos."),
  responsabilidades: z.array(z.string()).default([]),
  correo: z.string().email("Debe ser un correo válido.").optional().or(z.literal('')),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    // Validation for supervisor role and credentials
    const isSupervisor = data.responsabilidades.some(r => r.includes('supervisor'));
    if (isSupervisor) {
        if ((data.correo && !data.password) || (!data.correo && data.password)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Si crea un supervisor, debe proporcionar correo y contraseña para darle acceso, o dejar ambos campos vacíos.",
              path: ["correo"],
            });
        }
    }
    // Rigorous validation for existing docente
    const newFullNameNormalized = normalizeString(`${data.apellidos}, ${data.nombre}`);
    const docenteExists = allDocentes.some(docente => {
        const existingFullNameNormalized = normalizeString(`${docente.apellidos}, ${docente.nombre}`);
        return existingFullNameNormalized === newFullNameNormalized;
    });

    if (docenteExists) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ya existe un docente con este nombre y apellido.",
            path: ["nombre"],
        });
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ya existe un docente con este nombre y apellido.",
            path: ["apellidos"],
        });
    }
});


type FormData = z.infer<ReturnType<typeof createFormSchema>>;

interface DocenteRecordFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allDocentes: DocenteConteo[];
}

export function DocenteRecordFormDialog({ 
  isOpen, 
  onOpenChange,
  allDocentes,
}: DocenteRecordFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAppAuth();
  
  const formSchema = createFormSchema(allDocentes);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      apellidos: "",
      responsabilidades: [],
      correo: "",
      password: "",
    }
  });
  
  const responsabilidades = form.watch('responsabilidades');
  const isSupervisor = responsabilidades.some(r => r.includes('supervisor'));

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);
    let tempApp;
    let tempAuth;

    try {
        if (!appUser) throw new Error("Current user not found");

        const wantsToCreateAuth = data.correo && data.password;

        if (wantsToCreateAuth) {
            tempApp = initializeApp(firebaseConfig, `temp-docente-creation-${Date.now()}`);
            tempAuth = getAuth(tempApp);
            
            const userCredential = await createUserWithEmailAndPassword(tempAuth, data.correo as string, data.password as string);
            const newUser = userCredential.user;
            await signOut(tempAuth);

            const roles = ['docente', ...(data.responsabilidades || [])];

            await setDoc(doc(db, 'users', newUser.uid), {
                nombre: capitalizeWords(data.nombre),
                apellidos: capitalizeWords(data.apellidos),
                correo: data.correo,
                roles: roles,
                activo: true,
                creadoEn: serverTimestamp(),
            });
            await logKeyAction({ userId: appUser.uid, action: 'create_teacher_user', details: `New Teacher User ID: ${newUser.uid}` });

            toast({
                title: "Usuario Docente Creado",
                description: `Se ha creado una cuenta para ${data.nombre} ${data.apellidos}.`,
            });
        } else {
            const newDocRef = doc(collection(db, "docentes"));
            const newDocenteData = {
                nombre: capitalizeWords(data.nombre),
                apellidos: capitalizeWords(data.apellidos),
                responsabilidades: data.responsabilidades,
                correo: `${newDocRef.id}@unfv-registro.local`,
                id: newDocRef.id,
                uid: newDocRef.id,
                creadoEn: serverTimestamp(),
            };
            await setDoc(newDocRef, newDocenteData);
            await logKeyAction({ userId: appUser.uid, action: 'create_teacher_record', details: `New Teacher Record ID: ${newDocRef.id}` });
            toast({
                title: "Registro de Docente Creado",
                description: "Se ha añadido un nuevo docente a la base de datos de registros.",
            });
        }
      
        onOpenChange(false);
        form.reset();

    } catch (error: any) {
      console.error("Error creando registro/usuario:", error);
      let errorMessage = 'Ocurrió un error inesperado.';
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    form.setError("correo", { type: "manual", message: "El correo electrónico ya está en uso." });
                    errorMessage = 'El correo electrónico ya está en uso.';
                    break;
                case 'auth/invalid-email': errorMessage = 'El correo electrónico no es válido.'; break;
                case 'auth/weak-password': errorMessage = 'La contraseña es demasiado débil.'; break;
                default: errorMessage = `Error: ${error.message}`;
            }
        }
        
        if (error.code !== 'auth/email-already-in-use') {
            toast({ variant: "destructive", title: "Error al Crear", description: errorMessage });
        }
    } finally {
      setLoading(false);
      if (tempAuth) { try { await signOut(tempAuth); } catch(e) {/* ignore */} }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if(!open) form.reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Docente (Registro)</DialogTitle>
          <DialogDescription>
            Cree un registro para un docente. Si se asigna un rol de Supervisor, puede crearle credenciales de acceso al sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input placeholder="Nombre" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="apellidos"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Apellidos</FormLabel>
                        <FormControl><Input placeholder="Apellidos" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
             <FormField
                control={form.control}
                name="responsabilidades"
                render={() => (
                    <FormItem>
                     <div className="mb-4">
                        <FormLabel>Responsabilidades Iniciales</FormLabel>
                        <FormDescription>
                            Seleccione las funciones que este docente puede desempeñar.
                        </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {responsabilidadesItems.map((item) => (
                        <FormField
                            key={item.id}
                            control={form.control}
                            name="responsabilidades"
                            render={({ field }) => {
                            return (
                                <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                                >
                                <FormControl>
                                    <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                        return checked
                                        ? field.onChange([...(field.value || []), item.id])
                                        : field.onChange(
                                            (field.value || [])?.filter(
                                                (value) => value !== item.id
                                            )
                                            );
                                    }}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal">
                                    {item.label}
                                </FormLabel>
                                </FormItem>
                            );
                            }}
                        />
                        ))}
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
              />

            {isSupervisor && (
                 <div className="space-y-4 pt-4 border-t">
                    <FormDescription>
                        Ha seleccionado un rol de Supervisor. Puede crear una cuenta de usuario para este docente para que pueda iniciar sesión.
                    </FormDescription>
                    <FormField control={form.control} name="correo" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correo Electrónico (para acceso)</FormLabel>
                            <FormControl><Input type="email" placeholder="correo.supervisor@unfv.edu.pe" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                     <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contraseña (para acceso)</FormLabel>
                            <FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                 </div>
            )}


            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Crear Registro
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

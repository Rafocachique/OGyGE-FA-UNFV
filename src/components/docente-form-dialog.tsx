
"use client";

import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, updateDoc, serverTimestamp, setDoc, deleteDoc, collection } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import { DocenteResponsabilidad, Docente } from "@/lib/types";

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
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";

const responsabilidadesItems: { id: DocenteResponsabilidad; label: string }[] = [
    { id: 'docente_revisor', label: 'Revisor' },
    { id: 'docente_asesor', label: 'Asesor' },
    { id: 'docente_supervisor_revisores', label: 'Sup. de Revisores' },
    { id: 'docente_supervisor_asesores', label: 'Sup. de Asesores' },
    { id: 'docente_supervisor_turnitin', label: 'Sup. Turnitin'},
    { id: 'jurado', label: 'Jurado' },
];

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre es requerido."),
  apellidos: z.string().min(2, "Los apellidos son requeridos."),
  responsabilidades: z.array(z.string()).default([]),
  correo: z.string().email("Debe ser un correo válido.").optional().or(z.literal('')),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional().or(z.literal('')),
});


type FormData = z.infer<typeof formSchema>;

interface DocenteFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editingDocente: (Docente & { isSystemUser?: boolean; roles?: string[] }) | null;
}

const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export function DocenteFormDialog({ 
  isOpen, 
  onOpenChange, 
  editingDocente,
}: DocenteFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
  const showCreateAccess = !editingDocente?.isSystemUser && responsabilidades.some((r: any) => r.includes('supervisor'));


  useEffect(() => {
    if (isOpen && editingDocente) {
        form.reset({
          nombre: editingDocente.nombre || "",
          apellidos: editingDocente.apellidos || "",
          responsabilidades: editingDocente.responsabilidades || [],
          correo: editingDocente.isSystemUser ? editingDocente.correo : "",
          password: "",
        });
    }
  }, [isOpen, editingDocente, form]);
  
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!editingDocente) return;
    setLoading(true);
    let tempApp;
    let tempAuth;

    try {
        const wantsToCreateAuth = !editingDocente.isSystemUser && data.correo && data.password;

        if (wantsToCreateAuth) {
             if (!data.correo || !data.password) {
                toast({ variant: "destructive", title: "Error", description: "Para crear acceso, el correo y la contraseña son obligatorios." });
                setLoading(false);
                return;
            }
            // "Promote" a record to a system user
            tempApp = initializeApp(firebaseConfig, `temp-docente-promotion-${Date.now()}`);
            tempAuth = getAuth(tempApp);
            
            const userCredential = await createUserWithEmailAndPassword(tempAuth, data.correo, data.password);
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

            // Delete the old record from "docentes" collection
            await deleteDoc(doc(db, "docentes", editingDocente.id));

            toast({
                title: "Docente Promovido a Usuario",
                description: `Se ha creado una cuenta para ${data.nombre} ${data.apellidos} y el registro ha sido migrado.`,
            });
        } else {
            // Just update the existing record (either in 'users' or 'docentes')
            const collectionName = editingDocente.isSystemUser ? "users" : "docentes";
            const docRef = doc(db, collectionName, editingDocente.id);
            
            const updateData: any = {
                nombre: capitalizeWords(data.nombre),
                apellidos: capitalizeWords(data.apellidos),
                actualizadoEn: serverTimestamp(),
            };

            if (editingDocente.isSystemUser) {
                const currentRoles = Array.isArray(editingDocente.roles) ? editingDocente.roles : [];
                const baseRoles = currentRoles.filter((r: any) => !r.startsWith('docente_') && r !== 'jurado');
                updateData.roles = [...baseRoles, ...data.responsabilidades];
            } else {
                updateData.responsabilidades = data.responsabilidades;
            }

            await updateDoc(docRef, updateData);

            toast({
                title: "Docente Actualizado",
                description: `Se han guardado los cambios para ${data.nombre} ${data.apellidos}.`,
            });
        }
        
        onOpenChange(false);
    } catch (error: any) {
        console.error("Error al procesar el docente:", error);
        let errorMessage = 'Ocurrió un error inesperado.';
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    form.setError("correo", { type: "manual", message: "El correo electrónico ya está en uso." });
                    errorMessage = 'El correo electrónico ya está en uso por otra cuenta.';
                    break;
                case 'auth/invalid-email': errorMessage = 'El correo electrónico no es válido.'; break;
                case 'auth/weak-password': errorMessage = 'La contraseña es demasiado débil.'; break;
                default: errorMessage = `Error: ${error.message}`;
            }
        }
        
        if (error.code !== 'auth/email-already-in-use') {
            toast({ variant: "destructive", title: "Error", description: errorMessage });
        }
    } finally {
        setLoading(false);
        if (tempAuth) { try { await signOut(tempAuth); } catch(e) {/* ignore */} }
    }
  };

  const title = `Editar Docente`;
  const description = `Actualice los datos y responsabilidades para ${editingDocente?.nombre} ${editingDocente?.apellidos}.`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input placeholder="Nombre" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="apellidos" render={({ field }) => (<FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input placeholder="Apellidos" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <FormField
                control={form.control}
                name="responsabilidades"
                render={() => (
                    <FormItem>
                     <div className="mb-4">
                        <FormLabel className="text-base">Responsabilidades Académicas</FormLabel>
                        <FormDescription>Seleccione las funciones que este docente puede desempeñar.</FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {responsabilidadesItems.map((item) => (
                        <FormField
                            key={item.id}
                            control={form.control}
                            name="responsabilidades"
                            render={({ field }) => {
                            return (
                                <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                        return checked
                                        ? field.onChange([...(field.value || []), item.id])
                                        : field.onChange((field.value || []).filter((value) => value !== item.id));
                                    }}
                                    />
                                </FormControl>
                                <FormLabel className="font-normal">{item.label}</FormLabel>
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

            {showCreateAccess && (
                 <div className="space-y-4 pt-4 border-t">
                    <FormDescription>Ha seleccionado un rol de Supervisor para un registro que no es usuario. Puede crearle una cuenta de acceso ahora o más tarde.</FormDescription>
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
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

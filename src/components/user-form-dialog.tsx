

"use client";

import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import { AppUser, UserRole, DocenteResponsabilidad } from "@/lib/types";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";

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
  correo: z.string().email("Debe ser un correo electrónico válido."),
  password: z.string().optional(),
  baseRole: z.enum(["admin", "decano", "alumno", "docente"], {
    errorMap: () => ({ message: "Debe seleccionar un rol principal." }),
  }),
  responsabilidades: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof formSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editingUser: AppUser | null;
  currentUser: AppUser | null;
}

const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export function UserFormDialog({ 
  isOpen, 
  onOpenChange, 
  editingUser,
  currentUser,
}: UserFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const isEditing = !!editingUser;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: "",
      apellidos: "",
      correo: "",
      password: "",
      baseRole: 'alumno',
      responsabilidades: [],
    }
  });

  const baseRole = form.watch("baseRole");

  useEffect(() => {
    if (isOpen) {
      if (isEditing && editingUser) {
        const baseRole = ["admin", "decano", "alumno", "docente"].find(r => editingUser.roles.includes(r as UserRole)) as "admin" | "decano" | "alumno" | "docente" | undefined;
        const responsabilidades = editingUser.roles.filter(r => r.startsWith('docente_') || r === 'jurado');
        form.reset({
          nombre: editingUser.nombre,
          apellidos: editingUser.apellidos,
          correo: editingUser.correo,
          baseRole: baseRole || 'alumno',
          responsabilidades: responsabilidades,
        });
      } else { 
        form.reset({
          nombre: "",
          apellidos: "",
          correo: "",
          password: "",
          baseRole: 'alumno',
          responsabilidades: [],
        });
      }
    }
  }, [isOpen, isEditing, editingUser, form]);
  
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);
    let tempApp;
    let tempAuth;

    try {
      if (!currentUser) throw new Error("Current user not found");

      const newRoles: UserRole[] = [data.baseRole as UserRole];
      if (data.baseRole === 'docente' && data.responsabilidades) {
        data.responsabilidades.forEach(resp => newRoles.push(resp as UserRole));
      }
      
      const processedData = {
          ...data,
          nombre: capitalizeWords(data.nombre),
          apellidos: capitalizeWords(data.apellidos),
          correo: data.correo.toLowerCase(),
      };

      if (isEditing && editingUser) {
        const userRef = doc(db, "users", editingUser.uid);
        
        await updateDoc(userRef, {
            nombre: processedData.nombre,
            apellidos: processedData.apellidos,
            roles: [...new Set(newRoles)], // Use Set to avoid duplicates
            // El correo no se debe editar para un usuario existente para evitar desincronización con Auth
            actualizadoEn: serverTimestamp(),
          });
          
          await logKeyAction({ userId: currentUser.uid, action: 'update_user', details: `User ID: ${editingUser.uid}` });

          toast({
            title: "Usuario Actualizado",
            description: "Los datos y roles del usuario han sido actualizados.",
          });
      } else { 
        if (!data.password || data.password.length < 6) {
            form.setError("password", { type: "manual", message: "La contraseña es requerida y debe tener al menos 6 caracteres." });
            setLoading(false);
            return;
        }
        
        // Usar una instancia temporal de Firebase para crear el usuario sin afectar la sesión actual
        tempApp = initializeApp(firebaseConfig, `temp-user-creation-app-${Date.now()}`);
        tempAuth = getAuth(tempApp);
        
        const userCredential = await createUserWithEmailAndPassword(tempAuth, processedData.correo, data.password);
        const newUser = userCredential.user;
        
        await signOut(tempAuth); // Cerrar sesión de la instancia temporal
        tempApp = undefined; // Liberar la instancia

        const userDoc = {
          nombre: processedData.nombre,
          apellidos: processedData.apellidos,
          correo: processedData.correo,
          roles: [...new Set(newRoles)],
          activo: true,
          creadoEn: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', newUser.uid), userDoc);
        
        await logKeyAction({ userId: currentUser.uid, action: 'create_user', details: `New User ID: ${newUser.uid}` });

        toast({
          title: "Usuario Creado",
          description: "El nuevo usuario ha sido registrado en el sistema.",
        });
      }
      
      onOpenChange(false);
    } catch (error: any) {
        let errorMessage = 'Ocurrió un error inesperado.';
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    form.setError("correo", { type: "manual", message: "El correo electrónico ya está en uso." });
                    errorMessage = 'El correo electrónico ya está en uso por otra cuenta.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'El formato del correo electrónico no es válido.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'La contraseña no es segura. Debe tener al menos 6 caracteres.';
                    break;
                default:
                    errorMessage = `Error de Firebase: ${error.message} (código: ${error.code})`;
            }
        }
        
        toast({
            variant: "destructive",
            title: "Error al crear usuario",
            description: errorMessage,
        });
    } finally {
        setLoading(false);
        if (tempAuth) {
            try { await signOut(tempAuth); } catch (e) { /* ignore */ }
        }
    }
  };

  const title = isEditing ? "Editar Usuario" : "Crear Nuevo Usuario";
  const description = "Complete el formulario para un usuario del sistema.";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="Apellidos" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="correo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="correo@unfv.edu.pe" {...field} disabled={isEditing} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
                control={form.control}
                name="baseRole"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Rol Principal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Seleccione un rol base" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="alumno">Alumno</SelectItem>
                        <SelectItem value="docente">Docente</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="decano">Decano</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />

            {baseRole === 'docente' && (
                <div className="space-y-4">
                <Separator />
                 <FormField
                    control={form.control}
                    name="responsabilidades"
                    render={() => (
                        <FormItem>
                         <div>
                            <FormLabel>Responsabilidades de Docente</FormLabel>
                            <FormDescription>
                                Asigne responsabilidades adicionales a este docente.
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
                                            ? field.onChange([...field.value, item.id])
                                            : field.onChange(
                                                field.value?.filter(
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
                </div>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Guardar Cambios" : "Crear Usuario"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

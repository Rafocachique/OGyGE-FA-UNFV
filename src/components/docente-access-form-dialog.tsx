"use client";

import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, firebaseConfig } from "@/lib/firebase";
import { Docente } from "@/lib/types";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  correo: z.string().email("Debe ser un correo electrónico válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type FormData = z.infer<typeof formSchema>;

interface DocenteAccessFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  docente: (Docente & { isSystemUser?: boolean }) | null;
}

export function DocenteAccessFormDialog({ 
  isOpen, 
  onOpenChange, 
  docente,
}: DocenteAccessFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      correo: "",
      password: "",
    }
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            correo: docente?.correo && !docente.isSystemUser ? docente.correo : "",
            password: "",
        });
    }
  }, [isOpen, docente, form]);
  
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!docente) return;
    setLoading(true);
    let tempApp;
    let tempAuth;

    try {
        tempApp = initializeApp(firebaseConfig, `temp-docente-creation-${Date.now()}`);
        tempAuth = getAuth(tempApp);
        
        const userCredential = await createUserWithEmailAndPassword(tempAuth, data.correo, data.password);
        const newUser = userCredential.user;
        await signOut(tempAuth);

        const roles = ['docente', ...(docente.responsabilidades || [])];

        await setDoc(doc(db, 'users', newUser.uid), {
            nombre: docente.nombre,
            apellidos: docente.apellidos,
            correo: data.correo,
            roles: roles,
            activo: true,
            creadoEn: serverTimestamp(),
        });
        
        // After creating the user, we can delete the old record from "docentes" collection
        await deleteDoc(doc(db, "docentes", docente.id));

        toast({
          title: "Acceso de Usuario Creado",
          description: `Se ha creado una cuenta para ${docente.nombre} ${docente.apellidos}. El registro anterior ha sido migrado.`,
        });
        
        onOpenChange(false);
    } catch (error: any) {
        console.error("Error creando acceso:", error);
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
            toast({ variant: "destructive", title: "Error al Crear Acceso", description: errorMessage });
        }
    } finally {
        setLoading(false);
        if (tempAuth) { try { await signOut(tempAuth); } catch(e) {/* ignore */} }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Acceso de Usuario</DialogTitle>
          <DialogDescription>
            Creando una cuenta para {docente?.nombre} {docente?.apellidos}. Este docente podrá iniciar sesión en el sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
                control={form.control}
                name="correo"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl><Input type="email" placeholder="correo.docente@unfv.edu.pe" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Crear Usuario
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

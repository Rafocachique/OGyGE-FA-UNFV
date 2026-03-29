

"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { doc, setDoc, collection, serverTimestamp, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, Student, Docente, User } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, FileUp } from "lucide-react";

const formSchema = z.object({
  apellidosNombres: z.string().min(2, "El nombre es requerido."),
  temaBachiller: z.string().optional(),
  especialidad: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};
  
const capitalizeSentence = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const generateUniqueCode = async (name: string): Promise<string> => {
    const parts = name.split(',').map(part => part.trim());
    const lastName = parts[0] || '';
    const firstName = parts[1] || '';

    let baseCode = ((firstName.charAt(0) || '') + (lastName.split(' ')[0].charAt(0) || '')).toUpperCase();
    if (baseCode.length < 2) baseCode = "XX";

    let finalCode = baseCode;
    let counter = 1;
    
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

export default function StudentTurnitinRegistrationPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apellidosNombres: "",
      temaBachiller: "",
      especialidad: "",
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    if (!appUser) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo identificar al usuario." });
        return;
    }
    setLoading(true);
    const batch = writeBatch(db);

    try {
        const tema = data.temaBachiller || "No especificado";
        const especialidad = data.especialidad || "No especificado";
        
        // --- 1. Create Student Record ---
        const newStudentRef = doc(collection(db, "students"));
        const newStudentCode = await generateUniqueCode(data.apellidosNombres);
        const newStudentData = {
            id: newStudentRef.id,
            apellidosNombres: capitalizeWords(data.apellidosNombres),
            temaBachiller: capitalizeSentence(tema),
            especialidad: capitalizeWords(especialidad),
            codigo: newStudentCode,
            creadoEn: serverTimestamp(),
            supervisorId: appUser.uid,
        };
        batch.set(newStudentRef, newStudentData);
        
        // --- 2. Create Thesis Plan Record ---
        const newPlanRef = doc(collection(db, "thesisPlans"));
        
        const planData = {
            id: newPlanRef.id,
            titulo: capitalizeSentence(tema),
            estudiante: {
              codigo: newStudentCode,
              apellidosNombres: capitalizeWords(data.apellidosNombres),
              especialidad: capitalizeWords(especialidad),
              temaBachiller: capitalizeSentence(tema),
            },
            estadoGlobal: "EN REVISION",
            listoParaTurnitin: true,
            turnitinSupervisorId: null,
            submissionDate: new Date().toISOString(),
            creadoEn: serverTimestamp(),
        };
        batch.set(newPlanRef, planData);

        // --- 3. Commit Batch ---
        await batch.commit();
        
        toast({
            title: "Registro Exitoso",
            description: `El alumno ${data.apellidosNombres} ha sido registrado y enviado a Turnitin.`,
        });
        
        form.reset();

    } catch (error: any) {
        console.error("Error en registro para Turnitin:", error);
        toast({
            variant: "destructive",
            title: "Error en el Registro",
            description: error.message || "Ocurrió un error inesperado al registrar al alumno.",
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FileUp />
                Registro Rápido para Turnitin
            </CardTitle>
            <CardDescription>
                Use este formulario para registrar alumnos que ya se encuentran en la etapa de revisión de Turnitin y necesitan ser ingresados al sistema. Se creará un plan de tesis sin asesor para que el Supervisor de Turnitin pueda gestionarlo.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    Registrando...
                                </>
                            ) : (
                                "Registrar y Enviar a Turnitin"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}

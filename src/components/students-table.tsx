

"use client";

import { deleteDoc, doc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ShieldCheck, ShieldOff } from "lucide-react";
import { AppUser, Student, ThesisPlan, Docente } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DocenteConResponsabilidad } from "@/app/dashboard/assignment/page";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface StudentsTableProps {
    students: Student[];
    onEdit: (student: Student) => void;
    currentUser: AppUser | null;
    thesisPlans: ThesisPlan[];
    docentes: DocenteConResponsabilidad[];
}

export function StudentsTable({ students, onEdit, currentUser, thesisPlans, docentes }: StudentsTableProps) {
    const { toast } = useToast();
    const isAdminOrDecano = currentUser?.roles.includes('admin') || currentUser?.roles.includes('decano');


    const handleDeleteStudent = async (studentToDelete: Student) => {
        const plan = thesisPlans.find(p => p.estudiante.codigo === studentToDelete.codigo);

        // Check if the plan is in a "deletable" state.
        // A plan is deletable if it's only in Turnitin stage and has no assignments.
        const isDeletablePlan = plan &&
            plan.listoParaTurnitin &&
            !plan.docenteRevisor1Id &&
            !plan.docenteRevisor2Id &&
            !plan.supervisorRevisoresId &&
            !plan.asesorId &&
            !plan.supervisorAsesoresId;

        // Block deletion if a plan exists and it's NOT a simple, deletable Turnitin plan
        if (plan && !isDeletablePlan) {
            toast({
                variant: "destructive",
                title: "Acción no permitida",
                description: "Este alumno no se puede eliminar porque tiene un plan de tesis con asignaciones activas. Transfiera la carga primero.",
            });
            return;
        }

        try {
            const batch = writeBatch(db);

            // Delete the student record
            const studentRef = doc(db, "students", studentToDelete.id);
            batch.delete(studentRef);

            // If a simple Turnitin plan exists, delete it too
            if (isDeletablePlan) {
                const planRef = doc(db, "thesisPlans", plan.id);
                batch.delete(planRef);
            }
            
            await batch.commit();

            toast({
                title: "Eliminación Exitosa",
                description: `El registro del alumno ${studentToDelete.apellidosNombres} y su plan de tesis asociado (si existía) han sido eliminados.`,
            });
        } catch (error) {
            console.error("Error eliminando alumno:", error);
            toast({
                variant: "destructive",
                title: "Error al Eliminar",
                description: "No se pudo eliminar el registro del alumno.",
            });
        }
    };

    const getSupervisorInfo = (student: Student) => {
        const plan = thesisPlans.find(p => p.estudiante.codigo === student.codigo);

        let supervisorId: string | undefined | null = null;
        let type: 'Revisión' | 'Asesoría' | 'Pre-asignado' | null = null;

        if (plan) {
            if (plan.supervisorAsesoresId) {
                supervisorId = plan.supervisorAsesoresId;
                type = 'Asesoría';
            } else if (plan.supervisorRevisoresId) {
                supervisorId = plan.supervisorRevisoresId;
                type = 'Revisión';
            }
        } else if (student.supervisorRevisoresId) {
            supervisorId = student.supervisorRevisoresId;
            type = 'Pre-asignado';
        }
        
        if (supervisorId) {
            const docente = docentes.find(d => d.uid === supervisorId);
            return {
                name: docente ? `${docente.nombre} ${docente.apellidos}` : "Desconocido",
                type: type
            };
        }

        return { name: "Sin Asignar", type: null };
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return "N/A";
        try {
            return format(new Date(dateString), 'dd/MM/yyyy');
        } catch {
            return "Fecha inválida";
        }
    }


    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Ítem</TableHead>
                        <TableHead>Apellidos y Nombres</TableHead>
                        <TableHead>Tema de Bachiller</TableHead>
                        <TableHead>Especialidad</TableHead>
                        <TableHead>Supervisor Asignado</TableHead>
                        <TableHead>Fecha Expediente</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {students.map((student, index) => {
                        const supervisorInfo = getSupervisorInfo(student);
                        
                        return (
                            <AlertDialog key={student.id}>
                                <TableRow>
                                    <TableCell className="text-center">{index + 1}</TableCell>
                                    <TableCell className="font-medium">{student.apellidosNombres}</TableCell>
                                    <TableCell className="max-w-xs truncate">{student.temaBachiller}</TableCell>
                                    <TableCell>{student.especialidad}</TableCell>
                                    <TableCell>
                                        <div>{supervisorInfo.name}</div>
                                        {supervisorInfo.type && (
                                            <Badge variant={supervisorInfo.type === 'Revisión' ? 'secondary' : (supervisorInfo.type === 'Pre-asignado' ? 'outline' : 'default')} className="mt-1">
                                                {supervisorInfo.type}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(student.fechaExpediente)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Menú</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => onEdit(student)}>
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem
                                                        onSelect={(e) => e.preventDefault()}
                                                        className="text-destructive"
                                                    >
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción no se puede deshacer. Esto eliminará permanentemente el registro del alumno y su plan de tesis asociado (si corresponde).
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => handleDeleteStudent(student)} 
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Sí, eliminar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>

                                    </TableCell>
                                </TableRow>
                            </AlertDialog>
                        )})}
                        {students.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No se encontraron alumnos.
                                </TableCell>
                            </TableRow>
                        )}
                </TableBody>
            </Table>
        </TooltipProvider>
    );
}

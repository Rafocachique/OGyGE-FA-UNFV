

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DotsHorizontalIcon } from "@radix-ui/react-icons"
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
    DropdownMenuTrigger,
    DropdownMenuSeparator,
  } from "@/components/ui/dropdown-menu"
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
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Assignment } from "@/lib/types";
import { Input } from "./ui/input";


interface RegisteredReviewsTableProps {
    assignments: Assignment[];
    onEdit: (assignmentId: string) => void;
    onDelete: (assignmentId: string) => void;
    assignmentType: 'revisores' | 'asesor';
}

export function RegisteredReviewsTable({ assignments, onEdit, onDelete, assignmentType }: RegisteredReviewsTableProps) {
    
    const formatDate = (isoDate: string) => {
        if (!isoDate) return 'N/A';
        try {
            return format(new Date(isoDate), 'dd/MM/yyyy', { locale: es });
        } catch (error) {
            return 'Fecha inválida';
        }
    }

    const headers = assignmentType === 'revisores'
        ? ["Alumno", "Supervisor", "Revisor 1", "Revisor 2", "Fecha"]
        : ["Alumno", "Supervisor", "Modalidad", "Asesor", "Fecha"];

    return (
        <div className="space-y-4">
            <div className="border rounded-lg">
                <Table id="assignments-table">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">Ítem</TableHead>
                            {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assignments.map((assignment, index) => (
                            <AlertDialog key={assignment.id}>
                                <TableRow>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{assignment.studentName}</TableCell>
                                    {assignmentType === 'revisores' ? (
                                        <>
                                            <TableCell>{assignment.supervisorRevisores || 'N/A'}</TableCell>
                                            <TableCell>{assignment.revisor1 || 'N/A'}</TableCell>
                                            <TableCell>{assignment.revisor2 || 'N/A'}</TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell>{assignment.supervisorAsesores || 'N/A'}</TableCell>
                                            <TableCell>{assignment.modalidad || 'N/A'}</TableCell>
                                            <TableCell>{assignment.asesor || 'N/A'}</TableCell>
                                        </>
                                    )}
                                    <TableCell>{formatDate(assignment.date)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Abrir menú</span>
                                                    <DotsHorizontalIcon className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onEdit(assignment.id)}>
                                                    Editar Asignación
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        Eliminar Asignación
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Está seguro de eliminar esta asignación?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción no se puede deshacer. Se eliminará el plan de tesis y el alumno volverá a la lista de pendientes.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => onDelete(assignment.id)}>Sí, eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </TableCell>
                                </TableRow>
                            </AlertDialog>
                        ))}
                        {assignments.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={headers.length + 2} className="h-24 text-center">
                                    No se encontraron resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

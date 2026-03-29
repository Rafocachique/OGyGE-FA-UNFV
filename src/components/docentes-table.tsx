

"use client";

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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, MoreHorizontal, Trash2, UserPlus, UserX, FileCheck, FileSearch, UserCheck, Eye, ArrowRightLeft } from "lucide-react";
import { UserRole } from "@/lib/types";
import { DocenteConteo } from "@/app/dashboard/teachers/page";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface DocentesTableProps {
    docentes: DocenteConteo[];
    onEdit: (docente: DocenteConteo) => void;
    onDelete: (docente: DocenteConteo) => void;
    onCreateAccess: (docente: DocenteConteo) => void;
    onTransfer: (docente: DocenteConteo) => void;
    canCreateAccess: boolean;
}

const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    decano: 'Decano',
    alumno: 'Alumno',
    docente: 'Docente',
    docente_revisor: 'Revisor',
    docente_asesor: 'Asesor',
    docente_supervisor_revisores: 'Sup. Revisores',
    docente_supervisor_asesores: 'Sup. Asesores',
    docente_supervisor_turnitin: 'Sup. Turnitin',
    jurado: 'Jurado',
};

export function DocentesTable({ docentes, onEdit, onDelete, onCreateAccess, onTransfer, canCreateAccess }: DocentesTableProps) {
    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Ítem</TableHead>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Responsabilidades</TableHead>
                        <TableHead>Asignaciones Actuales</TableHead>
                        <TableHead>Tipo de Registro</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {docentes.map((docente, index) => {
                        const isSupervisor = docente.responsabilidades.includes('docente_supervisor_revisores') || docente.responsabilidades.includes('docente_supervisor_asesores') || docente.responsabilidades.includes('docente_supervisor_turnitin');
                        const hasAssignments = docente.assignmentCounts.revisor > 0 || docente.assignmentCounts.asesor > 0 || docente.assignmentCounts.supRevisor > 0 || docente.assignmentCounts.supAsesor > 0;

                        return (
                        <AlertDialog key={docente.id}>
                            <TableRow>
                                <TableCell className="text-center">{index + 1}</TableCell>
                                <TableCell className="font-medium">
                                    <div>{docente.apellidos}, {docente.nombre}</div>
                                    <div className="text-xs text-muted-foreground">{docente.isSystemUser ? docente.correo : 'Sin correo'}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {docente.responsabilidades.length > 0 ? docente.responsabilidades.map(role => (
                                            <Badge key={role} variant={'secondary'} className="capitalize">
                                                {roleLabels[role as UserRole] || role.replace(/_/g, ' ')}
                                            </Badge>
                                        )) : <span className="text-muted-foreground text-xs">Ninguna</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                    {docente.assignmentCounts.revisor > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="flex items-center gap-1"><FileSearch size={12}/>{docente.assignmentCounts.revisor}</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Planes en revisión</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                    {docente.assignmentCounts.asesor > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="flex items-center gap-1"><UserCheck size={12}/>{docente.assignmentCounts.asesor}</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Tesis en asesoría</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                    {docente.assignmentCounts.supRevisor > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="flex items-center gap-1"><Eye size={12}/>{docente.assignmentCounts.supRevisor}</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Supervisiones de revisión</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                    {docente.assignmentCounts.supAsesor > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="flex items-center gap-1"><Eye size={12}/>{docente.assignmentCounts.supAsesor}</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Supervisiones de asesoría</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                    {docente.assignmentCounts.revisor === 0 && docente.assignmentCounts.asesor === 0 && docente.assignmentCounts.supRevisor === 0 && docente.assignmentCounts.supAsesor === 0 && (
                                        <span className="text-muted-foreground text-xs">Ninguna</span>
                                    )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={docente.isSystemUser ? 'default' : 'outline'} className="flex items-center gap-1 w-fit">
                                        {docente.isSystemUser ? <UserPlus size={14}/> : <UserX size={14}/>}
                                        {docente.isSystemUser ? 'Usuario del Sistema' : 'Solo Registro'}
                                    </Badge>
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
                                            <DropdownMenuItem onSelect={() => onEdit(docente)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Editar Docente
                                            </DropdownMenuItem>
                                            {hasAssignments && (
                                                <DropdownMenuItem onSelect={() => onTransfer(docente)}>
                                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                                    Transferir Carga
                                                </DropdownMenuItem>
                                            )}
                                            {!docente.isSystemUser && isSupervisor && canCreateAccess && (
                                                <DropdownMenuItem onSelect={() => onCreateAccess(docente)}>
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                    Crear Acceso
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="relative">
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem
                                                                onSelect={(e) => { if(hasAssignments) e.preventDefault()}}
                                                                className="text-destructive"
                                                                disabled={hasAssignments}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </div>
                                                </TooltipTrigger>
                                                {hasAssignments && (
                                                    <TooltipContent side="left">
                                                        <p>No se puede eliminar porque tiene asignaciones activas.</p>
                                                        <p>Transfiera la carga primero.</p>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                 Esta acción eliminará el registro del docente de la aplicación, pero no borrará su cuenta de autenticación si es un usuario del sistema. Para una eliminación completa, debe hacerlo desde la consola de Firebase.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => onDelete(docente)} 
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
                    {docentes.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                No se encontraron docentes.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TooltipProvider>
    );
}

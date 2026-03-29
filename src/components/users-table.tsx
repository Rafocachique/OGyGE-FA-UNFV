

"use client";

import { deleteDoc, doc, updateDoc } from "firebase/firestore";
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
import { MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User, UserRole, ThesisPlan } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface UsersTableProps {
    users: User[];
    onEdit: (user: User) => void;
    currentUser: User | null;
    allPlans: ThesisPlan[];
}

const capitalizeWords = (s: string) => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export function UsersTable({ users, onEdit, currentUser, allPlans }: UsersTableProps) {
    const { toast } = useToast();

    const handleToggleActive = async (user: User) => {
        if (user.uid === currentUser?.uid) {
            toast({
                variant: "destructive",
                title: "Acción no permitida",
                description: "No puedes desactivar tu propia cuenta.",
            });
            return;
        }
        const newStatus = !user.activo;
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            activo: newStatus,
            actualizadoEn: new Date().toISOString(),
          });
          toast({
            title: `Usuario ${newStatus ? 'Activado' : 'Desactivado'}`,
            description: `El estado del usuario ha sido actualizado.`,
          });
        } catch (error: any) {
            console.error("Error toggling user status:", error);
            toast({
              variant: "destructive",
              title: "Error al cambiar estado",
              description: error.message || "Ocurrió un error inesperado.",
            });
        }
    };
    
    const handleDeleteUser = async (userToDelete: User) => {
        if (userToDelete.uid === currentUser?.uid) {
            toast({ variant: "destructive", title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta." });
            return;
        }

        const hasAssignments = allPlans.some(plan =>
            plan.supervisorRevisoresId === userToDelete.uid ||
            plan.supervisorAsesoresId === userToDelete.uid ||
            plan.docenteRevisor1Id === userToDelete.uid ||
            plan.docenteRevisor2Id === userToDelete.uid ||
            plan.asesorId === userToDelete.uid
        );

        if (hasAssignments) {
            toast({
                variant: "destructive",
                title: "No se puede eliminar",
                description: "Este usuario tiene asignaciones activas. Por favor, transfiera su carga académica primero.",
            });
            return;
        }

        try {
            await deleteDoc(doc(db, "users", userToDelete.uid));
            toast({
                title: "Usuario Eliminado de la App",
                description: "El registro del usuario ha sido eliminado de la base de datos de la aplicación.",
            });
        } catch (error: any) {
            console.error("Error deleting user:", error);
            toast({
              variant: "destructive",
              title: "Error al eliminar",
              description: error.message || "No se pudo eliminar el usuario.",
            });
        }
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

    const baseRoles: UserRole[] = ["admin", "decano", "alumno", "docente"];

    return (
        <TooltipProvider>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead>Rol Principal</TableHead>
                        <TableHead>Responsabilidades Adicionales</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => {
                        const principalRole = user.roles.find(role => baseRoles.includes(role));
                        const responsibilities = user.roles.filter(role => !baseRoles.includes(role));
                        const displayName = `${capitalizeWords(user.nombre)} ${capitalizeWords(user.apellidos)}`;
                        const displayEmail = user.correo ? user.correo.toLowerCase() : '';
                        const isSelf = user.uid === currentUser?.uid;

                        const hasAssignments = allPlans.some(plan =>
                            plan.supervisorRevisoresId === user.uid ||
                            plan.supervisorAsesoresId === user.uid ||
                            plan.docenteRevisor1Id === user.uid ||
                            plan.docenteRevisor2Id === user.uid ||
                            plan.asesorId === user.uid
                        );

                        return (
                            <TableRow key={user.uid}>
                                <TableCell className="font-medium">{displayName}</TableCell>
                                <TableCell>{displayEmail}</TableCell>
                                <TableCell>
                                    {principalRole && (
                                        <Badge variant="outline" className="capitalize">
                                            {roleLabels[principalRole] || principalRole}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {responsibilities.length > 0 ? responsibilities.map(role => (
                                            <Badge key={role} variant={'secondary'} className="capitalize">
                                                {roleLabels[role] || role.replace(/_/g, ' ')}
                                            </Badge>
                                        )) : <span className="text-muted-foreground text-xs">Ninguna</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={user.activo ? 'default' : 'destructive'}>
                                        {user.activo ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isSelf}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Menú</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => onEdit(user)}>Editar Roles</DropdownMenuItem>
                                                
                                                <DropdownMenuItem onSelect={() => handleToggleActive(user)}>
                                                    {user.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
                                                </DropdownMenuItem>
                                                
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
                                                                    Eliminar Usuario
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </div>
                                                    </TooltipTrigger>
                                                    {hasAssignments && (
                                                        <TooltipContent side="left">
                                                            <p>No se puede eliminar. Transfiera la carga académica primero.</p>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción eliminará el registro del usuario de la aplicación, pero no borrará su cuenta de autenticación (su correo/contraseña de acceso). Para una eliminación completa, debe hacerlo desde la consola de Firebase.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => handleDeleteUser(user)} 
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Sí, eliminar de la app
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TooltipProvider>
    );
}

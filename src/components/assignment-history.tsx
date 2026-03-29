
"use client";

import { useState, useMemo } from 'react';
import { Assignment, AppUser } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from './ui/button';
import { ArrowUpDown, MoreHorizontal, Search } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface AssignmentHistoryProps {
  assignments: Assignment[];
  onDelete: (assignmentId: string) => void;
  onEdit: (assignment: Assignment) => void;
  currentUser: AppUser | null;
}

type SortKey = keyof Assignment;

const AssignmentTable = ({ 
    assignments, 
    type,
    searchTerm,
    onDelete,
    onEdit,
} : { 
    assignments: Assignment[], 
    type: 'revisores' | 'asesor',
    searchTerm: string,
    onDelete: (assignmentId: string) => void;
    onEdit: (assignment: Assignment) => void;
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>(null);
  
  const handleSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredAssignments = useMemo(() => {
    let sortableItems = assignments.filter(a => a.assignmentType === type);

    if (searchTerm) {
        sortableItems = sortableItems.filter(a =>
            a.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.revisor1 && a.revisor1.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.revisor2 && a.revisor2.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.asesor && a.asesor.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.supervisorRevisores && a.supervisorRevisores.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.supervisorAsesores && a.supervisorAsesores.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || bValue === undefined) return 0;

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return sortableItems;
  }, [assignments, searchTerm, type, sortConfig]);

  const headers = {
    revisores: (
      <TableRow>
        <TableHead className='w-[100px]'>Ítem</TableHead>
        <TableHead><Button variant="ghost" onClick={() => handleSort('studentName')}>Alumno<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
        <TableHead>Supervisor</TableHead>
        <TableHead>Revisor 1</TableHead>
        <TableHead>Revisor 2</TableHead>
        <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Fecha<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
        <TableHead><span className="sr-only">Acciones</span></TableHead>
      </TableRow>
    ),
    asesor: (
        <TableRow>
          <TableHead className='w-[100px]'>Ítem</TableHead>
          <TableHead><Button variant="ghost" onClick={() => handleSort('studentName')}>Alumno<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
          <TableHead>Supervisor</TableHead>
          <TableHead>Asesor</TableHead>
          <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Fecha<ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
          <TableHead><span className="sr-only">Acciones</span></TableHead>
        </TableRow>
      ),
  }

  const rowContent = (assignment: Assignment, index: number) => {
    if (type === 'revisores') {
        return (
            <>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>{assignment.studentName}</TableCell>
                <TableCell>{assignment.supervisorRevisores}</TableCell>
                <TableCell>{assignment.revisor1}</TableCell>
                <TableCell>{assignment.revisor2}</TableCell>
            </>
        )
    }
    return (
        <>
            <TableCell className="font-medium">{index + 1}</TableCell>
            <TableCell>{assignment.studentName}</TableCell>
            <TableCell>{assignment.supervisorAsesores}</TableCell>
            <TableCell>{assignment.asesor}</TableCell>
        </>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          {headers[type]}
        </TableHeader>
        <TableBody>
          {sortedAndFilteredAssignments.length > 0 ? (
            sortedAndFilteredAssignments.map((assignment, index) => (
              <TableRow key={assignment.id}>
                {rowContent(assignment, index)}
                <TableCell>{new Date(assignment.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Menú</span></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => onEdit(assignment)}>Editar Asignación</DropdownMenuItem>
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
                            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente el plan de tesis y su asignación.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => onDelete(assignment.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Sí, eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={type === 'revisores' ? 7 : 6} className="h-24 text-center">
                No se encontraron asignaciones de este tipo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};


export function AssignmentHistory({ assignments, onDelete, onEdit, currentUser }: AssignmentHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const roles = currentUser?.roles || [];
  const isAdminOrDecano = roles.includes('admin') || roles.includes('decano');
  const canSeeRevisores = isAdminOrDecano || roles.includes('docente_supervisor_revisores');
  const canSeeAsesores = isAdminOrDecano || roles.includes('docente_supervisor_asesores');

  const defaultTab = canSeeRevisores ? "revisores" : "asesores";
  const totalRevisores = assignments.filter(a => a.assignmentType === 'revisores').length;
  const totalAsesores = assignments.filter(a => a.assignmentType === 'asesor').length;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Asignaciones ({assignments.length})</CardTitle>
        <CardDescription>
          Consulte y filtre todas las asignaciones de revisores y asesores realizadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
            <div className="flex justify-between items-center mb-4">
                <TabsList>
                    {canSeeRevisores && <TabsTrigger value="revisores">Asignaciones de Revisores ({totalRevisores})</TabsTrigger>}
                    {canSeeAsesores && <TabsTrigger value="asesores">Asignaciones de Asesores ({totalAsesores})</TabsTrigger>}
                </TabsList>
                 <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar en la tabla actual..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            {canSeeRevisores && (
                <TabsContent value="revisores">
                    <AssignmentTable assignments={assignments} type="revisores" searchTerm={searchTerm} onDelete={onDelete} onEdit={onEdit} />
                </TabsContent>
            )}
            {canSeeAsesores && (
                <TabsContent value="asesores">
                    <AssignmentTable assignments={assignments} type="asesor" searchTerm={searchTerm} onDelete={onDelete} onEdit={onEdit} />
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

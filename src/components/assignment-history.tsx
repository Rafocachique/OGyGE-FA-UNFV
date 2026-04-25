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
import { ArrowUpDown, MoreHorizontal, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface AssignmentHistoryProps {
  assignments: Assignment[];
  onDelete: (assignmentId: string) => void;
  onEdit: (assignment: Assignment) => void;
  currentUser: AppUser | null;
}

const AssignmentTable = ({ 
    assignments, 
    type,
    searchTerm,
    globalSort,
    globalSupervisor,
    itemsPerPage,
    onDelete,
    onEdit,
} : { 
    assignments: Assignment[], 
    type: 'revisores' | 'asesor',
    searchTerm: string,
    globalSort: string,
    globalSupervisor: string,
    itemsPerPage: number,
    onDelete: (assignmentId: string) => void;
    onEdit: (assignment: Assignment) => void;
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Restart page on config change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, globalSort, globalSupervisor, itemsPerPage]);

  const sortedAndFilteredAssignments = useMemo(() => {
    let sortableItems = assignments.filter(a => a.assignmentType === type);

    if (globalSupervisor !== "all") {
        sortableItems = sortableItems.filter(a => type === 'revisores' ? a.supervisorRevisores === globalSupervisor : a.supervisorAsesores === globalSupervisor);
    }

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
    
    sortableItems.sort((a, b) => {
        if (globalSort === 'recent') {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (globalSort === 'oldest') {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (globalSort === 'alpha_asc') {
            return a.studentName.localeCompare(b.studentName);
        }
        if (globalSort === 'alpha_desc') {
            return b.studentName.localeCompare(a.studentName);
        }
        return 0;
    });

    return sortableItems;
  }, [assignments, searchTerm, type, globalSort, globalSupervisor]);

  const totalPages = Math.ceil(sortedAndFilteredAssignments.length / itemsPerPage) || 1;
  const paginatedAssignments = sortedAndFilteredAssignments.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  const headers = {
    revisores: (
      <TableRow>
        <TableHead className='w-[100px]'>Ítem</TableHead>
        <TableHead>Alumno</TableHead>
        <TableHead>Supervisor</TableHead>
        <TableHead>Revisor 1</TableHead>
        <TableHead>Revisor 2</TableHead>
        <TableHead>Fecha</TableHead>
        <TableHead><span className="sr-only">Acciones</span></TableHead>
      </TableRow>
    ),
    asesor: (
        <TableRow>
          <TableHead className='w-[100px]'>Ítem</TableHead>
          <TableHead>Alumno</TableHead>
          <TableHead>Supervisor</TableHead>
          <TableHead>Asesor</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead><span className="sr-only">Acciones</span></TableHead>
        </TableRow>
      ),
  };

  const rowContent = (assignment: Assignment, index: number) => {
    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
    if (type === 'revisores') {
        return (
            <>
                <TableCell className="font-medium">{globalIndex}</TableCell>
                <TableCell>{assignment.studentName}</TableCell>
                <TableCell>{assignment.supervisorRevisores}</TableCell>
                <TableCell>{assignment.revisor1}</TableCell>
                <TableCell>{assignment.revisor2}</TableCell>
            </>
        )
    }
    return (
        <>
            <TableCell className="font-medium">{globalIndex}</TableCell>
            <TableCell>{assignment.studentName}</TableCell>
            <TableCell>{assignment.supervisorAsesores}</TableCell>
            <TableCell>{assignment.asesor}</TableCell>
        </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {headers[type]}
          </TableHeader>
          <TableBody>
            {paginatedAssignments.length > 0 ? (
              paginatedAssignments.map((assignment, index) => (
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

      {/* Pagination Controls */}
      {sortedAndFilteredAssignments.length > 0 && (
        <div className="flex items-center justify-between px-2">
            <div className="text-sm text-muted-foreground w-1/3">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sortedAndFilteredAssignments.length)} de {sortedAndFilteredAssignments.length}
            </div>
            <div className="flex items-center justify-center gap-2 w-1/3">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <div className="text-sm font-medium"> {currentPage} / {totalPages} </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage >= totalPages} 
                >
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
            <div className="w-1/3"></div>
        </div>
      )}
    </div>
  );
};


export function AssignmentHistory({ assignments, onDelete, onEdit, currentUser }: AssignmentHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [globalSort, setGlobalSort] = useState("recent");
  const [globalSupervisor, setGlobalSupervisor] = useState("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const roles = currentUser?.roles || [];
  const isAdminOrDecano = roles.includes('admin') || roles.includes('decano');
  const canSeeRevisores = isAdminOrDecano || roles.includes('docente_supervisor_revisores');
  const canSeeAsesores = isAdminOrDecano || roles.includes('docente_supervisor_asesores');

  const defaultTab = canSeeRevisores ? "revisores" : "asesores";
  const totalRevisores = assignments.filter(a => a.assignmentType === 'revisores').length;
  const totalAsesores = assignments.filter(a => a.assignmentType === 'asesor').length;

  const allSupervisors = Array.from(
    new Set(
      assignments.map(a => a.assignmentType === 'revisores' ? a.supervisorRevisores : a.supervisorAsesores)
      .filter(Boolean)
    )
  ) as string[];

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
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                    <TabsList className="w-full sm:w-auto">
                        {canSeeRevisores && <TabsTrigger value="revisores" className="flex-1 sm:flex-none">Revisores ({totalRevisores})</TabsTrigger>}
                        {canSeeAsesores && <TabsTrigger value="asesores" className="flex-1 sm:flex-none">Asesores ({totalAsesores})</TabsTrigger>}
                    </TabsList>
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar alumno o revisor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                
                {/* Global Filters */}
                <div className="flex flex-wrap gap-4 items-center bg-muted/20 p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Ordenar:</span>
                        <Select value={globalSort} onValueChange={setGlobalSort}>
                            <SelectTrigger className="w-[160px] bg-background">
                                <SelectValue placeholder="Ordenar por" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">Más recientes</SelectItem>
                                <SelectItem value="oldest">Más antiguos</SelectItem>
                                <SelectItem value="alpha_asc">Alfabético (A-Z)</SelectItem>
                                <SelectItem value="alpha_desc">Alfabético (Z-A)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Supervisor:</span>
                        <Select value={globalSupervisor} onValueChange={setGlobalSupervisor}>
                            <SelectTrigger className="w-[180px] sm:w-[220px] bg-background">
                                <SelectValue placeholder="Supervisor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los supervisores</SelectItem>
                                {allSupervisors.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Mostrar:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                            <SelectTrigger className="w-[110px] bg-background">
                                <SelectValue placeholder="Mostrar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="5">5 / Pág.</SelectItem>
                                <SelectItem value="10">10 / Pág.</SelectItem>
                                <SelectItem value="20">20 / Pág.</SelectItem>
                                <SelectItem value="50">50 / Pág.</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {canSeeRevisores && (
                <TabsContent value="revisores">
                    <AssignmentTable 
                        assignments={assignments} 
                        type="revisores" 
                        searchTerm={searchTerm} 
                        globalSort={globalSort}
                        globalSupervisor={globalSupervisor}
                        itemsPerPage={itemsPerPage}
                        onDelete={onDelete} 
                        onEdit={onEdit} 
                    />
                </TabsContent>
            )}
            {canSeeAsesores && (
                <TabsContent value="asesores">
                    <AssignmentTable 
                        assignments={assignments} 
                        type="asesor" 
                        searchTerm={searchTerm} 
                        globalSort={globalSort}
                        globalSupervisor={globalSupervisor}
                        itemsPerPage={itemsPerPage}
                        onDelete={onDelete} 
                        onEdit={onEdit} 
                    />
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

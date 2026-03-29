
"use client";

import { AppUser, Student, ThesisPlan } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { StudentWithCreator } from "@/app/dashboard/assignment/page";

interface PendingAssignmentsProps {
  students: StudentWithCreator[];
  onAssign: (student: Student) => void;
  currentUser: AppUser | null;
  creators: { id: string; name: string }[];
  selectedCreator: string;
  onCreatorChange: (value: string) => void;
}

export function PendingAssignments({ students, onAssign, currentUser, creators, selectedCreator, onCreatorChange }: PendingAssignmentsProps) {
    const isAdminOrDecano = currentUser?.roles.includes('admin') || currentUser?.roles.includes('decano');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Alumnos Pendientes de Asignación ({students.length})</CardTitle>
          <CardDescription>
            Estos alumnos han completado los requisitos iniciales y están listos para que se les asignen revisores o asesores.
          </CardDescription>
        </div>
        {isAdminOrDecano && creators.length > 0 && (
          <Select value={selectedCreator} onValueChange={onCreatorChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filtrar por creador..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Creadores</SelectItem>
              {creators.map(creator => (
                <SelectItem key={creator.id} value={creator.id}>
                  {creator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {students.length > 0 ? (
          <ScrollArea className="h-96 w-full pr-4">
            <ul className="space-y-4">
              {students.map((student, index) => (
                <li key={student.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center gap-4">
                      <span className="font-semibold text-sm w-8 text-center">{index + 1}</span>
                    <div>
                      <p className="font-semibold">{student.apellidosNombres}</p>
                      <p className="text-sm text-muted-foreground">{student.especialidad}</p>
                       {student.creatorName && (
                          <Badge variant="secondary" className="mt-2 flex items-center gap-1.5 w-fit">
                              <User size={12} /> Creado por: {student.creatorName === 'Admin/Decano' ? 'Admin' : student.creatorName}
                          </Badge>
                       )}
                    </div>
                  </div>
                  <Button onClick={() => onAssign(student)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Asignar
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-center border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No hay alumnos pendientes para los filtros seleccionados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

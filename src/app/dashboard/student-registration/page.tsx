

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoaderCircle, UserPlus, Users, Search } from "lucide-react";
import { Student, ThesisPlan, Docente, User } from "@/lib/types";
import { onSnapshot, collection, query, where, Unsubscribe, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StudentsTable } from "@/components/students-table";
import { StudentFormDialog } from "@/components/student-form-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocenteConResponsabilidad } from "@/app/dashboard/assignment/page";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function StudentRegistrationPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [docentes, setDocentes] = useState<DocenteConResponsabilidad[]>([]);
  const [thesisPlans, setThesisPlans] = useState<ThesisPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyPreAssigned, setShowOnlyPreAssigned] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { appUser } = useAuth();

  useEffect(() => {
    const usersQuery = query(collection(db, "users"), where("roles", "array-contains", "docente"));
    const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
        const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id, id: doc.id } as unknown as User));
        const docentesRecordsQuery = collection(db, "docentes");
        const unsubRecords = onSnapshot(docentesRecordsQuery, (recordsSnapshot) => {
            const recordsData = recordsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Docente));
            const combined = [...usersData.map(u => ({ ...u, responsabilidades: u.roles }))] as DocenteConResponsabilidad[];
            const userEmails = new Set(usersData.map(u => u.correo));
            recordsData.forEach(r => {
                if (r.correo && !userEmails.has(r.correo)) {
                    combined.push({ ...r, uid: r.id, responsabilidades: r.responsabilidades || [] });
                } else if (!r.correo) {
                    combined.push({ ...r, uid: r.id, responsabilidades: r.responsabilidades || [] });
                }
            });
            setDocentes(combined);
        });
        return () => unsubRecords();
    });
    return () => unsubUsers();
  }, []);

  // Effect to load all thesis plans
  useEffect(() => {
    const plansQuery = query(collection(db, "thesisPlans"));
    const unsubPlans = onSnapshot(plansQuery, (snapshot) => {
        const plansData = snapshot.docs.map(doc => doc.data() as ThesisPlan);
        setThesisPlans(plansData);
    }, (error) => {
        console.error("Error fetching thesis plans:", error);
    });
    return () => unsubPlans();
  }, []);

  // Effect to load and filter students
  useEffect(() => {
    if (!appUser) return;

    setLoading(true);

    const allStudentsQuery = query(collection(db, "students"));

    const unsubStudents = onSnapshot(allStudentsQuery, async (snapshot) => {
      const allStudentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      const isAdminOrDecano = appUser.roles.includes('admin') || appUser.roles.includes('decano');

      if (isAdminOrDecano) {
        setStudents(allStudentsData);
        setLoading(false);
      } else {
        // For supervisors, fetch plans they supervise and then filter students
        const queriesToRun = [];
        if (appUser.roles.includes('docente_supervisor_revisores')) {
            queriesToRun.push(query(collection(db, "thesisPlans"), where("supervisorRevisoresId", "==", appUser.uid)));
        }
        if (appUser.roles.includes('docente_supervisor_asesores')) {
            queriesToRun.push(query(collection(db, "thesisPlans"), where("supervisorAsesoresId", "==", appUser.uid)));
        }

        try {
            const results = await Promise.all(queriesToRun.map(q => getDocs(q)));
            const supervisedStudentCodes = new Set<string>();
            results.forEach(querySnapshot => {
                querySnapshot.forEach(doc => {
                    supervisedStudentCodes.add(doc.data().estudiante.codigo);
                });
            });

            // A supervisor sees a student IF:
            // 1. They created the student record.
            // 2. The student is in a plan they supervise.
            const supervisorStudents = allStudentsData.filter(student =>
                student.supervisorId === appUser.uid || supervisedStudentCodes.has(student.codigo)
            );

            setStudents(supervisorStudents);
        } catch (error) {
            console.error("Error fetching supervisor's students:", error);
            setStudents([]); // Clear students on error
        } finally {
            setLoading(false);
        }
      }
    }, (error) => {
      console.error("Error fetching students:", error);
      setLoading(false);
    });

    return () => unsubStudents();
  }, [appUser]);
  
  const filteredAndSortedStudents = useMemo(() => {
    const assignedStudentCodes = new Set(thesisPlans.map(p => p.estudiante.codigo));
    
    let filtered = students.filter(student => 
        student.apellidosNombres.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showOnlyPreAssigned) {
        filtered = filtered.filter(student => {
            const isPreAssigned = !!student.supervisorRevisoresId && !!student.fechaExpediente;
            const hasPlan = assignedStudentCodes.has(student.codigo);
            return isPreAssigned && !hasPlan;
        });
    }

    return filtered.sort((a, b) => a.apellidosNombres.localeCompare(b.apellidosNombres));
  }, [students, searchTerm, showOnlyPreAssigned, thesisPlans]);


  const openNewStudentDialog = () => {
    setEditingStudent(null);
    setIsDialogOpen(true);
  }

  const openEditStudentDialog = (student: Student) => {
    setEditingStudent(student);
    setIsDialogOpen(true);
  }

  // Get all students for the duplicate check in the form, regardless of filtering
  const [allStudentsForValidation, setAllStudentsForValidation] = useState<Student[]>([]);
  useEffect(() => {
    const q = query(collection(db, "students"));
    const unsub = onSnapshot(q, (snapshot) => {
      setAllStudentsForValidation(snapshot.docs.map(doc => doc.data() as Student));
    });
    return () => unsub();
  }, []);

  return (
    <>
      <Card className="flex flex-col flex-grow">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5"/>
                    Gestión de Alumnos
                  </CardTitle>
                  <CardDescription>Cree, edite y gestione los registros de los alumnos.</CardDescription>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className="relative flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar alumno..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                    />
                 </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="pre-assigned-filter" checked={showOnlyPreAssigned} onCheckedChange={(checked) => setShowOnlyPreAssigned(checked as boolean)} />
                    <Label htmlFor="pre-assigned-filter" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Mostrar solo pre-asignados
                    </Label>
                  </div>
                 <Button onClick={openNewStudentDialog}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Añadir Alumno
                 </Button>
              </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <ScrollArea className="flex-grow">
                    <StudentsTable 
                        students={filteredAndSortedStudents} 
                        onEdit={openEditStudentDialog} 
                        currentUser={appUser} 
                        thesisPlans={thesisPlans}
                        docentes={docentes}
                    />
                </ScrollArea>
            )}
          </CardContent>
      </Card>

      <StudentFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingStudent={editingStudent}
        allStudents={allStudentsForValidation}
        docentes={docentes}
        currentUser={appUser}
        thesisPlans={thesisPlans}
      />
    </>
  );
}

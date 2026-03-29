

"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where, doc, deleteDoc, getDocs, or, and, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Student, ThesisPlan, Docente, User, Assignment, DocenteResponsabilidad } from "@/lib/types";

import { AssignmentFormDialog } from "@/components/assignment-form-dialog";
import { RegisteredReviewsTable } from "@/components/registered-reviews-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, LoaderCircle, Search, User as UserIcon } from "lucide-react";
import { PendingAssignments } from "@/components/pending-assignments";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { logKeyAction } from "@/lib/actions";

export type DocenteConResponsabilidad = (Docente | User) & { responsabilidades: DocenteResponsabilidad[] };
export type StudentWithCreator = Student & { creatorName?: string };


export default function AssignmentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [thesisPlans, setThesisPlans] = useState<ThesisPlan[]>([]);
  const [docentes, setDocentes] = useState<DocenteConResponsabilidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingPlan, setEditingPlan] = useState<ThesisPlan | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { appUser } = useAuth();
  const { toast } = useToast();
    
  const userRoles = appUser?.roles || [];
  const isAdminOrDecano = userRoles.includes('admin') || userRoles.includes('decano');
  const canSeeRevisores = isAdminOrDecano || userRoles.includes('docente_supervisor_revisores');
  const canSeeAsesores = isAdminOrDecano || userRoles.includes('docente_supervisor_asesores');
  const defaultTab = canSeeRevisores ? 'revisores' : (canSeeAsesores ? 'asesores' : '');

  useEffect(() => {
    const studentsQuery = collection(db, "students");
    const unsubStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(studentsData);
    });
    
    return () => unsubStudents();
  }, []);

  useEffect(() => {
    setLoading(true);
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

            // Fetch thesis plans only after docentes are loaded to ensure data consistency
            if (appUser) {
                const plansQuery = query(collection(db, "thesisPlans"));
                const unsubPlans = onSnapshot(plansQuery, (snapshot) => {
                    const plansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThesisPlan));
                    setThesisPlans(plansData);
                    setLoading(false); // Only stop loading after all necessary data is fetched
                }, (error) => {
                    console.error("Error fetching thesis plans: ", error);
                    toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar los planes de tesis." });
                    setLoading(false);
                });
                return () => unsubPlans();
            } else {
                 setLoading(false);
            }
        });
        return () => unsubRecords();
    });

    return () => unsubUsers();
  }, [appUser, toast]);
  
  const handleOpenDialog = (student: Student, plan?: ThesisPlan) => {
    const existingPlan = plan || thesisPlans.find(p => p.estudiante.codigo === student.codigo);
    setSelectedStudent(student);
    setEditingPlan(existingPlan || null);
    setIsDialogOpen(true);
  };
  
  const handleDeletePlan = async (planId: string) => {
    if (!appUser) return;
    try {
        await deleteDoc(doc(db, "thesisPlans", planId));
        await logKeyAction({ userId: appUser.uid, action: 'delete_assignment', details: `Plan ID: ${planId}` });
        toast({
            title: "Asignación Eliminada",
            description: "El plan de tesis ha sido eliminado y el alumno está disponible para una nueva asignación.",
        });
    } catch (error) {
        console.error("Error deleting plan:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar la asignación.",
        });
    }
  };

 const studentsToAssign = useMemo(() => {
    let pendingStudents = students.filter(s => {
        const plan = thesisPlans.find(p => p.estudiante.codigo === s.codigo);
        if (!plan) return true;
        if (plan.estadoGlobal === "LISTO PARA ASESOR" && !plan.asesorId) return true;
        return false;
    });

    if (!isAdminOrDecano && appUser?.uid) {
      pendingStudents = pendingStudents.filter(s => {
          const plan = thesisPlans.find(p => p.estudiante.codigo === s.codigo);
          if (plan) {
              return userRoles.includes('docente_supervisor_asesores');
          }

          const wasCreatedByMe = s.supervisorId === appUser.uid;
          const wasPreAssignedToMe = s.supervisorRevisoresId === appUser.uid;
          const noSpecificOwner = !s.supervisorId && !s.supervisorRevisoresId;
          return wasCreatedByMe || wasPreAssignedToMe || noSpecificOwner;
      });
    }

    const studentsWithCreators = pendingStudents.map(student => {
        const creator = docentes.find(d => d.uid === student.supervisorId);
        return {
            ...student,
            creatorName: creator ? `${creator.nombre} ${creator.apellidos}` : (student.supervisorId ? 'Desconocido' : 'Admin'),
        }
    }).sort((a, b) => a.apellidosNombres.localeCompare(b.apellidosNombres));
    
    if (isAdminOrDecano && selectedCreator !== 'all') {
        if(selectedCreator === 'admin') {
            return studentsWithCreators.filter(s => s.creatorName === 'Admin');
        }
        const selectedCreatorDocente = docentes.find(d => d.uid === selectedCreator);
        const selectedCreatorName = selectedCreatorDocente ? `${selectedCreatorDocente.nombre} ${selectedCreatorDocente.apellidos}` : 'Admin';
        return studentsWithCreators.filter(s => s.creatorName === selectedCreatorName);
    }

    return studentsWithCreators;
}, [students, thesisPlans, docentes, isAdminOrDecano, appUser?.uid, selectedCreator]);

  const creators = useMemo(() => {
    const creatorIds = new Set(students.map(s => s.supervisorId).filter(Boolean));
    const creatorList = Array.from(creatorIds).map(id => {
      const docente = docentes.find(d => d.uid === id);
      return { id: id as string, name: docente ? `${docente.nombre} ${docente.apellidos}` : 'Desconocido' };
    }).filter(c => c.name !== 'Desconocido');
  
    const hasAdminCreated = students.some(s => !s.supervisorId);
    if (hasAdminCreated && !creatorList.some(c => c.id === 'admin')) {
      creatorList.unshift({ id: 'admin', name: 'Admin' });
    }
  
    return creatorList;
  }, [students, docentes]);


  const allAssignments: Assignment[] = useMemo(() => {
    if (!docentes.length) return [];

    let plansToDisplay = thesisPlans;
    if (!isAdminOrDecano) {
        plansToDisplay = thesisPlans.filter(plan => 
            (canSeeRevisores && plan.supervisorRevisoresId === appUser?.uid) ||
            (canSeeAsesores && plan.supervisorAsesoresId === appUser?.uid)
        );
    }

    const getDocenteName = (docenteId?: string) => {
        const docente = docentes.find(d => d.uid === docenteId);
        return docente ? `${docente.nombre} ${docente.apellidos}` : "N/A";
    };

    return plansToDisplay
        .filter(plan => !(plan.listoParaTurnitin && !plan.docenteRevisor1Id && !plan.asesorId))
        .map((plan) => {
            const isReviewStage = plan.estadoGlobal === "EN REVISION" || plan.estadoGlobal === "LISTO PARA ASESOR" || (plan.estadoGlobal === "ARCHIVADO" && !plan.asesorId) || (plan.estadoGlobal === "DESAPROBADO" && !plan.asesorId);
            const assignmentType = isReviewStage ? 'revisores' : 'asesor';

        return {
            id: plan.id,
            studentId: plan.estudiante.codigo,
            studentName: plan.estudiante.apellidosNombres,
            assignmentType,
            modalidad: plan.modalidad,
            revisor1: getDocenteName(plan.docenteRevisor1Id),
            revisor2: getDocenteName(plan.docenteRevisor2Id),
            supervisorRevisores: getDocenteName(plan.supervisorRevisoresId),
            asesor: getDocenteName(plan.asesorId),
            supervisorAsesores: getDocenteName(plan.supervisorAsesoresId),
            date: plan.submissionDate,
        };
    });
  }, [thesisPlans, docentes, isAdminOrDecano, appUser, canSeeRevisores, canSeeAsesores]);

  const filteredAssignments = useMemo(() => {
    if (!searchTerm) {
        return allAssignments;
    }
    return allAssignments.filter(assignment =>
        assignment.studentName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allAssignments, searchTerm]);

  const { reviewerAssignments, advisorAssignments } = useMemo(() => ({
    reviewerAssignments: filteredAssignments.filter(a => a.assignmentType === 'revisores'),
    advisorAssignments: filteredAssignments.filter(a => a.assignmentType === 'asesor')
  }), [filteredAssignments]);

  const canCreateNew = userRoles.includes('admin') || userRoles.includes('decano') || userRoles.includes('docente_supervisor_revisores') || userRoles.includes('docente_supervisor_asesores');

  if (loading) {
    return <div className="flex justify-center items-center h-64"><LoaderCircle className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {canCreateNew && (
        <PendingAssignments 
            students={studentsToAssign}
            onAssign={handleOpenDialog} 
            currentUser={appUser}
            creators={creators}
            selectedCreator={selectedCreator}
            onCreatorChange={setSelectedCreator}
        />
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Historial de Asignaciones
                {` (${allAssignments.length})`}
                </CardTitle>
              <CardDescription>Consulte y filtre todas las asignaciones de revisores y asesores realizadas.</CardDescription>
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por alumno..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab}>
             <div className="flex items-center justify-between pb-4 border-b">
                <TabsList>
                    {canSeeRevisores && <TabsTrigger value="revisores">Asignaciones de Revisores ({reviewerAssignments.length})</TabsTrigger>}
                    {canSeeAsesores && <TabsTrigger value="asesores">Asignaciones de Asesores ({advisorAssignments.length})</TabsTrigger>}
                </TabsList>
            </div>
            {canSeeRevisores && (
                <TabsContent value="revisores" className="mt-4">
                  <RegisteredReviewsTable 
                    assignments={reviewerAssignments} 
                    onEdit={(assignmentId) => {
                      const plan = thesisPlans.find(p => p.id === assignmentId);
                      const student = students.find(s => s.codigo === plan?.estudiante.codigo);
                      if (plan && student) handleOpenDialog(student, plan);
                    }}
                    onDelete={handleDeletePlan}
                    assignmentType="revisores"
                  />
                </TabsContent>
            )}
            {canSeeAsesores && (
                <TabsContent value="asesores" className="mt-4">
                  <RegisteredReviewsTable 
                    assignments={advisorAssignments} 
                    onEdit={(assignmentId) => {
                      const plan = thesisPlans.find(p => p.id === assignmentId);
                      const student = students.find(s => s.codigo === plan?.estudiante.codigo);
                      if (plan && student) handleOpenDialog(student, plan);
                    }}
                    onDelete={handleDeletePlan}
                    assignmentType="asesor"
                  />
                </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <AssignmentFormDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        student={selectedStudent}
        docentes={docentes}
        editingPlan={editingPlan}
        currentUser={appUser}
      />
    </div>
  );
}

    
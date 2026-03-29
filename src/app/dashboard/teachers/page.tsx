

"use client";

import { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Docente, DocenteResponsabilidad, ThesisPlan } from "@/lib/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoaderCircle, UserPlus, Users, Search } from "lucide-react";
import { DocentesTable } from "@/components/docentes-table";
import { DocenteFormDialog } from "@/components/docente-form-dialog";
import { DocenteRecordFormDialog } from "@/components/docente-record-form-dialog";
import { DocenteAccessFormDialog } from "@/components/docente-access-form-dialog";
import { DocenteTransferDialog } from "@/components/docente-transfer-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";

export type DocenteConteo = Docente & {
  isSystemUser?: boolean;
  roles?: string[];
  assignmentCounts: {
    revisor: number;
    asesor: number;
    supRevisor: number;
    supAsesor: number;
  };
};

export default function TeachersPage() {
  const [loading, setLoading] = useState(true);
  const [docentes, setDocentes] = useState<DocenteConteo[]>([]);
  const [thesisPlans, setThesisPlans] = useState<ThesisPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [editingDocente, setEditingDocente] = useState<DocenteConteo | null>(null);
  const [transferDocente, setTransferDocente] = useState<DocenteConteo | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const { appUser } = useAuth();

  useEffect(() => {
    setLoading(true);

    const usersQuery = query(collection(db, "users"), where("roles", "array-contains", "docente"));
    const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
        const docenteUsers: (Docente & {isSystemUser: boolean, roles: string[]})[] = usersSnapshot.docs.map(doc => {
            const data = doc.data() as User;
            const responsabilidades = (data.roles || []).filter(r => r.startsWith('docente_') || r === 'jurado') as DocenteResponsabilidad[];
            return {
                id: doc.id,
                uid: doc.id,
                nombre: data.nombre,
                apellidos: data.apellidos,
                correo: data.correo,
                roles: data.roles,
                responsabilidades: responsabilidades,
                creadoEn: data.creadoEn,
                isSystemUser: true
            };
        });

        const recordsQuery = collection(db, "docentes");
        const unsubRecords = onSnapshot(recordsQuery, (recordsSnapshot) => {
            const docenteRecords: (Docente & {isSystemUser: boolean})[] = recordsSnapshot.docs.map(doc => {
                const data = doc.data() as Omit<Docente, 'id'> & {uid: string};
                return { 
                    id: doc.id,
                    ...data,
                    isSystemUser: false 
                };
            });

            const allDocentes: (Docente & {isSystemUser: boolean, roles?: string[]})[] = [...docenteUsers];
            const userEmails = new Set(docenteUsers.map(d => d.correo));
            
            docenteRecords.forEach(record => {
                if (record.correo && !userEmails.has(record.correo)) {
                    allDocentes.push(record);
                } else if (!record.correo) {
                    allDocentes.push(record);
                }
            });

            const plansQuery = query(collection(db, "thesisPlans"));
            const unsubPlans = onSnapshot(plansQuery, (plansSnapshot) => {
                const allPlans = plansSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as ThesisPlan));
                setThesisPlans(allPlans);

                const docentesConConteos: DocenteConteo[] = allDocentes.map(docente => {
                    const counts = {
                        revisor: allPlans.filter(p => p.docenteRevisor1Id === docente.uid || p.docenteRevisor2Id === docente.uid).length,
                        asesor: allPlans.filter(p => p.asesorId === docente.uid).length,
                        supRevisor: allPlans.filter(p => p.supervisorRevisoresId === docente.uid).length,
                        supAsesor: allPlans.filter(p => p.supervisorAsesoresId === docente.uid).length,
                    };
                    return { ...docente, assignmentCounts: counts };
                });
                
                docentesConConteos.sort((a, b) => {
                    const nameA = `${a.apellidos} ${a.nombre}`.toLowerCase();
                    const nameB = `${b.apellidos} ${b.nombre}`.toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                setDocentes(docentesConConteos);
                setLoading(false);
            });

            return () => unsubPlans();
        });

        return () => unsubRecords();
    });

    return () => unsubUsers();
  }, []);

  const filteredDocentes = useMemo(() => {
    if (!searchTerm) {
      return docentes;
    }
    return docentes.filter(docente =>
      `${docente.nombre} ${docente.apellidos}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [docentes, searchTerm]);

  const openEditDialog = (docente: DocenteConteo) => {
    setEditingDocente(docente);
    setIsFormDialogOpen(true);
  };
  
  const openNewRecordDialog = () => {
    setEditingDocente(null);
    setIsRecordDialogOpen(true);
  };

  const openCreateAccessDialog = (docente: DocenteConteo) => {
    const isSupervisor = (docente.responsabilidades || []).includes('docente_supervisor_revisores') || (docente.responsabilidades || []).includes('docente_supervisor_asesores');
    const isAdmin = appUser?.roles.includes('admin') || appUser?.roles.includes('decano');

    if (!isSupervisor && isAdmin) {
      toast({
        variant: "destructive",
        title: "Rol Requerido",
        description: "Solo se puede crear acceso a docentes con rol de Supervisor de Revisores o Supervisor de Asesores.",
      });
      return;
    }
    setEditingDocente(docente);
    setIsAccessDialogOpen(true);
  };

  const openTransferDialog = (docente: DocenteConteo) => {
    setTransferDocente(docente);
    setIsTransferDialogOpen(true);
  };
  
  const handleDeleteDocente = async (docenteToDelete: DocenteConteo) => {
    const collectionName = docenteToDelete.isSystemUser ? "users" : "docentes";
    try {
        await deleteDoc(doc(db, collectionName, docenteToDelete.id));
        toast({
            title: "Docente Eliminado",
            description: "El registro del docente ha sido eliminado correctamente.",
        });
    } catch (error) {
        console.error("Error eliminando docente:", error);
        toast({
            variant: "destructive",
            title: "Error al Eliminar",
            description: "No se pudo eliminar el registro del docente.",
        });
    }
  };
  
  const isAdminOrDecano = appUser?.roles.includes('admin') || appUser?.roles.includes('decano');


  return (
    <>
      <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5"/>
                    Gestión de Docentes
                  </CardTitle>
                  <CardDescription>Gestione las responsabilidades de los docentes o añada nuevos registros.</CardDescription>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className="relative flex-1 md:grow-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Buscar docente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                  />
                </div>
                <Button onClick={openNewRecordDialog}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Añadir Docente
                </Button>
              </div>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <DocentesTable 
                    docentes={filteredDocentes} 
                    onEdit={openEditDialog} 
                    onDelete={handleDeleteDocente}
                    onCreateAccess={openCreateAccessDialog}
                    onTransfer={openTransferDialog}
                    canCreateAccess={isAdminOrDecano || false}
                />
            )}
          </CardContent>
      </Card>
      
      <DocenteFormDialog
        isOpen={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        editingDocente={editingDocente}
      />
      
      <DocenteRecordFormDialog
        isOpen={isRecordDialogOpen}
        onOpenChange={setIsRecordDialogOpen}
        allDocentes={docentes}
      />

      <DocenteAccessFormDialog
        isOpen={isAccessDialogOpen}
        onOpenChange={setIsAccessDialogOpen}
        docente={editingDocente}
      />
      
      {transferDocente && (
        <DocenteTransferDialog
          isOpen={isTransferDialogOpen}
          onOpenChange={setIsTransferDialogOpen}
          docenteOrigen={transferDocente}
          allDocentes={docentes}
          allPlans={thesisPlans}
        />
      )}
    </>
  );
}



"use client";

import { useEffect, useState, useMemo } from "react";
import { onSnapshot, collection, query, Unsubscribe, where, or, and } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoaderCircle, ScanEye, Users, FileCheck, Activity } from "lucide-react";
import { ThesisPlan, User, Docente } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { addYears, differenceInCalendarDays, getYear } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewStageDashboard } from "@/components/dashboard/review-stage-dashboard";
import { AdvisoryStageDashboard } from "@/components/dashboard/advisory-stage-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnitinStageDashboard } from "@/components/dashboard/turnitin-stage-dashboard";
import ProductivityPageContent from "@/components/dashboard/productivity-content";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [allPlans, setAllPlans] = useState<ThesisPlan[]>([]);
  const [docentes, setDocentes] = useState<(User | Docente)[]>([]);
  const { appUser } = useAuth();

  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    if (!appUser) return;
    setLoading(true);

    const usersQuery = query(
      collection(db, "users"),
      where("roles", "array-contains", "docente")
    );
    const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
      const docenteUsers = usersSnapshot.docs.map(
        (doc) => ({ ...doc.data(), uid: doc.id } as User)
      );

      const recordsQuery = collection(db, "docentes");
      const unsubRecords = onSnapshot(recordsQuery, (recordsSnapshot) => {
        const docenteRecords = recordsSnapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as Docente)
        );

        const combinedDocentes: (User | Docente)[] = [...docenteUsers];
        const userEmails = new Set(docenteUsers.map((d) => d.correo));

        docenteRecords.forEach((record) => {
          if (record.correo && !userEmails.has(record.correo)) {
            combinedDocentes.push(record);
          } else if (!record.correo) {
             combinedDocentes.push(record);
          }
        });
        setDocentes(combinedDocentes);
        
        // --- Main Data Fetching Logic ---
        const isAdminOrDecano = appUser.roles.includes('admin') || appUser.roles.includes('decano');
        let plansQuery;
    
        if (isAdminOrDecano) {
            plansQuery = query(collection(db, "thesisPlans"));
        } else {
            const clauses = [];
            if (appUser.roles.includes('docente_supervisor_revisores')) {
                clauses.push(where("supervisorRevisoresId", "==", appUser.uid));
            }
            if (appUser.roles.includes('docente_supervisor_asesores')) {
                clauses.push(where("supervisorAsesoresId", "==", appUser.uid));
            }
            if (appUser.roles.includes('docente_supervisor_turnitin')) {
                clauses.push(where("listoParaTurnitin", "==", true));
            }
    
            if (clauses.length === 0) {
                setAllPlans([]);
                setLoading(false);
                return;
            }
            plansQuery = query(collection(db, "thesisPlans"), or(...clauses));
        }
    
        const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
          let allPlansData = snapshot.docs.map(doc => {
              const plan = doc.data() as ThesisPlan;
  
              // Review days logic
              let diasRestantesRevision = 0;
              if (plan.estadoGlobal === "LISTO PARA ASESOR") {
                  const fechaAprobado1 = plan.revisor1?.fechaAprobado ? new Date(plan.revisor1.fechaAprobado) : null;
                  const fechaAprobado2 = plan.revisor2?.fechaAprobado ? new Date(plan.revisor2.fechaAprobado) : null;
                  let fechaAprobacionFinal = fechaAprobado1 && fechaAprobado2 ? (fechaAprobado1 > fechaAprobado2 ? fechaAprobado1 : fechaAprobado2) : (fechaAprobado1 || fechaAprobado2);
                  if (fechaAprobacionFinal && plan.vencimientoRevision) {
                      diasRestantesRevision = Math.floor((new Date(plan.vencimientoRevision).getTime() - fechaAprobacionFinal.getTime()) / (1000 * 3600 * 24));
                  }
              } else if (plan.vencimientoRevision) {
                  diasRestantesRevision = Math.floor((new Date(plan.vencimientoRevision).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 3600 * 24));
              }
  
              // Advisory days logic
              const fechaAsignacion = new Date(plan.submissionDate);
              const vencimientoOriginal = addYears(fechaAsignacion, 1);
              const fechaVencimientoFinal = (plan.ampliacion?.activa && plan.ampliacion?.fechaNuevoVencimiento) 
                  ? new Date(plan.ampliacion.fechaNuevoVencimiento) 
                  : vencimientoOriginal;
              
              let diasRestantesAsesoria;
              if (plan.estadoGlobal === 'CULMINADO' && plan.fechaAprobacionAsesoria) {
                diasRestantesAsesoria = differenceInCalendarDays(fechaVencimientoFinal, new Date(plan.fechaAprobacionAsesoria));
              } else {
                diasRestantesAsesoria = differenceInCalendarDays(fechaVencimientoFinal, new Date());
              }
  
              return { ...plan, id: doc.id, diasRestantesRevision, diasRestantesAsesoria } as ThesisPlan;
          });
          
          setAllPlans(allPlansData);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching thesis plans: ", error);
          setLoading(false);
        });

        return () => unsubscribePlans();
      });

      return () => unsubRecords();
    });

    return () => unsubUsers();
  }, [appUser]);

  const userRoles = appUser?.roles || [];
  const isAdminOrDecano = userRoles.includes("admin") || userRoles.includes("decano");
  const canSeeReview = isAdminOrDecano || userRoles.includes("docente_supervisor_revisores");
  const canSeeAdvisory = isAdminOrDecano || userRoles.includes("docente_supervisor_asesores");
  const canSeeTurnitin = isAdminOrDecano || userRoles.includes("docente_supervisor_turnitin");
  const canSeeProductivity = isAdminOrDecano;
  
  const { reviewPlans, advisoryPlans, turnitinPlans } = useMemo(() => {
    // For supervisors, filter down to the plans they are specifically assigned to supervise.
    const plansForUser = isAdminOrDecano 
        ? allPlans 
        : allPlans.filter(p => 
            (canSeeReview && p.supervisorRevisoresId === appUser?.uid) ||
            (canSeeAdvisory && p.supervisorAsesoresId === appUser?.uid) ||
            (canSeeTurnitin && p.listoParaTurnitin === true)
        );

    const review = plansForUser.filter(p => 
        !p.asesorId && 
        ["EN REVISION", "LISTO PARA ASESOR", "ARCHIVADO", "DESAPROBADO"].includes(p.estadoGlobal)
    );
      
    const advisory = plansForUser.filter(p => 
        !!p.asesorId && 
        ["EN ASESORIA", "CULMINADO", "VENCIDO", "ARCHIVADO", "DESAPROBADO"].includes(p.estadoGlobal)
    );

    const turnitin = plansForUser.filter(p => p.listoParaTurnitin === true);

    return {
        reviewPlans: review,
        advisoryPlans: advisory,
        turnitinPlans: turnitin,
    }
  }, [allPlans, canSeeReview, canSeeAdvisory, canSeeTurnitin, isAdminOrDecano, appUser]);


  const years = useMemo(() => {
    const allYears = allPlans.map(p => p.submissionDate ? getYear(new Date(p.submissionDate)) : new Date().getFullYear());
    return Array.from(new Set(allYears)).sort((a, b) => b - a);
  }, [allPlans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const views = [];
  if (canSeeReview) views.push('review');
  if (canSeeAdvisory) views.push('advisory');
  if (canSeeTurnitin) views.push('turnitin');
  if (canSeeProductivity) views.push('productivity');
  
  const defaultTab = isAdminOrDecano ? 'review' : (views.length > 0 ? views[0] : '');

  if (views.length > 1) {
    return (
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          {views.includes('review') && (
            <TabsTrigger value="review">
              <ScanEye className="mr-2 h-4 w-4" />
              Planes de Tesis
            </TabsTrigger>
          )}
          {views.includes('advisory') && (
            <TabsTrigger value="advisory">
              <Users className="mr-2 h-4 w-4" />
              Etapa de Asesoría
            </TabsTrigger>
          )}
          {views.includes('turnitin') && (
            <TabsTrigger value="turnitin">
              <FileCheck className="mr-2 h-4 w-4" />
              Etapa de Turnitin
            </TabsTrigger>
          )}
          {views.includes('productivity') && (
            <TabsTrigger value="productivity">
              <Activity className="mr-2 h-4 w-4" />
              Productividad Docente
            </TabsTrigger>
          )}
        </TabsList>
        
        {views.includes('review') && (
            <TabsContent value="review">
              <ReviewStageDashboard plans={reviewPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />
            </TabsContent>
        )}
        {views.includes('advisory') && (
            <TabsContent value="advisory">
              <AdvisoryStageDashboard plans={advisoryPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />
            </TabsContent>
        )}
        {views.includes('turnitin') && (
            <TabsContent value="turnitin">
              <TurnitinStageDashboard plans={turnitinPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />
            </TabsContent>
        )}
        {views.includes('productivity') && (
          <TabsContent value="productivity">
            <ProductivityPageContent />
          </TabsContent>
        )}
      </Tabs>
    );
  }

  if (views.length === 1) {
    if(views[0] === 'review') return <ReviewStageDashboard plans={reviewPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />;
    if(views[0] === 'advisory') return <AdvisoryStageDashboard plans={advisoryPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />;
    if(views[0] === 'turnitin') return <TurnitinStageDashboard plans={turnitinPlans} docentes={docentes} selectedYear={selectedYear} onYearChange={setSelectedYear} years={years} />;
    if(views[0] === 'productivity') return <ProductivityPageContent />;
  }
  
  // Fallback for roles without a specific dashboard view (e.g., 'alumno')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bienvenido</CardTitle>
        <CardDescription>
          Actualmente no hay un panel de control disponible para su rol.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Su rol actual no tiene asignado un panel de control específico. Si cree que esto es un error, por favor contacte al administrador del sistema.</p>
      </CardContent>
    </Card>
  );
}

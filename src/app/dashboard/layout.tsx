
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserNav } from '@/components/user-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { BookOpenCheck, LoaderCircle, Menu } from 'lucide-react';
import { DashboardNav } from '@/components/dashboard-nav';
import { useAuth } from '@/hooks/use-auth';
import { doc, onSnapshot, collection, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notifications } from '@/components/notifications';
import { ThesisPlan } from '@/lib/types';
import { addYears, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SessionManager } from '@/components/session-manager';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { loading, appUser, user } = useAuth();
    const router = useRouter();
    const [logoUrl, setLogoUrl] = useState("/unfv-logo.png");
    const [appTitle, setAppTitle] = useState("Gestion de Tesis de Grados y Titulos -FA");
    const [allPlans, setAllPlans] = useState<ThesisPlan[]>([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    useEffect(() => {
        const configRef = doc(db, "appConfig", "main");
        const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.appLogoUrl) {
                    setLogoUrl(data.appLogoUrl);
                }
                if (data.appTitle) {
                    setAppTitle(data.appTitle);
                }
            } else {
                setLogoUrl("/unfv-logo.png");
                setAppTitle("Gestion de Tesis de Grados y Titulos -FA");
            }
        });
        
        const plansQuery = query(collection(db, "thesisPlans"));
        const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
            const plansData = snapshot.docs.map(doc => {
                const plan = doc.data() as ThesisPlan;

                // Logic for Review days
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

                // Logic for Advisory days
                const fechaAsignacion = new Date(plan.submissionDate);
                const vencimientoOriginal = addYears(fechaAsignacion, 1);
                const fechaVencimientoFinal = (plan.ampliacion?.activa && plan.ampliacion?.fechaNuevoVencimiento) 
                    ? new Date(plan.ampliacion.fechaNuevoVencimiento) 
                    : vencimientoOriginal;
                const diasRestantesAsesoria = differenceInCalendarDays(fechaVencimientoFinal, new Date());

                return {
                    ...plan,
                    diasRestantesRevision,
                    diasRestantesAsesoria
                } as ThesisPlan;
            });
            setAllPlans(plansData);
        });

        return () => {
            unsubscribeConfig();
            unsubscribePlans();
        }
    }, []);
    
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    if (loading || !appUser || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
      <SessionManager>
        <div className="flex min-h-screen w-full flex-col">
          <header className="sticky top-0 flex h-20 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
             <a href="/dashboard" className="flex items-center gap-4 mr-auto">
              <div className="relative w-48 h-16">
                <Image src={logoUrl} alt="App Logo" fill className="object-contain" />
              </div>
               <div className="font-semibold text-xl hidden lg:block">{appTitle}</div>
            </a>
            <div className="hidden md:flex items-center gap-4 md:ml-auto md:gap-2 lg:gap-4 justify-end">
               <DashboardNav userRoles={appUser?.roles} />
              <div className='flex items-center gap-2'>
                <ThemeToggle />
                <Notifications allPlans={allPlans} currentUser={appUser} />
                <UserNav user={user} appUser={appUser} />
              </div>
            </div>
             <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 md:hidden"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Menú de Navegación</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col">
                    <SheetHeader>
                        <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                    </SheetHeader>
                    <DashboardNav userRoles={appUser?.roles} isMobile={true} />
                    <div className='mt-auto flex items-center gap-2'>
                        <ThemeToggle />
                        <Notifications allPlans={allPlans} currentUser={appUser} />
                        <UserNav user={user} appUser={appUser} />
                    </div>
                </SheetContent>
            </Sheet>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            {children}
          </main>
          <footer className="py-4">
            <p className="text-center text-xs text-muted-foreground">© RCE</p>
          </footer>
        </div>
      </SessionManager>
    );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
  );
}

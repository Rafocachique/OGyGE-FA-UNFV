

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ThesisPlan, AppUser } from "@/lib/types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { Badge } from "./ui/badge";

interface Notification {
  id: string;
  studentName: string;
  type: "Revisión" | "Asesoría";
  message: string;
  link: string;
}

export function Notifications({
  allPlans,
  currentUser,
}: {
  allPlans: ThesisPlan[];
  currentUser: AppUser;
}) {
  const notifications = useMemo(() => {
    if (!currentUser) return [];

    const isAdminOrDecano = currentUser.roles.includes("admin") || currentUser.roles.includes("decano");
    
    let relevantPlans = allPlans;
    if (!isAdminOrDecano) {
      relevantPlans = allPlans.filter(plan => 
        plan.supervisorRevisoresId === currentUser.uid || 
        plan.supervisorAsesoresId === currentUser.uid ||
        plan.asesorId === currentUser.uid
      );
    }

    const generatedNotifications: Notification[] = [];

    relevantPlans.forEach((plan) => {
      // Review Priority
      if (plan.estadoGlobal === "EN REVISION" && plan.diasRestantesRevision !== undefined && plan.diasRestantesRevision <= 9) {
        if (isAdminOrDecano || plan.supervisorRevisoresId === currentUser.uid) {
            generatedNotifications.push({
                id: `${plan.id}-review`,
                studentName: plan.estudiante.apellidosNombres,
                type: "Revisión",
                message: `La revisión vence en ${plan.diasRestantesRevision} días.`,
                link: `/dashboard/thesis-review?tab=in-review&expand=${plan.id}`,
            });
        }
      }

      // Advisory Priority
      if (plan.estadoGlobal === "EN ASESORIA" && plan.diasRestantesAsesoria !== undefined && plan.diasRestantesAsesoria <= 7) {
        if (isAdminOrDecano || plan.supervisorAsesoresId === currentUser.uid || plan.asesorId === currentUser.uid) {
            generatedNotifications.push({
                id: `${plan.id}-advisory`,
                studentName: plan.estudiante.apellidosNombres,
                type: "Asesoría",
                message: `La asesoría vence en ${plan.diasRestantesAsesoria} días.`,
                link: `/dashboard/advisories?tab=en-asesoria&expand=${plan.id}`,
            });
        }
      }
    });

    return generatedNotifications;
  }, [allPlans, currentUser]);

  const hasNotifications = notifications.length > 0;
  const isAdminOrDecano = currentUser?.roles.includes("admin") || currentUser?.roles.includes("decano");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {hasNotifications && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500" />
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones de Prioridad</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasNotifications ? (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} asChild>
              <Link href={notification.link} className="flex flex-col items-start gap-1 cursor-pointer">
                <div className="flex justify-between w-full">
                    <p className="font-semibold">{notification.studentName}</p>
                    {isAdminOrDecano && <Badge variant="secondary">{notification.type}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{notification.message}</p>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No hay notificaciones de prioridad.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

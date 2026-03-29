
"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, User } from "lucide-react"
import Link from "next/link"
import { getAuth, signOut } from "firebase/auth";
import { app } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { User as FirebaseUser } from 'firebase/auth';
import type { User as AppUser, UserRole } from '@/lib/types';
import { Badge } from "./ui/badge"

interface UserNavProps {
  user: FirebaseUser | null;
  appUser: AppUser | null;
}

const roleDisplayNames: Record<UserRole, string> = {
  admin: "Admin",
  decano: "Decano",
  alumno: "Alumno",
  docente: "Docente",
  docente_revisor: "Revisor",
  docente_asesor: "Asesor",
  docente_supervisor_revisores: "Sup. Revisores",
  docente_supervisor_asesores: "Sup. Asesores",
  docente_supervisor_turnitin: "Sup. Turnitin",
  jurado: "Jurado"
}

export function UserNav({ user, appUser }: UserNavProps) {
  const auth = getAuth(app);
  const router = useRouter();

  const handleSignOut = () => {
    signOut(auth).then(() => {
      router.push('/login');
    });
  };

  const getInitials = (name: string, lastName: string) => {
    if (name && lastName) {
        return `${name[0]}${lastName[0]}`.toUpperCase();
    }
    if (name) {
        return name.substring(0, 2).toUpperCase();
    }
    return '..';
  }
  
  const displayName = appUser && (appUser.nombre || appUser.apellidos) 
    ? `${appUser.nombre} ${appUser.apellidos}`.trim() 
    : user?.email || 'Usuario';
  
  // Filter roles to display. We don't need to show "docente" if they have specific responsibilities.
  const rolesToDisplay = appUser?.roles.filter(role => {
      if (role === 'docente' && appUser.roles.some(r => r.startsWith('docente_'))) {
          return false;
      }
      return true;
  }) || [];


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            {/* The AvatarImage can be added back if profile pictures are implemented */}
            {/* <AvatarImage src="https://picsum.photos/seed/user/40/40" alt={displayName} data-ai-hint="person portrait" /> */}
            <AvatarFallback>{getInitials(appUser?.nombre || '', appUser?.apellidos || '')}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {appUser?.correo}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
                {rolesToDisplay.map(role => (
                     <Badge key={role} variant="secondary" className="capitalize">
                        {roleDisplayNames[role] || role}
                     </Badge>
                ))}
                {rolesToDisplay.length === 0 && (
                    <Badge variant="outline">Sin Rol Asignado</Badge>
                )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="flex items-center w-full">
              <Settings className="mr-2 h-4 w-4" />
              <span>Ajustes</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}



'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { ChevronDown } from 'lucide-react';
import { Button } from './ui/button';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard de Reportes', roles: ['admin', 'decano', 'docente', 'docente_revisor', 'docente_asesor', 'docente_supervisor_revisores', 'docente_supervisor_asesores', 'alumno', 'jurado', 'docente_supervisor_turnitin'] },
  { href: '/dashboard/thesis-review', label: 'Planes de Tesis', group: 'Gestión de Tesis', roles: ['admin', 'decano', 'docente_supervisor_revisores'] },
  { href: '/dashboard/advisories', label: 'Asesorías', group: 'Gestión de Tesis', roles: ['admin', 'decano', 'docente_supervisor_asesores'] },
  { href: '/dashboard/turnitin-review', label: 'Revisión Turnitin', group: 'Gestión de Tesis', roles: ['admin', 'decano', 'docente_supervisor_turnitin'] },
  { href: '/dashboard/user-management', label: 'Usuarios', group: 'Registro y Asignación', roles: ['admin'] },
  { href: '/dashboard/teachers', label: 'Docentes', group: 'Registro y Asignación', roles: ['admin'] },
  { href: '/dashboard/student-registration', label: 'Alumnos', group: 'Registro y Asignación', roles: ['admin', 'docente_supervisor_revisores', 'docente_supervisor_asesores'] },
  { href: '/dashboard/student-turnitin-registration', label: 'Alumnos Turnitin', group: 'Registro y Asignación', roles: ['admin'] },
  { href: '/dashboard/assignment', label: 'Asignaciones', group: 'Registro y Asignación', roles: ['admin', 'docente_supervisor_revisores', 'docente_supervisor_asesores'] },
];

const navGroups = ["Gestión de Tesis", "Registro y Asignación"];

export function DashboardNav({ userRoles = [], isMobile = false }: { userRoles?: UserRole[], isMobile?: boolean }) {
  const pathname = usePathname();

  const hasAccess = (linkRoles: UserRole[]) => {
    if (!linkRoles || linkRoles.length === 0) return true;
    return userRoles.some(userRole => linkRoles.includes(userRole));
  };
  
  const getVisibleLinksForGroup = (group: string) => {
    return navLinks.filter(link => link.group === group && hasAccess(link.roles as UserRole[]));
  }

  const getVisibleStandaloneLinks = () => {
    return navLinks.filter(link => !link.group && hasAccess(link.roles as UserRole[]));
  }

  if (isMobile) {
    return (
        <nav className="grid gap-2 text-lg font-medium pt-6">
             {getVisibleStandaloneLinks().map(link => (
                <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                        "transition-colors text-muted-foreground hover:text-foreground py-2",
                        pathname === link.href && "text-foreground font-semibold"
                    )}
                >
                    {link.label}
                </Link>
            ))}
            <Accordion type="multiple" className="w-full">
                {navGroups.map(group => {
                    const visibleLinks = getVisibleLinksForGroup(group);
                    if (visibleLinks.length === 0) return null;
                    
                    return (
                        <AccordionItem value={group} key={group}>
                            <AccordionTrigger className="text-base font-semibold">{group}</AccordionTrigger>
                            <AccordionContent>
                                <div className="flex flex-col gap-2 pl-4">
                                {visibleLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={cn(
                                            "transition-colors text-muted-foreground hover:text-foreground py-2",
                                            pathname === link.href && "text-foreground"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </nav>
    )
  }

  return (
    <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
        {getVisibleStandaloneLinks().map(link => (
             <Link
                key={link.href}
                href={link.href}
                className={cn(
                    "transition-colors text-muted-foreground hover:text-foreground",
                    pathname === link.href && "text-foreground font-semibold"
                )}
            >
                {link.label}
            </Link>
        ))}

      {navGroups.map(group => {
        const visibleLinks = getVisibleLinksForGroup(group);
        
        if (visibleLinks.length === 0) {
            return null;
        }

        if (visibleLinks.length === 1) {
            const link = visibleLinks[0];
            return (
                <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                        "transition-colors text-muted-foreground hover:text-foreground",
                        pathname === link.href && "text-foreground font-semibold"
                    )}
                >
                    {link.label}
                </Link>
            )
        }

        return (
          <DropdownMenu key={group}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-0 h-auto hover:bg-transparent">
                    {group}
                    <ChevronDown className='h-4 w-4'/>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
            {visibleLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                    <Link
                    href={link.href}
                    className={cn(
                        "transition-colors cursor-pointer w-full",
                        pathname === link.href ? "text-foreground font-semibold" : ""
                    )}
                    >
                    {link.label}
                    </Link>
                </DropdownMenuItem>
            ))}
            </DropdownMenuContent>
        </DropdownMenu>
        )
      })}
    </nav>
  );
}

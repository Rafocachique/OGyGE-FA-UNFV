

"use client";

import { useState, useEffect } from "react";
import { onSnapshot, collection, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, UserAction, Docente, DocenteResponsabilidad } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Calendar as CalendarIcon, Users, Clock, Pointer } from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays, format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 text-sm bg-background border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          {payload.map((pld: any, index: number) => (
            <div key={index} style={{ color: pld.fill }}>
              {pld.name === 'activeMinutes' ? 'Minutos Activos' : pld.name}: {pld.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
};

export default function ProductivityPageContent() {
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [actions, setActions] = useState<UserAction[]>([]);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });

    useEffect(() => {
        const supervisorRoles: DocenteResponsabilidad[] = [
            'docente_supervisor_revisores', 
            'docente_supervisor_asesores', 
            'docente_supervisor_turnitin'
        ];
    
        const usersQuery = query(collection(db, "users"), where("roles", "array-contains-any", supervisorRoles));
        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const unsubDocentes = onSnapshot(collection(db, "docentes"), (docentesSnapshot) => {
                const supervisorMap = new Map<string, User>();
    
                usersSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    supervisorMap.set(doc.id, { 
                        uid: doc.id, 
                        nombre: data.nombre,
                        apellidos: data.apellidos,
                        correo: data.correo,
                        roles: data.roles || [],
                        ...data,
                    } as User);
                });
    
                docentesSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const responsabilidades = data.responsabilidades || [];
                    const isSupervisor = responsabilidades.some((r: DocenteResponsabilidad) => supervisorRoles.includes(r));
                    
                    if (isSupervisor && !supervisorMap.has(doc.id)) {
                        supervisorMap.set(doc.id, { 
                            uid: doc.id, 
                            nombre: data.nombre,
                            apellidos: data.apellidos,
                            correo: data.correo,
                            roles: responsabilidades,
                            ...data,
                        } as User);
                    }
                });
                
                setSupervisors(Array.from(supervisorMap.values()));
            });
            return () => unsubDocentes();
        });
    
        return () => unsubUsers();
    }, []);

    useEffect(() => {
        if (!date?.from || !date.to) return;
    
        const q = query(
          collection(db, "userActions"),
          where("timestamp", ">=", startOfDay(date.from)),
          where("timestamp", "<=", endOfDay(date.to))
        );
    
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const actionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserAction));
          setActions(actionsData);
        });
    
        return () => unsubscribe();
      }, [date]);

    const productivityData = supervisors.map(supervisor => {
        const supervisorActions = actions.filter(action => action.userId === supervisor.uid);
        
        const dailyProductivity: { [key: string]: { activeMinutes: number, keyActions: number } } = {};
        supervisorActions.forEach(action => {
            const day = format(action.timestamp.toDate(), 'yyyy-MM-dd');
            if (!dailyProductivity[day]) {
                dailyProductivity[day] = { activeMinutes: 0, keyActions: 0 };
            }
            if (action.type === 'active_heartbeat') {
                dailyProductivity[day].activeMinutes += 1;
            } else if (action.type === 'key_action') {
                dailyProductivity[day].keyActions += 1;
            }
        });

        const totalActiveMinutes = supervisorActions.filter(a => a.type === 'active_heartbeat').length;
        const totalKeyActions = supervisorActions.filter(a => a.type === 'key_action').length;
        
        const lastLogin = supervisor.lastLogin ? format(supervisor.lastLogin.toDate(), 'Pp', { locale: es }) : 'Nunca';
        
        const userKeyActions = actions
            .filter(a => a.userId === supervisor.uid && a.type === 'key_action')
            .sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());

        const lastAction = userKeyActions.length > 0 ? format(userKeyActions[0].timestamp.toDate(), 'Pp', { locale: es }) : 'Ninguna';

        return {
            name: `${supervisor.nombre} ${supervisor.apellidos}`,
            uid: supervisor.uid,
            totalActiveMinutes,
            totalKeyActions,
            lastLogin,
            lastAction,
        };
    }).sort((a,b) => b.totalActiveMinutes - a.totalActiveMinutes);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-6 w-6" />
                                Dashboard de Productividad Docente
                            </CardTitle>
                            <CardDescription>
                                Monitorice la actividad y el rendimiento de los docentes supervisores en el sistema.
                            </CardDescription>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-[300px] justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                date.to ? (
                                    <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y")
                                )
                                ) : (
                                <span>Seleccionar fecha</span>
                                )}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                                locale={es}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Supervisores Activos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productivityData.filter(d => d.totalActiveMinutes > 0).length}</div>
                        <p className="text-xs text-muted-foreground">Docentes con actividad en el período.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tiempo Activo Total</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productivityData.reduce((acc, curr) => acc + curr.totalActiveMinutes, 0)} min</div>
                        <p className="text-xs text-muted-foreground">Suma de minutos activos de todos los supervisores.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Acciones Clave Totales</CardTitle>
                        <Pointer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{productivityData.reduce((acc, curr) => acc + curr.totalKeyActions, 0)}</div>
                        <p className="text-xs text-muted-foreground">Total de acciones de valor registradas.</p>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tiempo Activo por Supervisor (minutos)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={productivityData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="totalActiveMinutes" name="Minutos Activos" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Acciones Clave por Supervisor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                             <BarChart data={productivityData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="totalKeyActions" name="Acciones Clave" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Resumen de Actividad de Supervisores</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Ítem</TableHead>
                                <TableHead>Supervisor</TableHead>
                                <TableHead>Último Inicio de Sesión</TableHead>
                                <TableHead>Última Acción Registrada</TableHead>
                                <TableHead>Minutos Activos</TableHead>
                                <TableHead>Acciones Clave</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productivityData.map((data, index) => (
                                <TableRow key={data.uid}>
                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                    <TableCell>{data.name}</TableCell>
                                    <TableCell>{data.lastLogin}</TableCell>
                                    <TableCell>{data.lastAction}</TableCell>
                                    <TableCell>{data.totalActiveMinutes}</TableCell>
                                    <TableCell>{data.totalKeyActions}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    )
}



"use client";

import { ThesisPlan, ThesisStatus, Docente, User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, AlertTriangle, BookCheck, Archive, FileX, Printer } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar, LabelList } from 'recharts';
import { addYears, differenceInDays, format, getMonth, getYear } from "date-fns";
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import "jspdf-autotable";
import html2canvas from 'html2canvas';
import { Button } from "../ui/button";
import { useAuth } from "@/hooks/use-auth";
import { MultiSelectFilter } from "../multi-select-filter";

interface AdvisoryStageDashboardProps {
    plans: ThesisPlan[];
    docentes: (User | Docente)[];
    selectedYear: string;
    onYearChange: (year: string) => void;
    years: number[];
}

const statusStyles: Record<ThesisStatus, string> = {
  "EN REVISION": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  "LISTO PARA ASESOR": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
  "EN ASESORIA": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  "DESAPROBADO": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  "CULMINADO": "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  "VENCIDO": "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  "ARCHIVADO": "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300",
};

const STATUS_COLORS: { [key: string]: string } = {
    "En Proceso": "#FBBF24", // amber-400
    "Aprobados": "#4ADE80", // green-400
    "Archivados": "#A3A3A3", // neutral-400
    "Total Asignado": "#818CF8", // indigo-400
    completed: '#4ADE80', 
    inAdvisory: '#6366F1', 
    archived: '#A3A3A3',
    total: '#A5B4FC',
};


const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 text-sm bg-background border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          {payload.map((pld: any, index: number) => (
            <div key={index} style={{ color: pld.fill }}>
              {pld.name}: {pld.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
};

const getTicks = (data: any[], keys: string[]) => {
    if (!data || data.length === 0) return [0, 1, 2, 3, 4, 5]; // Default ticks
    const max = Math.max(0, ...data.map(d => Math.max(...keys.map(key => d[key] || 0))));
    return Array.from({ length: Math.max(5, max + 1) }, (_, i) => i);
};


export function AdvisoryStageDashboard({ plans, docentes, selectedYear, onYearChange, years }: AdvisoryStageDashboardProps) {
    const kpisRef = useRef(null);
    const supervisorTableRef = useRef(null);
    const advisorTableRef = useRef(null);
    const chart1Ref = useRef(null);
    const chart2Ref = useRef(null);
    const chart3Ref = useRef(null);
    const chart4Ref = useRef(null);

    const { appUser } = useAuth();
    const isAdminOrDecano = appUser?.roles.includes('admin') || appUser?.roles.includes('decano');

    const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([new Date().getFullYear().toString()]);
    const [selectedAdvisor, setSelectedAdvisor] = useState<string>("all");
    const [selectedMonthlyAdvisor, setSelectedMonthlyAdvisor] = useState<string>("all");

    const supervisors = useMemo(() => {
      const supervisorIds = new Set<string>();
      plans.forEach(plan => {
          if (plan.supervisorAsesoresId) supervisorIds.add(plan.supervisorAsesoresId);
      });
      return Array.from(supervisorIds).map(id => docentes.find(d => d.uid === id)).filter((d): d is User | Docente => !!d);
    }, [plans, docentes]);

    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            const assignmentDate = new Date(p.submissionDate);
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(getYear(assignmentDate).toString());
            const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(getMonth(assignmentDate).toString());
            const matchesSupervisor = selectedSupervisors.length === 0 || (p.supervisorAsesoresId && selectedSupervisors.includes(p.supervisorAsesoresId));
            return matchesYear && matchesMonth && matchesSupervisor;
        });
    }, [plans, selectedYears, selectedMonths, selectedSupervisors]);


    const handleExport = async () => {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 10;
        let y = margin;
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Dashboard de Asesoría de Tesis", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 10;
    
        // 1. KPIs
        if (kpisRef.current) {
            const canvas = await html2canvas(kpisRef.current, { scale: 2, useCORS: true, backgroundColor: null });
            const imgWidth = doc.internal.pageSize.getWidth() - margin * 2;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, imgWidth, imgHeight);
            y += imgHeight + 5;
        }
    
        // 2. Supervisor Table
        const supervisorTableHead = [["Supervisor", "Total", "En Proceso", "Aprobados", "Archivados"]];
        const supervisorTableBody = supervisorWorkload.map(item => [
            item.name,
            item["Total Asignado"],
            item["En Proceso"],
            item["Aprobados"],
            item.Archivados,
        ]);
        (doc as any).autoTable({
            head: supervisorTableHead,
            body: supervisorTableBody,
            startY: y,
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                fontSize: 8,
                lineColor: [0, 0, 0], 
                lineWidth: 0.1
            },
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0], 
                lineWidth: 0.1
            },
            didDrawPage: (data: any) => { y = data.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // 3. Advisor Table
        const advisorTableHead = [["Asesor", "Total Asignado", "En Proceso", "Aprobados", "Archivados"]];
        const advisorTableBody = advisorWorkload.map(item => [
            item.name,
            item["Total Asignado"],
            item["En Proceso"],
            item.Aprobados,
            item.Archivados,
        ]);
        if (y + 20 > doc.internal.pageSize.getHeight()) { // Check space for header
            doc.addPage();
            y = margin;
        }
        (doc as any).autoTable({
            head: advisorTableHead,
            body: advisorTableBody,
            startY: y,
            theme: 'grid',
             headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                fontSize: 8,
                lineColor: [0, 0, 0], 
                lineWidth: 0.1
            },
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0], 
                lineWidth: 0.1,
            },
            didDrawPage: (data: any) => { y = data.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    
        // 4. Charts
        const charts = [chart1Ref, chart2Ref, chart3Ref, chart4Ref];
        for (const chartRef of charts) {
            if (chartRef.current) {
                const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true, backgroundColor: null });
                const imgWidth = doc.internal.pageSize.getWidth() - margin * 2;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                if (y + imgHeight > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, imgWidth, imgHeight);
                y += imgHeight + 5;
            }
        }
    
        doc.save('dashboard-asesoria.pdf');
    };
    
    const stats = useMemo(() => {
        return {
            totalInStage: filteredPlans.length,
            inAdvisory: filteredPlans.filter(p => p.estadoGlobal === 'EN ASESORIA').length,
            expiring: filteredPlans.filter(p => p.estadoGlobal === 'EN ASESORIA' && (p.diasRestantesAsesoria ?? 0) <= 30).length,
            completed: filteredPlans.filter(p => p.estadoGlobal === 'CULMINADO').length,
            archived: filteredPlans.filter(p => p.estadoGlobal === 'ARCHIVADO').length,
        }
    }, [filteredPlans]);

    const distributionData = useMemo(() => [
        { name: "En Asesoría", value: stats.inAdvisory, color: STATUS_COLORS.inAdvisory },
        { name: "Culminados", value: stats.completed, color: STATUS_COLORS.completed },
        { name: "Archivados", value: stats.archived, color: STATUS_COLORS.archived },
    ], [stats]);

    const supervisorWorkload = useMemo(() => {
        const supervisors: { [key: string]: { name: string, "Total Asignado": number, "En Proceso": number, "Aprobados": number, "Archivados": number } } = {};
        
        filteredPlans.forEach(plan => {
            const supervisorId = plan.supervisorAsesoresId;
            // For a non-admin, only process their own data.
            if (!isAdminOrDecano && supervisorId !== appUser?.uid) {
                return;
            }
            const supervisorDocente = docentes.find(d => d.uid === supervisorId);
            const supervisorName = supervisorDocente ? `${supervisorDocente.nombre} ${supervisorDocente.apellidos}`.trim() : "Sin Supervisor";

            if (!supervisors[supervisorName]) {
                supervisors[supervisorName] = { name: supervisorName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Archivados": 0 };
            }
            supervisors[supervisorName]["Total Asignado"]++;
            if (plan.estadoGlobal === 'EN ASESORIA') {
                supervisors[supervisorName]["En Proceso"]++;
            }
            if (plan.estadoGlobal === 'CULMINADO') {
                supervisors[supervisorName]["Aprobados"]++;
            }
            if (plan.estadoGlobal === 'ARCHIVADO') {
                supervisors[supervisorName]["Archivados"]++;
            }
        });

        return Object.values(supervisors);
    }, [filteredPlans, docentes, isAdminOrDecano, appUser]);
    
     const advisors = useMemo(() => {
        const advisorIds = new Set<string>();
        filteredPlans.forEach(plan => {
            if (plan.asesorId) advisorIds.add(plan.asesorId);
        });
        return Array.from(advisorIds).map(id => docentes.find(d => d.uid === id)).filter((d): d is User | Docente => !!d);
    }, [filteredPlans, docentes]);

    const advisorWorkload = useMemo(() => {
        const advisorsData: { [key: string]: { name: string; "Total Asignado": number; "En Proceso": number; "Aprobados": number; "Archivados": number; } } = {};
    
        const plansToProcess = selectedAdvisor === 'all'
            ? filteredPlans
            : filteredPlans.filter(p => p.asesorId === selectedAdvisor);
        
        plansToProcess.forEach(plan => {
            const advisorId = plan.asesorId;
            const advisorDocente = docentes.find(d => d.uid === advisorId);
            const advisorName = advisorDocente ? `${advisorDocente.nombre.split(' ')[0]} ${advisorDocente.apellidos.split(' ')[0]}`.trim() : "Sin Asesor";
    
            if (!advisorsData[advisorName]) {
                advisorsData[advisorName] = { name: advisorName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Archivados": 0 };
            }
            advisorsData[advisorName]["Total Asignado"]++;
            
            if (plan.estadoGlobal === 'EN ASESORIA') {
                advisorsData[advisorName]["En Proceso"]++;
            } else if (plan.estadoGlobal === 'CULMINADO') {
                advisorsData[advisorName]["Aprobados"]++;
            } else if (plan.estadoGlobal === 'ARCHIVADO') {
                advisorsData[advisorName]["Archivados"]++;
            }
        });
    
        return Object.values(advisorsData);
    }, [filteredPlans, docentes, selectedAdvisor]);
    
    const monthlyAdvisorBreakdown = useMemo(() => {
        const advisorsData: { [key: string]: { name: string, "Total Asignado": number, "En Proceso": number, "Aprobados": number, "Archivados": number } } = {};
        
        const plansToProcess = selectedMonthlyAdvisor === 'all'
            ? filteredPlans
            : filteredPlans.filter(p => p.asesorId === selectedMonthlyAdvisor);

        plansToProcess.forEach(plan => {
            const assignmentDate = plan.submissionDate ? new Date(plan.submissionDate) : null;
            if (!assignmentDate || (selectedYears.length > 0 && !selectedYears.includes(getYear(assignmentDate).toString())) || (selectedMonths.length > 0 && !selectedMonths.includes(getMonth(assignmentDate).toString()))) {
              return;
            }

            const advisorId = plan.asesorId;
            const advisorDocente = docentes.find(d => d.uid === advisorId);
            const advisorName = advisorDocente ? `${advisorDocente.nombre.split(' ')[0]} ${advisorDocente.apellidos.split(' ')[0]}`.trim() : "Sin Asesor";

            if (!advisorsData[advisorName]) {
                advisorsData[advisorName] = { name: advisorName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Archivados": 0 };
            }
            advisorsData[advisorName]["Total Asignado"]++;
            if (plan.estadoGlobal === 'EN ASESORIA') {
                advisorsData[advisorName]["En Proceso"]++;
            }
             else if (plan.estadoGlobal === 'CULMINADO') {
                advisorsData[advisorName]["Aprobados"]++;
            }
             else if (plan.estadoGlobal === 'ARCHIVADO') {
                advisorsData[advisorName]["Archivados"]++;
            }
        });

        return Object.values(advisorsData);
    }, [filteredPlans, docentes, selectedYears, selectedMonths, selectedMonthlyAdvisor]);

    const monthsOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), 'MMMM', { locale: es }),
    }));

    const yearsOptions = years.map(y => ({ value: y.toString(), label: y.toString() }));

    const supervisorOptions = supervisors.map(s => ({
        value: s.uid,
        label: `${s.nombre} ${s.apellidos}`
    }));

    const calculateChartHeight = (dataLength: number) => {
        const minHeight = 250;
        const heightPerItem = 40;
        const calculatedHeight = dataLength * heightPerItem + 100; // Add some base height for legend, margins etc.
        return Math.max(minHeight, calculatedHeight);
    };

    const advisorChartHeight = calculateChartHeight(advisorWorkload.length);
    const monthlyChartHeight = calculateChartHeight(monthlyAdvisorBreakdown.length);
    const finalChartHeight = Math.max(advisorChartHeight, monthlyChartHeight);

    const advisorWorkloadTicks = getTicks(advisorWorkload, ["Total Asignado", "En Proceso", "Aprobados", "Archivados"]);
    const monthlyAdvisorBreakdownTicks = getTicks(monthlyAdvisorBreakdown, ["Total Asignado", "En Proceso", "Aprobados", "Archivados"]);
    const supervisorWorkloadTicks = getTicks(supervisorWorkload, ["Total Asignado", "En Proceso", "Aprobados", "Archivados"]);

    return (
        <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
             <CardHeader className="px-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Etapa de Asesoría</CardTitle>
                    <CardDescription>
                        Supervise el proceso de asesoría de los planes de tesis.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {isAdminOrDecano && (
                      <MultiSelectFilter
                          title="Supervisores"
                          options={supervisorOptions}
                          selectedValues={selectedSupervisors}
                          onSelectedChange={setSelectedSupervisors}
                      />
                    )}
                    <MultiSelectFilter
                        title="Meses"
                        options={monthsOptions}
                        selectedValues={selectedMonths}
                        onSelectedChange={setSelectedMonths}
                    />
                    <MultiSelectFilter
                        title="Años"
                        options={yearsOptions}
                        selectedValues={selectedYears}
                        onSelectedChange={setSelectedYears}
                    />
                    <Button onClick={handleExport}>
                        <Printer className="mr-2 h-4 w-4" />
                        Exportar Dashboard
                    </Button>
                </div>
            </CardHeader>
             <div ref={kpisRef}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tesis en Asesoría</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalInStage}</div>
                            <p className="text-xs text-muted-foreground">Total de planes en esta etapa.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Asesorías por Vencer</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{stats.expiring}</div>
                            <p className="text-xs text-muted-foreground">Tesis con 30 días o menos para su culminación.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tesis Culminadas</CardTitle>
                            <BookCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.completed}</div>
                            <p className="text-xs text-muted-foreground">Total de tesis que han completado la asesoría.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tesis Archivadas</CardTitle>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.archived}</div>
                            <p className="text-xs text-muted-foreground">Tesis vencidas o abandonadas en esta etapa.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            <div ref={supervisorTableRef}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Carga por Supervisor de Asesores</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supervisor</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                    <TableHead className="text-center">En Proceso</TableHead>
                                    <TableHead className="text-center">Aprobados</TableHead>
                                    <TableHead className="text-center">Archiv.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {supervisorWorkload.map(item => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-center">{item["Total Asignado"]}</TableCell>
                                        <TableCell className="text-center">{item["En Proceso"]}</TableCell>
                                        <TableCell className="text-center">{item.Aprobados}</TableCell>
                                        <TableCell className="text-center">{item.Archivados}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <div ref={advisorTableRef}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Carga por Asesor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asesor</TableHead>
                                    <TableHead className="text-center">Total Asignado</TableHead>
                                    <TableHead className="text-center">En Proceso</TableHead>
                                    <TableHead className="text-center">Aprobados</TableHead>
                                    <TableHead className="text-center">Archivados</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {advisorWorkload.map(item => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-center">{item["Total Asignado"]}</TableCell>
                                        <TableCell className="text-center">{item["En Proceso"]}</TableCell>
                                        <TableCell className="text-center">{item.Aprobados}</TableCell>
                                        <TableCell className="text-center">{item.Archivados}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                 <Card ref={chart1Ref}>
                    <CardHeader>
                        <CardTitle>Distribución de Estados</CardTitle>
                        <CardDescription className="text-xs">Vista general de las tesis en la etapa de asesoría.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart>
                                <Tooltip content={<CustomTooltip />} />
                                <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={100} outerRadius={140} paddingAngle={5}>
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card ref={chart2Ref}>
                    <CardHeader>
                        <CardTitle>Carga de Trabajo por Supervisor</CardTitle>
                        <CardDescription>Planes asignados vs. en proceso por cada supervisor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={supervisorWorkload} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} ticks={supervisorWorkloadTicks} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 <Card ref={chart3Ref}>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Carga de Trabajo por Asesor</CardTitle>
                                <CardDescription>Total de tesis asignadas vs. en proceso para cada asesor.</CardDescription>
                            </div>
                            <MultiSelectFilter
                                title="Asesores"
                                options={advisors.map(a => ({ value: a.uid, label: `${a.nombre} ${a.apellidos}` }))}
                                selectedValues={selectedAdvisor === 'all' ? [] : [selectedAdvisor]}
                                onSelectedChange={(values) => setSelectedAdvisor(values.length > 0 ? values[0] : 'all')}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={finalChartHeight}>
                            <BarChart data={advisorWorkload} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} interval={0} />
                                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} ticks={advisorWorkloadTicks} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px", paddingTop: '20px'}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} barSize={15} />
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} barSize={15} />
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} barSize={15} />
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card ref={chart4Ref}>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Rendimiento Mensual por Asesor</CardTitle>
                                <CardDescription>Desglose de la carga de trabajo de los asesores para el período seleccionado.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <MultiSelectFilter
                                    title="Asesores"
                                    options={advisors.map(a => ({ value: a.uid, label: `${a.nombre} ${a.apellidos}` }))}
                                    selectedValues={selectedMonthlyAdvisor === 'all' ? [] : [selectedMonthlyAdvisor]}
                                    onSelectedChange={(values) => setSelectedMonthlyAdvisor(values.length > 0 ? values[0] : 'all')}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={finalChartHeight}>
                            <BarChart data={monthlyAdvisorBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} interval={0} />
                                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} ticks={monthlyAdvisorBreakdownTicks}/>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px", paddingTop: '20px'}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} barSize={10} />
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} barSize={10} />
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} barSize={10} />
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

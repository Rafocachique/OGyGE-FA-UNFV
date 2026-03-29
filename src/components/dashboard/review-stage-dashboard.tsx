

"use client";

import { ThesisPlan, ThesisStatus, Docente, User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScanEye, FileClock, BookCheck, Archive, FileX, Search, Printer, Users } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Progress } from "../ui/progress";
import { Input } from "../ui/input";
import { format, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from 'jspdf';
import "jspdf-autotable";
import html2canvas from 'html2canvas';
import { Button } from "../ui/button";
import { useAuth } from "@/hooks/use-auth";
import { MultiSelectFilter } from "../multi-select-filter";

interface ReviewStageDashboardProps {
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
    "Total Asignado": "#3b82f6", // blue-500
    "En Proceso": "#f59e0b", // amber-500
    "Aprobados": "#22c55e", // green-500
    "Desaprobados": "#ef4444", // red-500
    "Archivados": "#a3a3a3", // neutral-400
    "En Revisión": "#6366f1", // indigo-500
    "Listos p/ Asesor": "#14b8a6", // teal-500
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


export function ReviewStageDashboard({ plans, docentes, selectedYear, onYearChange, years }: ReviewStageDashboardProps) {
    const kpisRef = useRef(null);
    const supervisorTableRef = useRef(null);
    const reviewerTableRef = useRef(null);
    const chart1Ref = useRef(null);
    const chart2Ref = useRef(null);
    const chart3Ref = useRef(null);
    const chart4Ref = useRef(null);

    const [searchTerm, setSearchTerm] = useState("");
    
    const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([new Date().getFullYear().toString()]);
    const [selectedReviewer, setSelectedReviewer] = useState<string>("all");
    const [selectedMonthlyReviewer, setSelectedMonthlyReviewer] = useState<string>("all");
    
    const { appUser } = useAuth();
    const isAdminOrDecano = appUser?.roles.includes('admin') || appUser?.roles.includes('decano');


    const handleExport = async () => {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 10;
        let y = margin;
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Dashboard de Revisión de Planes de Tesis", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
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
        const supervisorTableHead = [["Supervisor", "Total", "En Proceso", "Aprobados", "Desaprobados", "Archivados"]];
        const supervisorTableBody = supervisorWorkload.map(item => [
            item.name,
            item["Total Asignado"],
            item["En Proceso"],
            item["Aprobados"],
            item.Desaprobados,
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
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            bodyStyles: { halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, },
            didDrawPage: (data: any) => { y = data.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // 3. Reviewer Table
        const reviewerTableHead = [["Revisor", "Total Asignado", "En Proceso", "Aprobados", "Desaprobados", "Archivados"]];
        const reviewerTableBody = reviewerWorkload.map(item => [
            item.name,
            item["Total Asignado"],
            item["En Proceso"],
            item["Aprobados"],
            item.Desaprobados,
            item.Archivados,
        ]);
        if (y + 20 > doc.internal.pageSize.getHeight()) { // Check if space is enough for header
            doc.addPage();
            y = margin;
        }
        (doc as any).autoTable({
            head: reviewerTableHead,
            body: reviewerTableBody,
            startY: y,
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            bodyStyles: { halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1, },
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
    
        doc.save('dashboard-revision.pdf');
    };

    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            if (!p.supervisorRevisoresId) {
                return false;
            }
            const assignmentDate = new Date(p.submissionDate);
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(getYear(assignmentDate).toString());
            const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(getMonth(assignmentDate).toString());
            const matchesSupervisor = selectedSupervisors.length === 0 || (p.supervisorRevisoresId && selectedSupervisors.includes(p.supervisorRevisoresId));
            return matchesYear && matchesMonth && matchesSupervisor;
        });
    }, [plans, selectedYears, selectedMonths, selectedSupervisors]);

    const stats = useMemo(() => {
        return {
            inReview: filteredPlans.filter(p => p.estadoGlobal === 'EN REVISION').length,
            expiring: filteredPlans.filter(p => p.estadoGlobal === 'EN REVISION' && (p.diasRestantesRevision ?? 0) <= 7).length,
            readyForAdvisory: filteredPlans.filter(p => p.estadoGlobal === 'LISTO PARA ASESOR').length,
            archived: filteredPlans.filter(p => p.estadoGlobal === 'ARCHIVADO').length,
            disapproved: filteredPlans.filter(p => p.estadoGlobal === 'DESAPROBADO').length
        }
    }, [filteredPlans]);

    const supervisors = useMemo(() => {
        const supervisorIds = new Set<string>();
        plans.forEach(plan => {
            if (plan.supervisorRevisoresId) supervisorIds.add(plan.supervisorRevisoresId);
        });
        return Array.from(supervisorIds).map(id => docentes.find(d => d.uid === id)).filter((d): d is User | Docente => !!d);
    }, [plans, docentes]);
    
    const reviewers = useMemo(() => {
        const reviewerIds = new Set<string>();
        plans.forEach(plan => {
            if (plan.docenteRevisor1Id) reviewerIds.add(plan.docenteRevisor1Id);
            if (plan.docenteRevisor2Id) reviewerIds.add(plan.docenteRevisor2Id);
        });
        return Array.from(reviewerIds).map(id => docentes.find(d => d.uid === id)).filter((d): d is User | Docente => !!d);
    }, [plans, docentes]);

    const distributionData = useMemo(() => [
        { name: "En Revisión", value: stats.inReview },
        { name: "Listos p/ Asesor", value: stats.readyForAdvisory },
        { name: "Archivados", value: stats.archived },
        { name: "Desaprobados", value: stats.disapproved },
    ], [stats]);

    const supervisorWorkload = useMemo(() => {
        const supervisors: { [key: string]: { name: string; "Total Asignado": number; "En Proceso": number; "Aprobados": number; Desaprobados: number; Archivados: number } } = {};
        
        // Filter out plans without a supervisor before processing
        const plansWithSupervisors = filteredPlans.filter(plan => plan.supervisorRevisoresId);

        plansWithSupervisors.forEach(plan => {
            const supervisorId = plan.supervisorRevisoresId;
            const supervisorDocente = docentes.find(d => d.uid === supervisorId);
            // This check is now safer because we filtered above
            const supervisorName = supervisorDocente ? `${supervisorDocente.nombre} ${supervisorDocente.apellidos}`.trim() : "Desconocido";

            if (!supervisors[supervisorName]) {
                supervisors[supervisorName] = { name: supervisorName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Desaprobados": 0, "Archivados": 0 };
            }

            supervisors[supervisorName]["Total Asignado"]++;

            if (plan.estadoGlobal === 'EN REVISION') {
                supervisors[supervisorName]["En Proceso"]++;
            } else if (plan.estadoGlobal === 'LISTO PARA ASESOR') {
                supervisors[supervisorName]["Aprobados"]++;
            } else if (plan.estadoGlobal === 'DESAPROBADO') {
                supervisors[supervisorName]["Desaprobados"]++;
            } else if (plan.estadoGlobal === 'ARCHIVADO') {
                supervisors[supervisorName]["Archivados"]++;
            }
        });

        // If not admin, only show the current user's workload
        if (!isAdminOrDecano) {
            const currentUserName = appUser ? `${appUser.nombre} ${appUser.apellidos}`.trim() : "Desconocido";
            return Object.values(supervisors).filter(s => s.name === currentUserName);
        }

        return Object.values(supervisors);
    }, [filteredPlans, docentes, isAdminOrDecano, appUser]);

    const reviewerWorkload = useMemo(() => {
        const reviewersData: { [key: string]: { name: string, "Total Asignado": number, "En Proceso": number, "Aprobados": number, "Desaprobados": number, "Archivados": number } } = {};
    
        const plansToProcess = filteredPlans.filter(p => 
            selectedReviewer === 'all' || p.docenteRevisor1Id === selectedReviewer || p.docenteRevisor2Id === selectedReviewer
        );
    
        const processReviewer = (revisorId: string | undefined, plan: ThesisPlan) => {
            if (!revisorId) return;
            
            const docente = docentes.find(d => d.uid === revisorId);
            if (!docente) return;
            
            if (selectedReviewer !== 'all' && revisorId !== selectedReviewer) {
                return;
            }
    
            const reviewerName = `${docente.nombre.split(' ')[0]} ${docente.apellidos.split(' ')[0]}`.trim();
            if (!reviewersData[reviewerName]) {
                reviewersData[reviewerName] = { name: reviewerName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Desaprobados": 0, "Archivados": 0 };
            }
    
            reviewersData[reviewerName]["Total Asignado"]++;
    
            if (plan.estadoGlobal === 'EN REVISION') {
                reviewersData[reviewerName]["En Proceso"]++;
            } else if (plan.estadoGlobal === 'LISTO PARA ASESOR') {
                reviewersData[reviewerName]["Aprobados"]++;
            } else if (plan.estadoGlobal === 'DESAPROBADO') {
                reviewersData[reviewerName]["Desaprobados"]++;
            } else if (plan.estadoGlobal === 'ARCHIVADO') {
                reviewersData[reviewerName]["Archivados"]++;
            }
        };
        
        plansToProcess.forEach(plan => {
            processReviewer(plan.docenteRevisor1Id, plan);
            processReviewer(plan.docenteRevisor2Id, plan);
        });
    
        return Object.values(reviewersData);
    }, [filteredPlans, docentes, selectedReviewer]);
    
    const monthlyReviewerBreakdown = useMemo(() => {
        const reviewersData: { [key: string]: { name: string, "Total Asignado": number, "En Proceso": number, "Aprobados": number, "Desaprobados": number, "Archivados": number } } = {};
        
        const plansToProcess = filteredPlans.filter(p => 
            selectedMonthlyReviewer === 'all' || p.docenteRevisor1Id === selectedMonthlyReviewer || p.docenteRevisor2Id === selectedMonthlyReviewer
        );

        const processPlanForReviewer = (plan: ThesisPlan, revisorId: string | undefined) => {
            if (!revisorId) return;
            const docente = docentes.find(d => d.uid === revisorId);
            if (!docente) return;

             if (selectedMonthlyReviewer !== 'all' && revisorId !== selectedMonthlyReviewer) {
                return;
            }

            const assignmentDate = plan.submissionDate ? new Date(plan.submissionDate) : null;
            if (!assignmentDate || (selectedYears.length > 0 && !selectedYears.includes(getYear(assignmentDate).toString())) || (selectedMonths.length > 0 && !selectedMonths.includes(getMonth(assignmentDate).toString()))) {
                return;
            }


            const reviewerName = `${docente.nombre.split(' ')[0]} ${docente.apellidos.split(' ')[0]}`.trim();
            if (!reviewersData[reviewerName]) {
                reviewersData[reviewerName] = { name: reviewerName, "Total Asignado": 0, "En Proceso": 0, "Aprobados": 0, "Desaprobados": 0, "Archivados": 0 };
            }

            reviewersData[reviewerName]["Total Asignado"]++;

            if (plan.estadoGlobal === 'EN REVISION') {
                reviewersData[reviewerName]["En Proceso"]++;
            } else if (plan.estadoGlobal === 'LISTO PARA ASESOR') {
                reviewersData[reviewerName]["Aprobados"]++;
            } else if (plan.estadoGlobal === 'DESAPROBADO') {
                reviewersData[reviewerName]["Desaprobados"]++;
            } else if (plan.estadoGlobal === 'ARCHIVADO') {
                reviewersData[reviewerName]["Archivados"]++;
            }
        };

        plansToProcess.forEach(plan => {
            processPlanForReviewer(plan, plan.docenteRevisor1Id);
            processPlanForReviewer(plan, plan.docenteRevisor2Id);
        });

        return Object.values(reviewersData);
    }, [filteredPlans, docentes, selectedYears, selectedMonths, selectedMonthlyReviewer]);

    const monthsOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), 'MMMM', { locale: es }),
    }));
    
    const yearsOptions = years.map(y => ({ value: y.toString(), label: y.toString() }));

    const supervisorOptions = supervisors.map(s => ({
        value: s.uid,
        label: `${s.nombre} ${s.apellidos}`
    }));


    const calculateProgress = (plan: ThesisPlan) => {
        if (plan.estadoGlobal === 'LISTO PARA ASESOR') return 100;
        const totalDays = 30;
        const elapsedDays = totalDays - (plan.diasRestantesRevision ?? 0);
        const progress = (elapsedDays / totalDays) * 100;
        return Math.max(0, Math.min(100, progress));
    };

    const supervisorWorkloadTicks = getTicks(supervisorWorkload, ["Total Asignado", "En Proceso", "Aprobados", "Desaprobados", "Archivados"]);
    const reviewerWorkloadTicks = getTicks(reviewerWorkload, ["Total Asignado", "En Proceso", "Aprobados", "Desaprobados", "Archivados"]);
    const monthlyReviewerBreakdownTicks = getTicks(monthlyReviewerBreakdown, ["Total Asignado", "En Proceso", "Aprobados", "Desaprobados", "Archivados"]);
    
    const calculateChartHeight = (dataLength: number) => {
        const minHeight = 250;
        const heightPerItem = 40;
        const calculatedHeight = dataLength * heightPerItem + 100; // Add some base height for legend, margins etc.
        return Math.max(minHeight, calculatedHeight);
    };

    const reviewerChartHeight = calculateChartHeight(reviewerWorkload.length);
    const monthlyChartHeight = calculateChartHeight(monthlyReviewerBreakdown.length);
    const finalChartHeight = Math.max(reviewerChartHeight, monthlyChartHeight);


    return (
        <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
             <CardHeader className="px-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                 <div>
                    <CardTitle>Planes de Tesis</CardTitle>
                    <CardDescription>
                        Supervise el proceso de revisión de los planes de tesis asignados a su cargo.
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes de Tesis en Revisión</CardTitle>
                            <ScanEye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.inReview}</div>
                            <p className="text-xs text-muted-foreground">Esperando feedback de los revisores.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes de Tesis por Vencer</CardTitle>
                            <FileClock className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{stats.expiring}</div>
                            <p className="text-xs text-muted-foreground">Planes de tesis con 7 días o menos.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes de Tesis Aprobados</CardTitle>
                            <BookCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.readyForAdvisory}</div>
                            <p className="text-xs text-muted-foreground">Listos para pasar a asesoría.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes de Tesis Desaprobados</CardTitle>
                            <FileX className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.disapproved}</div>
                            <p className="text-xs text-muted-foreground">Rechazados por revisores.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes de Tesis Archivados</CardTitle>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.archived}</div>
                            <p className="text-xs text-muted-foreground">Vencidos o abandonados.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            <div ref={supervisorTableRef}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Carga por Supervisor de Revisores</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Supervisor</TableHead>
                                    <TableHead className="text-center">Total</TableHead>
                                    <TableHead className="text-center">En Proceso</TableHead>
                                    <TableHead className="text-center">Aprobados</TableHead>
                                    <TableHead className="text-center">Desaprob.</TableHead>
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
                                        <TableCell className="text-center">{item.Desaprobados}</TableCell>
                                        <TableCell className="text-center">{item.Archivados}</TableCell>
                                    </TableRow>
                                ))}
                                {supervisorWorkload.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">No hay datos para la selección actual.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <div ref={reviewerTableRef}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Carga por Revisor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Revisor</TableHead>
                                    <TableHead className="text-center">Total Asignado</TableHead>
                                    <TableHead className="text-center">En Proceso</TableHead>
                                    <TableHead className="text-center">Aprobados</TableHead>
                                    <TableHead className="text-center">Desaprobados</TableHead>
                                    <TableHead className="text-center">Archivados</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reviewerWorkload.map(item => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-center">{item["Total Asignado"]}</TableCell>
                                        <TableCell className="text-center">{item["En Proceso"]}</TableCell>
                                        <TableCell className="text-center">{item.Aprobados}</TableCell>
                                        <TableCell className="text-center">{item.Desaprobados}</TableCell>
                                        <TableCell className="text-center">{item.Archivados}</TableCell>
                                    </TableRow>
                                ))}
                                {reviewerWorkload.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">No hay datos para la selección actual.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Card ref={chart1Ref}>
                    <CardHeader>
                        <CardTitle>Distribución de Estados de Planes de Tesis</CardTitle>
                        <CardDescription className="text-xs">Vista general de los planes de tesis en esta etapa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={distributionData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{fontSize: 12}} />
                                <XAxis type="number" hide />
                                <Tooltip cursor={{fill: 'rgba(200, 200, 200, 0.2)'}} content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Planes" barSize={20} radius={[0, 4, 4, 0]}>
                                    {distributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.replace(/\s/g, ' ')] || '#8884d8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card ref={chart2Ref}>
                    <CardHeader>
                        <CardTitle>Carga de Trabajo por Supervisor de Planes de Tesis</CardTitle>
                        <CardDescription>Comparativa de estados por cada supervisor de revisión.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={supervisorWorkload} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} ticks={supervisorWorkloadTicks} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} barSize={20}/>
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} barSize={20}/>
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} barSize={20}/>
                                <Bar dataKey="Desaprobados" fill={STATUS_COLORS["Desaprobados"]} barSize={20}/>
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} barSize={20}/>
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
                                <CardTitle>Carga de Trabajo por Revisor de Planes de Tesis</CardTitle>
                                <CardDescription>Total de planes de tesis asignados vs. en proceso para cada revisor.</CardDescription>
                            </div>
                            <MultiSelectFilter
                                title="Revisores"
                                options={reviewers.map(r => ({ value: r.uid, label: `${r.nombre} ${r.apellidos}` }))}
                                selectedValues={selectedReviewer === 'all' ? [] : [selectedReviewer]}
                                onSelectedChange={(values) => setSelectedReviewer(values.length > 0 ? values[0] : 'all')}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={finalChartHeight}>
                            <BarChart data={reviewerWorkload} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} interval={0} />
                                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} ticks={reviewerWorkloadTicks} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px", paddingTop: '20px'}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} barSize={15}/>
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} barSize={15}/>
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} barSize={15}/>
                                <Bar dataKey="Desaprobados" fill={STATUS_COLORS["Desaprobados"]} barSize={15}/>
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} barSize={15}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card ref={chart4Ref}>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Rendimiento Mensual por Revisor de Planes de Tesis</CardTitle>
                                <CardDescription>Desglose de la carga de trabajo de los revisores para el período seleccionado.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <MultiSelectFilter
                                    title="Revisores"
                                    options={reviewers.map(r => ({ value: r.uid, label: `${r.nombre} ${r.apellidos}` }))}
                                    selectedValues={selectedMonthlyReviewer === 'all' ? [] : [selectedMonthlyReviewer]}
                                    onSelectedChange={(values) => setSelectedMonthlyReviewer(values.length > 0 ? values[0] : 'all')}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={finalChartHeight}>
                            <BarChart data={monthlyReviewerBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} interval={0} />
                                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} ticks={monthlyReviewerBreakdownTicks}/>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "12px", paddingTop: '20px'}}/>
                                <Bar dataKey="Total Asignado" fill={STATUS_COLORS["Total Asignado"]} barSize={10}/>
                                <Bar dataKey="En Proceso" fill={STATUS_COLORS["En Proceso"]} barSize={10}/>
                                <Bar dataKey="Aprobados" fill={STATUS_COLORS["Aprobados"]} barSize={10}/>
                                <Bar dataKey="Desaprobados" fill={STATUS_COLORS["Desaprobados"]} barSize={10}/>
                                <Bar dataKey="Archivados" fill={STATUS_COLORS["Archivados"]} barSize={10}/>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

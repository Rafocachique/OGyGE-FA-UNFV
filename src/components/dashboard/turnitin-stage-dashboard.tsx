

"use client";

import { ThesisPlan, ThesisStatus, Docente, User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileCheck, FileClock, CheckCircle, XCircle, Users, Percent, Printer } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import jsPDF from 'jspdf';
import "jspdf-autotable";
import html2canvas from 'html2canvas';
import { Button } from "../ui/button";
import { format, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { MultiSelectFilter } from "../multi-select-filter";

interface TurnitinStageDashboardProps {
    plans: ThesisPlan[];
    docentes: (User | Docente)[];
    selectedYear: string;
    onYearChange: (year: string) => void;
    years: number[];
}

const COLORS = {
    approved: '#4ADE80', // green-400
    disapproved: '#F87171', // red-400
    "Aprobados": '#4ADE80',
    "Desaprobados": '#F87171',
    "Total Asignado": '#818CF8', // indigo-400
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


export function TurnitinStageDashboard({ plans, docentes, selectedYear, onYearChange, years }: TurnitinStageDashboardProps) {
    const kpisRef = useRef(null);
    const supervisorTableRef = useRef(null);
    const chart2Ref = useRef(null);

    const { appUser } = useAuth();
    const isAdminOrDecano = appUser?.roles.includes('admin') || appUser?.roles.includes('decano');

    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([new Date().getFullYear().toString()]);

    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            const assignmentDate = new Date(p.submissionDate);
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(getYear(assignmentDate).toString());
            const matchesMonth = selectedMonths.length === 0 || selectedMonths.includes(getMonth(assignmentDate).toString());
            return matchesYear && matchesMonth;
        });
    }, [plans, selectedYears, selectedMonths]);


    const handleExport = async () => {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 10;
        let y = margin;
    
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Dashboard de Revisión de Turnitin", doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
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
        const supervisorTableHead = [["Estadísticas Totales", "Total Asignado", "Aprobados", "Desaprobados"]];
        const supervisorTableBody = supervisorWorkload.map(item => [
            item.name,
            item["Total Asignado"],
            item.Aprobados,
            item.Desaprobados,
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
            bodyStyles: { 
                halign: 'center', 
                lineColor: [0, 0, 0], 
                lineWidth: 0.1,
                fontSize: 7,
                cellPadding: 1.5,
                valign: 'middle'
            },
            didDrawPage: (data: any) => { y = data.cursor.y; }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    
        // 3. Charts
        const charts = [chart2Ref];
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
    
        doc.save('dashboard-turnitin.pdf');
    };
    
    const stats = useMemo(() => {
        const result = {
            total: filteredPlans.length,
            Aprobados: 0,
            Desaprobados: 0,
        };

        filteredPlans.forEach(plan => {
            const isApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';
            const isFinallyDisapproved = plan.turnitin2?.estado === 'DESAPROBADO';

            if (isApproved) {
                result.Aprobados++;
            } else if (isFinallyDisapproved) {
                result.Desaprobados++;
            }
        });
        
        const turnitin1Percentages = filteredPlans.map(p => p.turnitin1?.porcentaje).filter((p): p is number => p !== null && p !== undefined);
        const turnitin2Percentages = filteredPlans.map(p => p.turnitin2?.porcentaje).filter((p): p is number => p !== null && p !== undefined);

        const avg1 = turnitin1Percentages.length > 0 ? Math.round(turnitin1Percentages.reduce((a, b) => a + b, 0) / turnitin1Percentages.length) : 0;
        const avg2 = turnitin2Percentages.length > 0 ? Math.round(turnitin2Percentages.reduce((a, b) => a + b, 0) / turnitin2Percentages.length) : 0;

        return { 
            ...result,
            avgSimilarity1: avg1,
            avgSimilarity2: avg2
        };
    }, [filteredPlans]);

    const supervisorWorkload = useMemo(() => {
        const totals = { name: "Estadísticas Totales", "Total Asignado": 0, "Aprobados": 0, "Desaprobados": 0 };
    
        filteredPlans.forEach(plan => {
            totals["Total Asignado"]++;
    
            const isApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';
            const isFinallyDisapproved = plan.turnitin2?.estado === 'DESAPROBADO';

            if (isApproved) {
                totals.Aprobados++;
            } else if (isFinallyDisapproved) {
                totals.Desaprobados++;
            }
        });
        
        return [totals];
    }, [filteredPlans]);

    const totalWorkload = useMemo(() => {
        const total = { name: "Total", "Total Asignado": 0, "Aprobados": 0, "Desaprobados": 0 };
        filteredPlans.forEach(plan => {
            total["Total Asignado"]++;
            const isApproved = plan.turnitin1?.estado === 'APROBADO' || plan.turnitin2?.estado === 'APROBADO';
            const isFinallyDisapproved = plan.turnitin2?.estado === 'DESAPROBADO';
            if (isApproved) total.Aprobados++;
            else if (isFinallyDisapproved) total.Desaprobados++;
        });
        return [total];
    }, [filteredPlans]);

    const workloadData = supervisorWorkload;
    const workloadTicks = getTicks(workloadData, ["Total Asignado", "Aprobados", "Desaprobados"]);
    
    const monthsOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(2000, i, 1), 'MMMM', { locale: es }),
    }));

    const yearsOptions = years.map(y => ({ value: y.toString(), label: y.toString() }));


    return (
        <div className="grid gap-4 md:gap-8 lg:grid-cols-1">
             <CardHeader className="px-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Etapa de Turnitin</CardTitle>
                    <CardDescription>
                        Supervise el proceso de revisión de similitud de los planes de tesis.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
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
                            <CardTitle className="text-sm font-medium">Total en Etapa Turnitin</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground">Total de planes en esta fase.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes Aprobados</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-500">{stats.Aprobados}</div>
                            <p className="text-xs text-muted-foreground">Cumplen con el % de similitud.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planes Desaprobados</CardTitle>
                            <XCircle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{stats.Desaprobados}</div>
                            <p className="text-xs text-muted-foreground">No cumplen tras 2do análisis.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">% Similitud Promedio</CardTitle>
                            <Percent className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold">{`1er: ${stats.avgSimilarity1}% | 2do: ${stats.avgSimilarity2}%`}</div>
                            <p className="text-xs text-muted-foreground">Promedio de los análisis 1 y 2.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div ref={supervisorTableRef}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Carga de Trabajo en Turnitin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Estadísticas Totales</TableHead>
                                    <TableHead className="text-center">Total Asignado</TableHead>
                                    <TableHead className="text-center">Aprobados</TableHead>
                                    <TableHead className="text-center">Desaprobados</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {workloadData.map(item => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-center">{item["Total Asignado"]}</TableCell>
                                        <TableCell className="text-center">{item.Aprobados}</TableCell>
                                        <TableCell className="text-center">{item.Desaprobados}</TableCell>
                                    </TableRow>
                                ))}
                                {workloadData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No hay datos para este período.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
                 <Card ref={chart2Ref}>
                    <CardHeader>
                        <CardTitle>Carga de Trabajo de Turnitin</CardTitle>
                        <CardDescription>Desglose del estado de revisión de los planes de tesis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={workloadData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" allowDecimals={false} ticks={workloadTicks} />
                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: "12px" }} />
                                <Bar dataKey="Total Asignado" fill={COLORS["Total Asignado"]} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="Aprobados" fill={COLORS.Aprobados} radius={[0, 4, 4, 0]} />
                                <Bar dataKey="Desaprobados" fill={COLORS.Desaprobados} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

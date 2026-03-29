

"use client"

import { useState, useEffect } from "react"
import { onSnapshot, collection, query, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Line, LineChart, Cell } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThesisPlan } from "@/lib/types";
import { LoaderCircle } from "lucide-react";

const COLORS = {
    EN_REVISION: '#818CF8', // indigo-400
    LISTO_PARA_ASESOR: '#67E8F9', // cyan-300
    EN_ASESORIA: '#6366F1', // indigo-500
    CULMINADO: '#4ADE80', // green-400
    DESAPROBADO: '#F87171', // red-400
    VENCIDO: '#FBBF24', // amber-400
    ON_TIME: '#22C55E', // green-500
    DELAYED: '#FBBF24', // amber-400
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 text-sm bg-background border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          {payload.map((pld: any, index: number) => (
            <div key={index} style={{ color: pld.fill || pld.stroke }}>
              {pld.name}: {pld.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
};

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState<any[]>([]);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [totalCompletionRate, setTotalCompletionRate] = useState(0);

    useEffect(() => {
      setLoading(true);
      const q = query(collection(db, "thesisPlans"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const plans = snapshot.docs.map(doc => doc.data() as ThesisPlan);
        
        // Status stats
        const stats: { [key: string]: number } = {
            "EN REVISION": 0, "LISTO PARA ASESOR": 0, "EN ASESORIA": 0, "CULMINADO": 0, "DESAPROBADO": 0, "VENCIDO": 0
        };
        plans.forEach(plan => {
          stats[plan.estadoGlobal] = (stats[plan.estadoGlobal] || 0) + 1;
        });
        const statusChartData = Object.entries(stats).map(([name, value]) => ({ name, value }));
        setStatusData(statusChartData);

        // Monthly approvals
        const approvalsByMonth: { [key: string]: number } = {};
        plans.forEach(plan => {
            if (plan.estadoGlobal === 'CULMINADO' && plan.creadoEn) {
                const date = plan.creadoEn.toDate();
                const month = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
                approvalsByMonth[month] = (approvalsByMonth[month] || 0) + 1;
            }
        });
        const monthKeys = Object.keys(approvalsByMonth);
        const sortedMonths = monthKeys.sort((a,b) => {
          const [m1, y1] = a.split(' ');
          const [m2, y2] = b.split(' ');
          const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
          return new Date(parseInt(y1), months.indexOf(m1)) > new Date(parseInt(y2), months.indexOf(m2)) ? 1 : -1;
        });
        const monthlyChartData = sortedMonths.map(month => ({ month, Tesis: approvalsByMonth[month] }));
        setMonthlyData(monthlyChartData);

        // Completion Rate (dummy data for now as logic is complex)
        setTotalCompletionRate(78); // Replace with real calculation if possible
        
        setLoading(false);
      }, (error) => {
        console.error("Error fetching analytics data:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    }, []);

    const completionChartData = [
      { name: "A tiempo", value: totalCompletionRate, color: COLORS.ON_TIME },
      { name: "Retrasado", value: 100 - totalCompletionRate, color: COLORS.DELAYED },
    ]


    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
            <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
        </div>
      )
    }

  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>Tesis por Estado</CardTitle>
                <CardDescription>Distribución actual de todos los planes de tesis registrados.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statusData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <YAxis />
                        <Tooltip cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }} content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Planes" radius={[4, 4, 0, 0]}>
                           {statusData.map((entry, index) => {
                                const key = entry.name.replace(/ /g, '_') as keyof typeof COLORS;
                                return <Cell key={`cell-${index}`} fill={COLORS[key] || '#8884d8'} />;
                           })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="lg:col-span-3">
            <CardHeader>
                <CardTitle>Tasa de Finalización a Tiempo</CardTitle>
                <CardDescription>Porcentaje de tesis completadas dentro del plazo esperado.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0 flex justify-center">
                <ResponsiveContainer width="100%" height={250} className="max-w-[250px]">
                    <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie
                          data={completionChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          strokeWidth={2}
                        >
                          {completionChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                         <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={8} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}/>
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm pt-4">
                <div className="flex items-center gap-2 font-medium leading-none">
                Completado a tiempo: {totalCompletionRate}%
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                {100 - totalCompletionRate}% de tesis presentan retrasos.
                </div>
            </CardFooter>
        </Card>

        <Card className="lg:col-span-7">
            <CardHeader>
                <CardTitle>Tesis Aprobadas por Mes</CardTitle>
                <CardDescription>Tendencia mensual de los planes de tesis que han sido aprobados.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={monthlyData}
                        margin={{ left: 12, right: 12 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                         <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                            dataKey="Tesis"
                            type="monotone"
                            stroke={COLORS.CULMINADO}
                            strokeWidth={2}
                            dot={{ fill: COLORS.CULMINADO, r: 4 }}
                            activeDot={{ r: 6, strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    </div>
  )
}


"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocenteConteo } from "@/app/dashboard/teachers/page";
import { ThesisPlan } from "@/lib/types";
import { ScrollArea } from "./ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

interface DocenteTransferDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  docenteOrigen: DocenteConteo;
  allDocentes: DocenteConteo[];
  allPlans: ThesisPlan[];
}

const formSchema = z.object({
  assignments: z.record(z.string().optional()), // PlanId -> newSupervisorId
});
type FormData = z.infer<typeof formSchema>;

export function DocenteTransferDialog({
  isOpen,
  onOpenChange,
  docenteOrigen,
  allDocentes,
  allPlans,
}: DocenteTransferDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { assignments: {} },
  });

  const { supervisedReviewPlans, supervisedAdvisoryPlans, availableReviewSupervisors, availableAdvisorySupervisors } = useMemo(() => {
    const supervisedReviewPlans = allPlans.filter(p => p.supervisorRevisoresId === docenteOrigen.uid);
    const supervisedAdvisoryPlans = allPlans.filter(p => p.supervisorAsesoresId === docenteOrigen.uid);

    const availableReviewSupervisors = allDocentes.filter(d =>
      d.uid !== docenteOrigen.uid &&
      (d.responsabilidades || []).includes('docente_supervisor_revisores')
    );
    const availableAdvisorySupervisors = allDocentes.filter(d =>
      d.uid !== docenteOrigen.uid &&
      (d.responsabilidades || []).includes('docente_supervisor_asesores')
    );

    return {
      supervisedReviewPlans,
      supervisedAdvisoryPlans,
      availableReviewSupervisors,
      availableAdvisorySupervisors,
    };
  }, [docenteOrigen, allDocentes, allPlans]);
  
  const allPlansToTransfer = [...supervisedReviewPlans, ...supervisedAdvisoryPlans];

  useEffect(() => {
    if (isOpen) {
      form.reset({ assignments: {} });
    }
  }, [isOpen, form]);


  const assignments = form.watch('assignments');
  const atLeastOneAssigned = Object.values(assignments).some(val => !!val);


  const onSubmit = async (data: FormData) => {
    const assignedPlans = Object.entries(data.assignments).filter(([_, supervisorId]) => supervisorId);

    if (assignedPlans.length === 0) {
      toast({
        variant: "destructive",
        title: "No hay transferencias para realizar",
        description: "Debe asignar al menos un nuevo supervisor a un plan de tesis.",
      });
      return;
    }
    
    setLoading(true);
    const batch = writeBatch(db);

    try {
      for (const [planId, newSupervisorId] of assignedPlans) {
        if (newSupervisorId) {
            const planRef = doc(db, "thesisPlans", planId);
            const isReviewPlan = supervisedReviewPlans.some(p => p.id === planId);
            const fieldToUpdate = isReviewPlan ? "supervisorRevisoresId" : "supervisorAsesoresId";
            batch.update(planRef, { [fieldToUpdate]: newSupervisorId });
        }
      }

      await batch.commit();

      toast({
        title: "Transferencia Exitosa",
        description: `Se ha transferido la carga académica seleccionada de ${docenteOrigen.nombre} ${docenteOrigen.apellidos}.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error transfiriendo la carga:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo completar la transferencia. Por favor, inténtelo de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const TransferList = ({ plans, title, availableSupervisors, type }: {
    plans: ThesisPlan[],
    title: string,
    availableSupervisors: DocenteConteo[],
    type: 'review' | 'advisory',
  }) => {
    const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
    const [batchSupervisor, setBatchSupervisor] = useState<string>('');

    if (plans.length === 0) return null;

    const handleSelectAll = (checked: boolean) => {
      setSelectedPlans(checked ? plans.map(p => p.id) : []);
    };
    
    const handleSelectPlan = (planId: string, checked: boolean) => {
        setSelectedPlans(prev => checked ? [...prev, planId] : prev.filter(id => id !== planId));
    };

    const applyBatchAssignment = () => {
        if (!batchSupervisor) {
            toast({ variant: "destructive", title: "Seleccione un supervisor", description: "Debe elegir un supervisor para asignar en lote."});
            return;
        }
        selectedPlans.forEach(planId => {
            form.setValue(`assignments.${planId}`, batchSupervisor, { shouldDirty: true });
        });
        setSelectedPlans([]);
        setBatchSupervisor('');
    };

    const clearBatchAssignment = () => {
        selectedPlans.forEach(planId => {
            form.setValue(`assignments.${planId}`, '', { shouldDirty: true });
        });
        setSelectedPlans([]);
    };

    return (
      <div className="space-y-4">
        <h4 className="font-semibold">{title} ({plans.length})</h4>

        <div className="flex items-center gap-4 rounded-md border p-2 bg-muted/50">
            <Checkbox
                id={`select-all-${type}`}
                onCheckedChange={handleSelectAll}
                checked={selectedPlans.length === plans.length && plans.length > 0}
                disabled={plans.length === 0}
            />
            <Label htmlFor={`select-all-${type}`} className="text-sm font-medium">
                Seleccionar todos
            </Label>
             <div className="flex-1" />
            {selectedPlans.length > 0 && (
                <div className="flex items-center gap-2">
                    <Select value={batchSupervisor} onValueChange={setBatchSupervisor}>
                        <SelectTrigger className="w-[250px] h-9">
                            <SelectValue placeholder="Asignar seleccionados a..." />
                        </SelectTrigger>
                        <SelectContent>
                             {availableSupervisors.map((s) => (
                                <SelectItem key={s.uid} value={s.uid}>
                                    {s.nombre} {s.apellidos}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" size="sm" onClick={applyBatchAssignment}>Aplicar</Button>
                     <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={clearBatchAssignment}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Limpiar</span>
                    </Button>
                </div>
            )}
        </div>

        <div className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between p-3 border rounded-md bg-background gap-4">
              <Checkbox
                id={`select-${plan.id}`}
                onCheckedChange={(checked) => handleSelectPlan(plan.id, checked as boolean)}
                checked={selectedPlans.includes(plan.id)}
              />
              <div className="flex-1">
                <p className="font-medium">{plan.estudiante.apellidosNombres}</p>
                <p className="text-sm text-muted-foreground truncate max-w-xs">{plan.titulo}</p>
              </div>
              <FormField
                control={form.control}
                name={`assignments.${plan.id}`}
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Seleccionar nuevo supervisor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSupervisors.map((s) => (
                          <SelectItem key={s.uid} value={s.uid}>
                            {s.nombre} {s.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Transferir Carga Académica de Supervisión</DialogTitle>
          <DialogDescription>
            Reasigne los planes supervisados por{" "}
            <span className="font-bold">{docenteOrigen.nombre} {docenteOrigen.apellidos}</span> a otros
            docentes calificados. Puede realizar transferencias parciales o totales.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {allPlansToTransfer.length > 0 ? (
                <ScrollArea className="h-[60vh] p-1">
                    <div className="space-y-6 pr-4">
                        <TransferList
                            plans={supervisedReviewPlans}
                            title="Supervisiones de Planes de Tesis"
                            availableSupervisors={availableReviewSupervisors}
                            type="review"
                        />
                        <TransferList
                            plans={supervisedAdvisoryPlans}
                            title="Supervisiones de Asesorías"
                            availableSupervisors={availableAdvisorySupervisors}
                            type="advisory"
                        />
                    </div>
                </ScrollArea>
            ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">Este docente no tiene supervisiones activas para transferir.</p>
                </div>
            )}
            <DialogFooter className="pt-6">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !atLeastOneAssigned}>
                {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Transferencia
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

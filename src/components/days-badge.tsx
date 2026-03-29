

"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DaysBadgeProps {
  days: number;
  isFinished?: boolean;
  prefix?: string;
  className?: string;
  context?: 'review' | 'advisory';
}

export function DaysBadge({ days, isFinished, prefix, className, context = 'review' }: DaysBadgeProps) {
  const prefixText = prefix ? `${prefix} ` : "";

  if (isFinished) {
    return (
      <Badge variant="outline" className={cn("border-green-300 text-green-800", className)}>
        {prefixText}Finalizado
      </Badge>
    );
  }

  if (days < 0) {
    return (
      <Badge variant="destructive" className={className}>
        {prefixText}Vencido hace {-days} día{-days !== 1 ? 's' : ''}
      </Badge>
    );
  }

  if (days === 0) {
    return (
      <Badge variant="destructive" className={cn("bg-orange-500", className)}>
        {prefixText}Vence hoy
      </Badge>
    );
  }
  
  let badgeColor = "";
  let badgeVariant: "destructive" | "outline" | "default" | "secondary" | null | undefined = "outline";

  if (context === 'review') {
    if (days <= 7) {
      badgeColor = "bg-yellow-500 text-yellow-900 border-yellow-600";
    } else {
      badgeColor = "bg-green-100 text-green-800 border-green-200";
    }
  } else if (context === 'advisory') {
    if (days <= 7) {
        badgeColor = "bg-red-500 text-white border-red-600";
        badgeVariant = "destructive";
    } else if (days <= 30) {
        badgeColor = "bg-yellow-500 text-yellow-900 border-yellow-600";
        badgeVariant = "secondary";
    } else {
        badgeColor = "bg-green-100 text-green-800 border-green-200";
    }
  }

  return (
    <Badge variant={badgeVariant} className={cn(badgeColor, className)}>
      {prefixText}Vence en {days} día{days !== 1 ? 's' : ''}
    </Badge>
  );
}

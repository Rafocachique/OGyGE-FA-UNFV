
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "./ui/scroll-area";

interface MultiSelectFilterProps {
  title: string;
  options: {
    value: string;
    label: string;
  }[];
  selectedValues: string[];
  onSelectedChange: (selected: string[]) => void;
  className?: string;
}

export function MultiSelectFilter({
  title,
  options,
  selectedValues,
  onSelectedChange,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const handleSelect = (value: string) => {
    const isSelected = selectedValues.includes(value);
    if (isSelected) {
      onSelectedChange(selectedValues.filter((v) => v !== value));
    } else {
      onSelectedChange([...selectedValues, value]);
    }
  };

  const getButtonLabel = () => {
    if (selectedValues.length === 0) {
      return `Todos los ${title}`;
    }
    if (selectedValues.length === 1) {
      const selectedOption = options.find((o) => o.value === selectedValues[0]);
      return selectedOption ? selectedOption.label : "1 seleccionado";
    }
    return `${selectedValues.length} ${title} seleccionados`;
  };

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[200px] justify-between", className)}
        >
          <span className="truncate">{getButtonLabel()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <div className="p-2">
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder={`Buscar ${title.toLowerCase()}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                />
            </div>
        </div>
        <ScrollArea className="h-60">
            <div className="p-2 space-y-1">
                <div
                    onClick={() => onSelectedChange([])}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                >
                    <div
                        className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selectedValues.length === 0
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                    >
                        <Check className={cn("h-4 w-4")} />
                    </div>
                    Todos
                </div>
                {filteredOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                        <div
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                        >
                            <div
                                className={cn(
                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}
                            >
                                <Check className={cn("h-4 w-4")} />
                            </div>
                            {option.label}
                        </div>
                    );
                })}
                 {filteredOptions.length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">No se encontraron resultados.</p>
                 )}
            </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


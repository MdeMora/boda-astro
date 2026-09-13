import type { ComponentProps, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Radix reserves the empty string for its placeholder; the planner uses it
// for the explicit “unassigned” option.
const EMPTY = "__unassigned__";
export function PlannerOption({
  value,
  children,
  ...props
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <SelectItem value={value || EMPTY} {...props}>
      {children}
    </SelectItem>
  );
}
export function PlannerSelect({
  value,
  onValueChange,
  children,
  disabled,
  ...props
}: Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || EMPTY}
      onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">{children}</SelectContent>
    </Select>
  );
}

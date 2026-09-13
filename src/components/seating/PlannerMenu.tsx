import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function Menu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="sp-btn sp-btn--ghost">{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  loading,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <DropdownMenuItem
      className={
        danger ? "sp-menu__item sp-menu__item--danger" : "sp-menu__item"
      }
      onSelect={onClick}
      disabled={disabled}
    >
      {loading ? <Loader2 aria-hidden="true" className="sp-spin" /> : icon}
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

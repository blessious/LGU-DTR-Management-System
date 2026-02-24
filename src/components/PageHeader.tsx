import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions,
}: PageHeaderProps) {
  return (
    <div className="bg-card shadow-sm border-b border-border p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-card-foreground">{title}</h1>
        <div className="flex items-center gap-4">
          {searchPlaceholder && onSearchChange && (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-background border-input"
              />
            </div>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

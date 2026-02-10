import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  PieChart, 
  Settings, 
  LogOut,
  Building2,
  Wallet,
  Tags,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

const navItems = [
  { href: "/", label: "Главная", icon: LayoutDashboard },
  { href: "/transactions", label: "Операции", icon: ArrowRightLeft },
  { href: "/reports", label: "Отчеты", icon: PieChart },
];

const directoryItems = [
  { href: "/studios", label: "Студии", icon: Building2 },
  { href: "/accounts", label: "Счета", icon: Wallet },
  { href: "/categories", label: "Статьи", icon: Tags },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
        location === href 
          ? "bg-primary/10 text-primary shadow-sm" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={() => setIsOpen(false)}
    >
      <Icon className={cn("w-5 h-5 transition-colors", location === href ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {label}
    </Link>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="lg:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur border shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold font-display">
              V
            </div>
            <span className="text-xl font-bold font-display text-foreground tracking-tight">
              ViVi<span className="text-primary">.finance</span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          <div className="space-y-1">
            <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Меню</h4>
            {navItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>

          <div className="space-y-1">
            <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Справочники</h4>
            {directoryItems.map((item) => <NavLink key={item.href} {...item} />)}
          </div>
        </div>

        <div className="p-4 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.firstName || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </aside>
    </>
  );
}

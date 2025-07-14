import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLogoutMutation } from "@/lib/auth";
import { 
  Home, 
  Settings, 
  Workflow, 
  Upload, 
  Phone, 
  FileText, 
  LogOut,
  Activity
} from "lucide-react";

const navigationItems = [
  { path: "/", icon: Home, label: "Панель управления" },
  { path: "/settings", icon: Settings, label: "Настройки" },
  { path: "/rules", icon: Workflow, label: "Конструктор правил" },
  { path: "/upload", icon: Upload, label: "Загрузка контактов" },
  { path: "/results", icon: Phone, label: "Результаты прозвонов" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation(createLogoutMutation(queryClient));

  return (
    <div className="sidebar-gradient w-64 fixed left-0 top-0 h-full z-50 border-r border-border/40">
      <div className="p-6">
        <div className="flex items-center mb-8">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center mr-3">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">CRM Интегратор</h1>
        </div>
        
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start transition-all ${
                    isActive 
                      ? "gradient-primary text-primary-foreground hover:opacity-90" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
              <div className="w-5 h-5 bg-primary rounded-full"></div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                {(user as any)?.firstName || (user as any)?.email || "Пользователь"}
              </div>
              <div className="text-xs text-muted-foreground">
                {(user as any)?.email}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

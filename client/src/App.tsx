import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/NewLanding";
import AuthPage from "@/pages/auth-page";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import RuleBuilder from "@/pages/RuleBuilder";
import FileUpload from "@/pages/FileUpload";
import CallResults from "@/pages/CallResults";
import Logs from "@/pages/Logs";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import SystemSettings from "@/pages/admin/SystemSettings";
import IntegrationsAndMonitoring from "@/pages/admin/IntegrationsAndMonitoring";
import WebhookManagement from "@/pages/admin/WebhookManagement";
import PerformanceMonitoring from "@/pages/admin/PerformanceMonitoring";

// Component to handle redirects for unauthenticated users
function AuthRedirect() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // If user is trying to access protected route, redirect to auth
    if (location !== "/" && location !== "/auth") {
      setLocation("/auth");
    }
  }, [location, setLocation]);

  return <AuthPage />;
}

type AuthUser = {
  role?: string;
  // add other properties as needed
};

function Router() {
  const { user, isLoading } = useAuth() as { user: AuthUser | null, isLoading: boolean };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!user ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={AuthPage} />
          {/* Catch all other routes and redirect to auth */}
          <Route component={AuthRedirect} />
        </>
      ) : user.role === "superuser" ? (
        <AdminLayout>
          <Route path="/" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/users" component={UserManagement} />
          <Route path="/admin/integrations" component={IntegrationsAndMonitoring} />
          <Route path="/admin/webhooks" component={WebhookManagement} />
          <Route path="/admin/performance" component={PerformanceMonitoring} />
          <Route path="/admin/settings" component={SystemSettings} />
          <Route path="/admin/logs" component={Logs} />
        </AdminLayout>
      ) : user && (user as any).role !== "superuser" ? (
        <Layout>
          <Route path="/" component={Home} />
          <Route path="/settings" component={Settings} />
          <Route path="/rules" component={RuleBuilder} />
          <Route path="/upload" component={FileUpload} />
          <Route path="/results" component={CallResults} />
          <Route path="/logs" component={Logs} />
        </Layout>
      ) : null}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

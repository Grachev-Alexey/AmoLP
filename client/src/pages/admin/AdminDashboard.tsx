import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Database, Settings, Activity, Shield, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/admin/logs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  if (usersLoading || statsLoading || logsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Административная панель</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats as any)?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(stats as any)?.activeUsers || 0} активных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Интеграции</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats as any)?.totalIntegrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(stats as any)?.activeIntegrations || 0} активных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Синхронизации</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats as any)?.totalSyncs || 0}</div>
            <p className="text-xs text-muted-foreground">
              за последние 24 часа
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ошибки</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats as any)?.totalErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              за последние 24 часа
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Пользователи системы</CardTitle>
          <CardDescription>Список всех зарегистрированных пользователей</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Пользователь</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Роль</th>
                  <th className="text-left p-2">Статус</th>
                  <th className="text-left p-2">Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {(users as any)?.map((user: any) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">{user.email || "—"}</td>
                    <td className="p-2">
                      <Badge variant={user.role === "superuser" ? "default" : "secondary"}>
                        {user.role === "superuser" ? "Администратор" : "Пользователь"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-green-600">
                        Активен
                      </Badge>
                    </td>
                    <td className="p-2">
                      {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Последние события</CardTitle>
          <CardDescription>Логи системы за последние 24 часа</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(logs as any)?.slice(0, 10).map((log: any) => (
              <div key={log.id} className="flex items-center gap-2 text-sm">
                <Badge
                  variant={
                    log.level === "error" ? "destructive" :
                    log.level === "warning" ? "default" : "secondary"
                  }
                >
                  {log.level}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("ru-RU")}
                </span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
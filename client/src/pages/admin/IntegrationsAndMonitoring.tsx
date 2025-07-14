import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTable from "@/components/DataTable";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/lib/auth";
import {
  Activity,
  Users,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  TestTube,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Play,
  TrendingUp,
  Server,
  FileText,
  Info
} from "lucide-react";

export default function IntegrationsAndMonitoring() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testingUser, setTestingUser] = useState<string | null>(null);

  // Queries
  const { data: integrationStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["/api/admin/integration-status"],
    refetchInterval: 30000,
  });

  const { data: webhookStatus, isLoading: webhookLoading } = useQuery({
    queryKey: ["/api/admin/webhook-status"],
    refetchInterval: 60000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000,
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: 10000,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["/api/admin/recent-activity"],
    refetchInterval: 15000,
  });

  // Test user integrations mutation
  const testUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("/api/admin/test-user-integrations", "POST", { userId });
    },
    onSuccess: (data) => {
      toast({
        title: "Тестирование завершено",
        description: `AmoCRM: ${data.amoCrm.message}, LPTracker: ${data.lpTracker.message}`,
      });
      setTestingUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка тестирования",
        description: error.message || "Не удалось протестировать интеграции",
        variant: "destructive",
      });
      setTestingUser(null);
    },
  });

  const handleTestUser = (userId: string) => {
    setTestingUser(userId);
    testUserMutation.mutate(userId);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      connected: { variant: "default" as const, label: "Подключено", icon: CheckCircle },
      configured: { variant: "default" as const, label: "Настроено", icon: Settings },
      active: { variant: "default" as const, label: "Активен", icon: CheckCircle },
      inactive: { variant: "secondary" as const, label: "Неактивен", icon: Clock },
      disconnected: { variant: "destructive" as const, label: "Отключено", icon: AlertCircle },
      error: { variant: "destructive" as const, label: "Ошибка", icon: AlertTriangle },
      not_configured: { variant: "outline" as const, label: "Не настроено", icon: Settings },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // User integrations table columns
  const userColumns = [
    {
      key: 'username',
      label: 'Пользователь',
      sortable: true,
    },
    {
      key: 'amoCrm',
      label: 'AmoCRM',
      render: (value: any) => (
        <div className="space-y-1">
          {getStatusBadge(value.status)}
          {value.subdomain && (
            <div className="text-xs text-muted-foreground">
              {value.subdomain}.amocrm.ru
            </div>
          )}
          {value.hasApiKey && (
            <div className="text-xs text-green-400">
              ✓ API ключ настроен
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'lpTracker',
      label: 'LPTracker',
      render: (value: any) => (
        <div className="space-y-1">
          {getStatusBadge(value.status)}
          {value.projectId && (
            <div className="text-xs text-muted-foreground">
              Проект: {value.projectId}
            </div>
          )}
          <div className="text-xs">
            Webhook: {getStatusBadge(value.webhookStatus)}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (value: any, row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleTestUser(row.userId)}
          disabled={testingUser === row.userId}
          className="flex items-center gap-1"
        >
          {testingUser === row.userId ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <TestTube className="h-3 w-3" />
          )}
          Тест
        </Button>
      ),
    },
  ];

  if (statusLoading || webhookLoading || statsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка данных интеграций...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Интеграции и мониторинг</h1>
          <p className="text-muted-foreground mt-1">
            Управление интеграциями, мониторинг системы и анализ активности
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">
            Система работает
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:text-foreground">Обзор</TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-background data-[state=active]:text-foreground">Интеграции</TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-background data-[state=active]:text-foreground">Активность</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card/60 border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Всего пользователей</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{(stats as any)?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{(stats as any)?.newUsersToday || 0} за сегодня
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Активные интеграции</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{(stats as any)?.totalIntegrations || 0}</div>
                <p className="text-xs text-muted-foreground">
                  AmoCRM: {(integrationStatus as any)?.amoCrmActive || 0}, LPTracker: {(integrationStatus as any)?.lpTrackerActive || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">События за 24ч</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{(stats as any)?.eventsProcessed || 0}</div>
                <p className="text-xs text-muted-foreground">
                  обработано событий
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Системные ошибки</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{(stats as any)?.totalErrors || 0}</div>
                <p className="text-xs text-muted-foreground">
                  всего в логах
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Server className="h-5 w-5" />
                <span>Состояние системы</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Статус ключевых компонентов системы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-foreground">База данных</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Подключена</span>
                  <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Работает</Badge>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-foreground">AmoCRM интеграции</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {(integrationStatus as any)?.amoCrmActive || 0} активных
                  </span>
                  <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Работает</Badge>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-foreground">LPTracker интеграции</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {(integrationStatus as any)?.lpTrackerActive || 0} активных
                  </span>
                  <Badge variant="default" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Работает</Badge>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${(integrationStatus as any)?.lpTrackerWebhook?.active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-foreground">LPTracker Webhook</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {(integrationStatus as any)?.lpTrackerWebhook?.configured ? 'Настроен' : 'Не настроен'}
                  </span>
                  <Badge variant={(integrationStatus as any)?.lpTrackerWebhook?.active ? "default" : "secondary"} 
                         className={(integrationStatus as any)?.lpTrackerWebhook?.active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {(integrationStatus as any)?.lpTrackerWebhook?.active ? 'Активен' : 'Неактивен'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Database className="h-5 w-5" />
                <span>Статус интеграций пользователей</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Детальная информация о настройках интеграций для каждого пользователя
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={(integrationStatus as any)?.userIntegrations || []}
                columns={userColumns}
                searchable={true}
                pagination={true}
                pageSize={10}
                emptyMessage="Нет настроенных интеграций"
                loading={statusLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>



        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Clock className="h-5 w-5" />
                <span>Последняя активность</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Недавние события в системе
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity && (recentActivity as any).length > 0 ? (
                <div className="space-y-4">
                  {(recentActivity as any).slice(0, 10).map((activity: any, index: number) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {activity.type === "user_login" && (
                          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-green-400" />
                          </div>
                        )}
                        {activity.type === "integration_setup" && (
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <Database className="h-4 w-4 text-blue-400" />
                          </div>
                        )}
                        {activity.type === "webhook_processed" && (
                          <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <Zap className="h-4 w-4 text-purple-400" />
                          </div>
                        )}
                        {activity.type === "error" && (
                          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {activity.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString("ru-RU")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Нет данных об активности за последнее время
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
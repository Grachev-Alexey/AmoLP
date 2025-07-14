import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Users, Play, Square, AlertCircle, CheckCircle, Clock } from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function WebhookManagement() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Define type for integration status
  type IntegrationStatus = {
    userIntegrations?: any[];
  };

  // Get all users with their integrations
  const { data: integrationStatus, isLoading: integrationsLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/admin/integration-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 10000,
  });

  // Define type for webhook status
  type WebhookStatus = {
    webhooks?: any[];
  };

  // Get detailed webhook status
  const { data: webhookStatus, isLoading: webhookLoading } = useQuery<WebhookStatus>({
    queryKey: ["/api/admin/webhook-status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 5000,
  });

  // Define type for global webhook
  type GlobalWebhook = {
    url?: string;
    active?: boolean;
  };

  // Get global webhook status
  const { data: globalWebhook, isLoading: globalLoading } = useQuery<GlobalWebhook>({
    queryKey: ["/api/lptracker/webhook-status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Setup webhook mutation
  const setupWebhookMutation = useMutation({
    mutationFn: async ({ userId, url }: { userId: string; url: string }) => {
      return apiRequest(`/api/lptracker/webhook/user/${userId}`, "POST", { webhookUrl: url });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Успешно!",
        description: `Вебхук установлен для пользователя`,
      });
      // Force immediate refetch of all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/webhook-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integration-status"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/webhook-status"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/integration-status"] });
      setIsDialogOpen(false);
      setWebhookUrl("");
      setSelectedUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось установить вебхук",
        variant: "destructive",
      });
    },
  });

  // Remove webhook mutation
  const removeWebhookMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/lptracker/webhook/user/${userId}`, "DELETE");
    },
    onSuccess: (data, userId) => {
      toast({
        title: "Успешно!",
        description: `Вебхук удален для пользователя`,
      });
      // Force immediate refetch of all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/webhook-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integration-status"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/webhook-status"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/integration-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить вебхук",
        variant: "destructive",
      });
    },
  });

  const handleSetupWebhook = (userId: string) => {
    setSelectedUserId(userId);
    setWebhookUrl(globalWebhook?.url || `${window.location.origin}/api/webhooks/lptracker`);
    setIsDialogOpen(true);
  };

  const handleRemoveWebhook = (userId: string) => {
    removeWebhookMutation.mutate(userId);
  };

  if (integrationsLoading || webhookLoading || globalLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const usersWithLpTracker = integrationStatus?.userIntegrations?.filter(
    (user: any) => user.lpTracker.projectId
  ) || [];

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <AdminPageHeader
        icon={Webhook}
        title="Управление вебхуками"
        description="Настройка и мониторинг вебхуков LPTracker для пользователей"
      />

      {/* Global webhook status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Глобальные настройки вебхука
          </CardTitle>
          <CardDescription>
            Общий URL вебхука для всех пользователей
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>URL:</Label>
              <code className="px-2 py-1 bg-muted rounded text-sm">
                {globalWebhook?.url || "Не настроен"}
              </code>
              <Badge variant={globalWebhook?.active ? "default" : "secondary"}>
                {globalWebhook?.active ? "Активен" : "Неактивен"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users with LPTracker projects */}
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Пользователи с проектами LPTracker ({usersWithLpTracker.length})
          </h2>
        </div>

        {usersWithLpTracker.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Нет пользователей с настроенными проектами LPTracker</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {usersWithLpTracker.map((user: any) => {
              const userWebhook = webhookStatus?.webhooks?.find(
                (w: any) => w.username === user.username
              );
              const isWebhookActive = userWebhook?.status === 'active';

              return (
                <Card key={user.userId}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{user.username}</h3>
                          <Badge variant="outline">ID: {user.userId}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Проект: {user.lpTracker.projectId}</span>
                          <div className="flex items-center gap-1">
                            {isWebhookActive ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            )}
                            <span>
                              Вебхук: {isWebhookActive ? "Активен" : "Не настроен"}
                            </span>
                          </div>
                          {userWebhook?.lastActivity && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                Последняя активность: {" "}
                                {new Date(userWebhook.lastActivity).toLocaleString("ru-RU")}
                              </span>
                            </div>
                          )}
                        </div>
                        {userWebhook?.activityCount > 0 && (
                          <div className="text-sm text-muted-foreground">
                            Обработано вебхуков за 24ч: {userWebhook.activityCount}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isWebhookActive ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveWebhook(user.userId)}
                            disabled={removeWebhookMutation.isPending}
                          >
                            <Square className="h-4 w-4 mr-2" />
                            {removeWebhookMutation.isPending ? "Удаление..." : "Удалить вебхук"}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSetupWebhook(user.userId)}
                            disabled={setupWebhookMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Установить вебхук
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Setup webhook dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Установка вебхука</DialogTitle>
            <DialogDescription>
              Настройте URL вебхука для пользователя
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">URL вебхука</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://yourdomain.com/api/webhooks/lptracker"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                onClick={() => {
                  if (selectedUserId && webhookUrl) {
                    setupWebhookMutation.mutate({ userId: selectedUserId, url: webhookUrl });
                  }
                }}
                disabled={!selectedUserId || !webhookUrl || setupWebhookMutation.isPending}
              >
                {setupWebhookMutation.isPending ? "Установка..." : "Установить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
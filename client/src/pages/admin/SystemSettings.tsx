import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Database, Shield, Mail, Bell, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function SystemSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lpTrackerSettings, isLoading: lpTrackerLoading } = useQuery({
    queryKey: ["/api/admin/lptracker-settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: systemSettings, isLoading: systemLoading } = useQuery({
    queryKey: ["/api/admin/system-settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const updateLpTrackerMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("/api/admin/lptracker-settings", "POST", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lptracker-settings"] });
      toast({
        title: "Успешно",
        description: "Настройки LPTracker обновлены",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  const updateSystemMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest("/api/admin/system-settings", "POST", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      toast({
        title: "Успешно",
        description: "Системные настройки обновлены",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  const testLpTrackerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/admin/lptracker/test-connection", "POST", data);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Соединение установлено",
          description: "Подключение к LPTracker успешно. Токен получен.",
        });
        // Refresh settings to get the new token
        queryClient.invalidateQueries({ queryKey: ["/api/admin/lptracker-settings"] });
      } else {
        toast({
          title: "Ошибка подключения к LPTracker",
          description: data.message || "Неверные данные для входа в LPTracker",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось проверить подключение к LPTracker",
        variant: "destructive",
      });
    },
  });

  const handleLpTrackerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const settings = {
      login: formData.get("login"),
      password: formData.get("password"),
      service: formData.get("service"),
      address: formData.get("address"),
      isActive: formData.get("isActive") === "on",
    };
    updateLpTrackerMutation.mutate(settings);
  };

  const handleSystemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const settings = {
      maxFileSize: parseInt(formData.get("maxFileSize") as string),
      allowRegistration: formData.get("allowRegistration") === "on",
      sessionTimeout: parseInt(formData.get("sessionTimeout") as string),
      logRetentionDays: parseInt(formData.get("logRetentionDays") as string),
      maintenanceMode: formData.get("maintenanceMode") === "on",
      maintenanceMessage: formData.get("maintenanceMessage"),
    };
    updateSystemMutation.mutate(settings);
  };

  const handleTestLpTrackerConnection = () => {
    if (lpTrackerSettings) {
      testLpTrackerMutation.mutate({
        login: lpTrackerSettings.login,
        password: lpTrackerSettings.password,
        service: lpTrackerSettings.service,
        address: lpTrackerSettings.address,
      });
    }
  };

  if (lpTrackerLoading || systemLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Settings}
        title="Системные настройки"
        description="Конфигурация системы и глобальных интеграций"
      />

      <Tabs defaultValue="lptracker" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lptracker">LPTracker</TabsTrigger>
          <TabsTrigger value="system">Система</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
        </TabsList>

        <TabsContent value="lptracker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Настройки LPTracker
              </CardTitle>
              <CardDescription>
                Глобальные настройки для подключения к LPTracker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLpTrackerSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="login">Логин</Label>
                  <Input
                    id="login"
                    name="login"
                    defaultValue={(lpTrackerSettings as any)?.login || ""}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    defaultValue={(lpTrackerSettings as any)?.password || ""}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="service">Название сервиса</Label>
                  <Input
                    id="service"
                    name="service"
                    defaultValue={(lpTrackerSettings as any)?.service || "CRM Integration"}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Адрес сервера</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={(lpTrackerSettings as any)?.address || "direct.lptracker.ru"}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    name="isActive"
                    defaultChecked={(lpTrackerSettings as any)?.isActive !== false}
                  />
                  <Label htmlFor="isActive">Активировать подключение</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Button type="submit" disabled={updateLpTrackerMutation.isPending}>
                    {updateLpTrackerMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestLpTrackerConnection}
                    disabled={
                      testLpTrackerMutation.isPending ||
                      !(lpTrackerSettings as any)?.login ||
                      !(lpTrackerSettings as any)?.password
                    }
                  >
                    {testLpTrackerMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Проверка...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Проверить подключение
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Системные параметры
              </CardTitle>
              <CardDescription>
                Общие настройки системы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSystemSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="maxFileSize">Максимальный размер файла (MB)</Label>
                  <Input
                    id="maxFileSize"
                    name="maxFileSize"
                    type="number"
                    defaultValue={(systemSettings as any)?.maxFileSize || 10}
                  />
                </div>
                <div>
                  <Label htmlFor="sessionTimeout">Время сессии (часы)</Label>
                  <Input
                    id="sessionTimeout"
                    name="sessionTimeout"
                    type="number"
                    defaultValue={(systemSettings as any)?.sessionTimeout || 24}
                  />
                </div>
                <div>
                  <Label htmlFor="logRetentionDays">Хранение логов (дни)</Label>
                  <Input
                    id="logRetentionDays"
                    name="logRetentionDays"
                    type="number"
                    defaultValue={(systemSettings as any)?.logRetentionDays || 30}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowRegistration"
                    name="allowRegistration"
                    defaultChecked={(systemSettings as any)?.allowRegistration !== false}
                  />
                  <Label htmlFor="allowRegistration">Разрешить регистрацию</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="maintenanceMode"
                    name="maintenanceMode"
                    defaultChecked={(systemSettings as any)?.maintenanceMode === true}
                  />
                  <Label htmlFor="maintenanceMode">Режим обслуживания</Label>
                </div>
                <div>
                  <Label htmlFor="maintenanceMessage">Сообщение обслуживания</Label>
                  <Textarea
                    id="maintenanceMessage"
                    name="maintenanceMessage"
                    defaultValue={(systemSettings as any)?.maintenanceMessage || "Система временно недоступна"}
                  />
                </div>
                <Button type="submit" disabled={updateSystemMutation.isPending}>
                  {updateSystemMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Настройки безопасности
              </CardTitle>
              <CardDescription>
                Параметры безопасности системы
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Двухфакторная аутентификация</Label>
                    <p className="text-sm text-muted-foreground">
                      Включить 2FA для всех администраторов
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Принудительная смена пароля</Label>
                    <p className="text-sm text-muted-foreground">
                      Требовать смену пароля каждые 90 дней
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Блокировка IP после неудачных попыток</Label>
                    <p className="text-sm text-muted-foreground">
                      Блокировать IP после 5 неудачных попыток входа
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Логирование всех действий</Label>
                    <p className="text-sm text-muted-foreground">
                      Записывать все действия пользователей
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
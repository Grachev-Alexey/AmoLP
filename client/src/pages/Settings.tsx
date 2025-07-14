import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuthRedirect } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { 
  Link, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";

// Типы для данных
interface AmoCrmSettings {
  subdomain?: string;
  apiKey?: string;
  isActive?: boolean;
}

interface LpTrackerStatus {
  connected?: boolean;
  projectId?: string;
}

interface UserInfo {
  role?: string;
}

export default function Settings() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amoCrmData, setAmoCrmData] = useState({
    subdomain: "",
    apiKey: "",
  });
  const [showAmoCrmKey, setShowAmoCrmKey] = useState(false);

  // Fetch settings
  const { data: amoCrmSettings, isLoading: amoCrmLoading } = useQuery<AmoCrmSettings>({
    queryKey: ["/api/amocrm/settings"],
    retry: false,
  });

  // Only get LPTracker status for regular users
  const { data: lpTrackerStatus } = useQuery<LpTrackerStatus>({
    queryKey: ["/api/lptracker/status"],
    retry: false,
  });

  const { data: lpTrackerMetadata } = useQuery({
    queryKey: ["/api/lptracker/metadata/projects"],
    retry: false,
  });

  const { data: userInfo } = useQuery<UserInfo>({
    queryKey: ["/api/user"],
    retry: false,
  });

  // Mutations
  const saveAmoCrmMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("/api/amocrm/settings", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Успешно сохранено",
        description: "Настройки AmoCRM обновлены",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/amocrm/settings"] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить настройки AmoCRM",
        variant: "destructive",
      });
    },
  });

  // Add LPTracker metadata refresh for regular users
  const refreshLpTrackerMetadataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/lptracker/refresh-metadata", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Метаданные обновлены",
        description: "Данные LPTracker успешно синхронизированы",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/lptracker/metadata/projects"] });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить метаданные LPTracker",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(
        "/api/amocrm/test-connection",
        "POST",
        data,
      );
      return response;
    },
    onSuccess: (data) => {
      if (data.isValid) {
        toast({
          title: "Соединение установлено",
          description: "Подключение к AmoCRM успешно",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/amocrm/settings"] });
      } else {
        toast({
          title: "Ошибка подключения к AmoCRM",
          description:
            data.message ||
            "API ключ недействителен или истек. Создайте новый долгосрочный API ключ в настройках AmoCRM и убедитесь, что он имеет все необходимые права.",
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/amocrm/settings"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description:
          "Не удалось проверить подключение. Проверьте интернет соединение.",
        variant: "destructive",
      });
    },
  });

  const refreshMetadataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/amocrm/refresh-metadata", "POST");
    },
    onSuccess: () => {
      toast({
        title: "Метаданные обновлены",
        description: "Данные AmoCRM успешно синхронизированы",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить метаданные",
        variant: "destructive",
      });
    },
  });

  const handleSaveAmoCrm = (e: React.FormEvent) => {
    e.preventDefault();
    saveAmoCrmMutation.mutate(amoCrmData);
  };

  const handleTestConnection = () => {
    // Не передаем данные - backend будет использовать данные из БД
    testConnectionMutation.mutate({});
  };

  const handleInputChange = (field: string, value: string) => {
    setAmoCrmData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Set form data when settings are loaded initially only
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  React.useEffect(() => {
    if (amoCrmSettings && !initialLoadDone) {
      setAmoCrmData({
        subdomain: amoCrmSettings.subdomain || "",
        apiKey: amoCrmSettings.apiKey || "",
      });
      setInitialLoadDone(true);
    }
  }, [amoCrmSettings, initialLoadDone]);

  if (amoCrmLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* AmoCRM Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Настройки AmoCRM
          </CardTitle>
          <CardDescription>
            Подключите ваш аккаунт AmoCRM для синхронизации данных
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSaveAmoCrm} className="space-y-4">
            <div>
              <Label htmlFor="subdomain">Поддомен AmoCRM</Label>
              <Input
                id="subdomain"
                type="text"
                placeholder="example (без .amocrm.ru)"
                value={amoCrmData.subdomain}
                onChange={(e) => handleInputChange("subdomain", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="apiKey">API ключ</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showAmoCrmKey ? "text" : "password"}
                  placeholder="Введите ваш API ключ"
                  value={amoCrmData.apiKey}
                  onChange={(e) => handleInputChange("apiKey", e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowAmoCrmKey(!showAmoCrmKey)}
                >
                  {showAmoCrmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={saveAmoCrmMutation.isPending}
              >
                {saveAmoCrmMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  "Проверить соединение"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => refreshMetadataMutation.mutate()}
                disabled={refreshMetadataMutation.isPending}
              >
                {refreshMetadataMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  "Обновить метаданные"
                )}
              </Button>
            </div>
          </form>
          {amoCrmSettings && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2">
                {amoCrmSettings.isActive ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="default">Подключено</Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Не подключено</Badge>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LPTracker Settings - only show for regular users */}
      {userInfo && userInfo.role !== 'superuser' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              LPTracker
            </CardTitle>
            <CardDescription>
              Статус подключения к LPTracker
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lpTrackerStatus?.connected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="default">Подключено</Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Не подключено</Badge>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => refreshLpTrackerMetadataMutation.mutate()}
                disabled={refreshLpTrackerMetadataMutation.isPending}
              >
                {refreshLpTrackerMetadataMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Обновление...
                  </>
                ) : (
                  "Обновить метаданные"
                )}
              </Button>
            </div>
            {lpTrackerStatus?.projectId && (
              <div className="text-sm text-muted-foreground">
                ID проекта: {lpTrackerStatus.projectId}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
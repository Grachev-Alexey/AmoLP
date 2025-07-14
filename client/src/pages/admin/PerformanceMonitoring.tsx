import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  Activity, 
  Clock, 
  Database,
  Server, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  Code
} from "lucide-react";

type PerformanceMetrics = {
  queue?: {
    queueSize?: number;
    activeJobs?: number;
    concurrency?: number;
    oldestJob?: number;
  };
  performance?: {
    memory?: {
      heapUsed?: number;
      heapTotal?: number;
      rss?: number;
    };
    uptime?: number;
    cacheStats?: {
      metadata?: { size?: number };
      rules?: { size?: number };
    };
  };
  timestamp?: number;
};

export default function PerformanceMonitoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetUsers, setTargetUsers] = useState<number>(1000);

  // Получаем метрики производительности
  const { data: metrics, isLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/admin/performance-metrics"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  // Получаем анализ масштабирования
  const { data: scalingAnalysis, isLoading: scalingLoading } = useQuery({
    queryKey: ["/api/admin/scaling-analysis"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  // Очистка кешей
  const clearCachesMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/clear-caches", "POST"),
    onSuccess: () => {
      toast({
        title: "Успешно!",
        description: "Все кеши системы очищены",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/performance-metrics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось очистить кеши",
        variant: "destructive",
      });
    },
  });

  // Расчет ресурсов для целевого количества пользователей
  const calculateResourcesMutation = useMutation({
    mutationFn: (userCount: number) => apiRequest("/api/admin/calculate-resources", "POST", { userCount }),
    onSuccess: (data) => {
      toast({
        title: "Расчет выполнен!",
        description: `Анализ для ${targetUsers} пользователей готов`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось выполнить расчет",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Загрузка метрик производительности...</p>
        </div>
      </div>
    );
  }

  const queue = metrics?.queue || {};
  const performance = metrics?.performance || {};
  const memory = performance.memory || {};
  
  // Приведение типов для metrics
  const metricsData = (metrics as any) || {};
  const queueData = metricsData.queue || {};
  const performanceData = metricsData.performance || {};
  const memoryData = performanceData.memory || {};

  // Расчет процента использования памяти
  const memoryUsagePercent = memoryData.heapUsed ? 
    Math.round((memoryData.heapUsed / memoryData.heapTotal) * 100) : 0;

  // Определение статуса системы
  const getSystemStatus = () => {
    if (queueData.queueSize > 1000) return { status: "critical", color: "destructive", icon: AlertTriangle };
    if (queueData.queueSize > 500 || memoryUsagePercent > 80) return { status: "warning", color: "yellow", icon: AlertTriangle };
    return { status: "healthy", color: "green", icon: CheckCircle };
  };

  const systemStatus = getSystemStatus();

  // Форматирование байтов в MB
  const formatBytes = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  // Форматирование времени работы
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${minutes}м`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Мониторинг производительности</h2>
          <p className="text-muted-foreground">
            Реальная статистика производительности и планирование масштабирования
          </p>
        </div>
        <Button 
          onClick={() => clearCachesMutation.mutate()}
          disabled={clearCachesMutation.isPending}
          variant="outline"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {clearCachesMutation.isPending ? "Очистка..." : "Очистить кеши"}
        </Button>
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">Текущее состояние</TabsTrigger>
          <TabsTrigger value="scaling">Анализ масштабирования</TabsTrigger>
          <TabsTrigger value="planning">Планирование нагрузки</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">

      {/* Общий статус системы */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <systemStatus.icon className={`h-5 w-5 ${
              systemStatus.color === 'green' ? 'text-green-500' : 
              systemStatus.color === 'yellow' ? 'text-yellow-500' : 'text-red-500'
            }`} />
            Статус системы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={systemStatus.color === 'green' ? 'default' : 'destructive'}>
            {systemStatus.status === 'healthy' ? 'Система работает стабильно' :
             systemStatus.status === 'warning' ? 'Требует внимания' : 'Критическая нагрузка'}
          </Badge>
          <div className="mt-4 text-sm text-muted-foreground">
            Обновлено: {new Date((metrics as any)?.timestamp).toLocaleString('ru-RU')}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Очередь Webhook */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Очередь Webhook</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueData.queueSize || 0}</div>
            <p className="text-xs text-muted-foreground">задач в очереди</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Активные:</span>
                <span className="font-medium">{queueData.activeJobs || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Конкурентность:</span>
                <span className="font-medium">{queueData.concurrency || 0}</span>
              </div>
              {queueData.oldestJob && (
                <div className="flex justify-between text-sm">
                  <span>Старейшая задача:</span>
                  <span className="font-medium">{Math.round(queueData.oldestJob / 1000)}с назад</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Использование памяти */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Память</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memoryUsagePercent}%</div>
            <p className="text-xs text-muted-foreground">использовано</p>
            <Progress value={memoryUsagePercent} className="mt-2" />
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Heap Used:</span>
                <span>{formatBytes(memoryData.heapUsed || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Heap Total:</span>
                <span>{formatBytes(memoryData.heapTotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>RSS:</span>
                <span>{formatBytes(memoryData.rss || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Время работы */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(performanceData.uptime || 0)}
            </div>
            <p className="text-xs text-muted-foreground">время работы</p>
          </CardContent>
        </Card>

        {/* Кеши */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Кеширование</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Метаданные:</span>
                <span className="font-medium">{performanceData.cacheStats?.metadata?.size || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Правила:</span>
                <span className="font-medium">{performanceData.cacheStats?.rules?.size || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Рекомендации по масштабированию */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Рекомендации по масштабированию
          </CardTitle>
          <CardDescription>
            На основе текущих метрик производительности
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {queueData.queueSize > 1000 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Критическая нагрузка</p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Очередь переполнена ({queueData.queueSize} задач). Рекомендуется увеличить количество workers или использовать внешнюю очередь (Redis).
                </p>
              </div>
            </div>
          )}

          {memoryUsagePercent > 80 && (
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-400">Высокое использование памяти</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-300">
                  Используется {memoryUsagePercent}% памяти. Рекомендуется очистить кеши или увеличить лимиты памяти.
                </p>
              </div>
            </div>
          )}

          {systemStatus.status === 'healthy' && (
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">Система работает оптимально</p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Все показатели в норме. Система готова к обработке высокой нагрузки.
                </p>
              </div>
            </div>
          )}

          <Separator />
          
          <div className="text-sm space-y-2">
            <h4 className="font-medium">Для масштабирования до 10,000+ пользователей рекомендуется:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
              <li>Внешняя очередь (Redis/Bull) вместо in-memory</li>
              <li>Горизонтальное масштабирование (несколько экземпляров)</li>
              <li>Внешний кеш (Redis) для правил и метаданных</li>
              <li>Connection pooling для базы данных</li>
              <li>Rate limiting для защиты от DDoS</li>
              <li>CDN для статических ресурсов</li>
            </ul>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Анализ масштабирования */}
        <TabsContent value="scaling" className="space-y-6">
          {scalingLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Текущие узкие места */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Анализ узких мест
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {((scalingAnalysis as any)?.criticalIssues?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 dark:text-red-400">Критические проблемы:</h4>
                      {((scalingAnalysis as any)?.criticalIssues || []).map((issue: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-red-700 dark:text-red-300">{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-medium">Рекомендации по оптимизации:</h4>
                    {((scalingAnalysis as any)?.recommendations || []).map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                        <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-blue-700 dark:text-blue-300">{rec}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-medium">План миграции для enterprise-масштаба:</h4>
                    {((scalingAnalysis as any)?.migrationSteps || []).map((step: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-950/20 rounded">
                        <span className="text-sm font-medium text-gray-500 flex-shrink-0">{index + 1}.</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{step.substring(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Планирование нагрузки */}
        <TabsContent value="planning" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Калькулятор ресурсов
              </CardTitle>
              <CardDescription>
                Рассчитайте необходимые ресурсы для целевого количества пользователей
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="targetUsers">Целевое количество пользователей</Label>
                  <Input
                    id="targetUsers"
                    type="number"
                    value={targetUsers}
                    onChange={(e) => setTargetUsers(Number(e.target.value))}
                    min="1"
                    max="100000"
                    step="100"
                  />
                </div>
                <Button 
                  onClick={() => calculateResourcesMutation.mutate(targetUsers)}
                  disabled={calculateResourcesMutation.isPending}
                >
                  {calculateResourcesMutation.isPending ? "Расчет..." : "Рассчитать"}
                </Button>
              </div>

              {(calculateResourcesMutation.data as any) && (
                <div className="space-y-6 mt-6">
                  {/* Оценка нагрузки */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Webhook/сек</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(calculateResourcesMutation.data as any).requirements.estimatedLoad.webhooksPerSecond}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Память (GB)</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(calculateResourcesMutation.data as any).requirements.estimatedLoad.memoryGBRequired}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">CPU ядра</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(calculateResourcesMutation.data as any).requirements.estimatedLoad.cpuCoresRequired}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">$/месяц</span>
                        </div>
                        <div className="text-2xl font-bold">
                          {(calculateResourcesMutation.data as any).requirements.costs.monthlyEstimateUSD}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* План миграции */}
                  <Card>
                    <CardHeader>
                      <CardTitle>План миграции</CardTitle>
                      <CardDescription>
                        Поэтапный план для достижения целевой нагрузки
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {((calculateResourcesMutation.data as any).migrationPlan.phases || []).map((phase: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{phase.phase}</h4>
                              <Badge variant={phase.priority === 'critical' ? 'destructive' : 
                                             phase.priority === 'high' ? 'default' : 'secondary'}>
                                {phase.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              До {phase.userThreshold} пользователей • {phase.estimatedEffort}
                            </p>
                            <ul className="text-sm space-y-1">
                              {phase.changes.map((change: string, changeIndex: number) => (
                                <li key={changeIndex} className="flex items-start gap-2">
                                  <span className="text-muted-foreground">•</span>
                                  <span>{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm">
                          <strong>Общее время реализации:</strong> {(calculateResourcesMutation.data as any).migrationPlan.totalEstimatedTime}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Docker Compose для enterprise */}
                  {(calculateResourcesMutation.data as any).dockerCompose && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Code className="h-5 w-5" />
                          Enterprise Docker Compose
                        </CardTitle>
                        <CardDescription>
                          Готовая конфигурация для enterprise развертывания
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                          <code>{(calculateResourcesMutation.data as any).dockerCompose}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
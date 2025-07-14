import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useAuthRedirect,
  isUnauthorizedError,
  handleUnauthorizedError,
} from "@/lib/auth";
import DataTable from "@/components/DataTable";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  AlertCircle,
  Info,
  AlertTriangle,
  FileText,
  Filter,
  Download,
  RefreshCw,
  Eye,
} from "lucide-react";

export default function Logs() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuthRedirect();
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  // Fetch logs - use admin logs for superuser, user logs for regular users
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/admin/logs"],
    retry: false,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/20 text-red-500";
      case "warning":
        return "bg-yellow-500/20 text-yellow-500";
      case "info":
        return "bg-blue-500/20 text-blue-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "webhook":
        return "bg-purple-500/20 text-purple-500";
      case "sync":
        return "bg-green-500/20 text-green-500";
      case "upload":
        return "bg-blue-500/20 text-blue-500";
      case "settings":
        return "bg-orange-500/20 text-orange-500";
      case "rules":
        return "bg-indigo-500/20 text-indigo-500";
      case "metadata":
        return "bg-pink-500/20 text-pink-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  const formatLogMessage = (message: string) => {
    // Truncate long messages
    if (message.length > 100) {
      return message.substring(0, 100) + "...";
    }
    return message;
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Логи обновлены",
      description: "Список логов успешно обновлен",
    });
  };

  const handleExport = () => {
    toast({
      title: "Экспорт логов",
      description: "Функция экспорта будет реализована позже",
    });
  };

  const handleViewDetails = (log: any) => {
    const details = JSON.stringify(log.data, null, 2);
    toast({
      title: "Детали лога",
      description: details
        ? `Дополнительная информация: ${details}`
        : "Нет дополнительной информации",
    });
  };

  // Filter data based on selected filters
  const filteredData = (logs as any[]).filter((log: any) => {
    const levelMatch = filterLevel === "all" || log.level === filterLevel;
    const sourceMatch = filterSource === "all" || log.source === filterSource;
    return levelMatch && sourceMatch;
  });

  // Get unique sources for filter
  const uniqueSources = Array.from(new Set((logs as any[]).map((log: any) => log.source)));

  const columns = [
    {
      key: "level",
      label: "Уровень",
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          {getLevelIcon(value)}
          <Badge className={getLevelBadgeColor(value)}>
            {value.toUpperCase()}
          </Badge>
        </div>
      ),
    },
    {
      key: "source",
      label: "Источник",
      render: (value: string) => (
        <Badge variant="secondary" className={getSourceBadgeColor(value)}>
          {value}
        </Badge>
      ),
    },
    {
      key: "userId",
      label: "Пользователь",
      render: (value: string) => (
        <div className="text-sm">
          {value ? (
            <Badge variant="outline" className="text-xs">
              {value.substring(0, 8)}...
            </Badge>
          ) : (
            <span className="text-muted-foreground">Система</span>
          )}
        </div>
      ),
    },
    {
      key: "message",
      label: "Сообщение",
      sortable: true,
      render: (value: string) => (
        <div className="font-medium max-w-md text-foreground">
          {formatLogMessage(value)}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Время",
      sortable: true,
      render: (value: string) => (
        <div className="text-sm text-muted-foreground">
          {new Date(value).toLocaleString("ru-RU")}
        </div>
      ),
    },
    {
      key: "actions_column",
      label: "Действия",
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          {row.data && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(row)}
              className="text-primary hover:text-primary/80"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (logsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={FileText}
        title="Логи системы"
        description="Мониторинг и отслеживание операций системы"
      >
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Экспорт
        </Button>
      </AdminPageHeader>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего логов</p>
                <p className="text-2xl font-bold">{(logs as any[]).length}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ошибки</p>
                <p className="text-2xl font-bold text-red-500">
                  {(logs as any[]).filter((log: any) => log.level === "error").length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Предупреждения</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {(logs as any[]).filter((log: any) => log.level === "warning").length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Информация</p>
                <p className="text-2xl font-bold text-blue-500">
                  {(logs as any[]).filter((log: any) => log.level === "info").length}
                </p>
              </div>
              <Info className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Уровень</label>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Все уровни" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все уровни</SelectItem>
                  <SelectItem value="info">Информация</SelectItem>
                  <SelectItem value="warning">Предупреждение</SelectItem>
                  <SelectItem value="error">Ошибка</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Источник</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Все источники" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все источники</SelectItem>
                  {uniqueSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterLevel("all");
                  setFilterSource("all");
                }}
              >
                Сбросить фильтры
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Журнал событий</CardTitle>
          <CardDescription className="text-muted-foreground">
            Детальная информация о всех операциях системы
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={filteredData}
            columns={columns}
            loading={logsLoading}
            emptyMessage="Нет логов для отображения"
            pagination={true}
            pageSize={15}
            searchable={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
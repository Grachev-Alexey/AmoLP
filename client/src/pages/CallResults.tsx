import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { useAuthRedirect } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import DataTable from "@/components/DataTable";
import { 
  Phone, 
  Plus, 
  Filter, 
  Download,
  PhoneCall,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";

export default function CallResults() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [newCallResult, setNewCallResult] = useState({
    contactName: "",
    phone: "",
    result: "",
    duration: 0,
    callDate: new Date().toISOString().slice(0, 16), // for datetime-local input
  });

  // Fetch call results
  const { data: callResults = [], isLoading: callResultsLoading } = useQuery({
    queryKey: ['/api/call-results'],
    retry: false,
  });

  // Add call result mutation
  const addCallResultMutation = useMutation({
    mutationFn: async (result: any) => {
      await apiRequest('/api/call-results', 'POST', {
        ...result,
        callDate: new Date(result.callDate).toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Результат добавлен",
        description: "Результат прозвона успешно добавлен",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/call-results'] });
      setShowAddDialog(false);
      setNewCallResult({
        contactName: "",
        phone: "",
        result: "",
        duration: 0,
        callDate: new Date().toISOString().slice(0, 16),
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить результат прозвона",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSyncStatusLabel = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Синхронизировано';
      case 'failed':
        return 'Ошибка';
      default:
        return 'Ожидает';
    }
  };

  const getResultBadgeColor = (result: string) => {
    const lowerResult = result.toLowerCase();
    if (lowerResult.includes('заинтересован') || lowerResult.includes('успешно')) {
      return 'bg-green-500/20 text-green-500';
    } else if (lowerResult.includes('отказ') || lowerResult.includes('не интересует')) {
      return 'bg-red-500/20 text-red-500';
    } else if (lowerResult.includes('не отвечает') || lowerResult.includes('недозвон')) {
      return 'bg-yellow-500/20 text-yellow-500';
    } else {
      return 'bg-gray-500/20 text-gray-500';
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCallResultMutation.mutate(newCallResult);
  };

  // Filter data based on selected filters
  const filteredData = (callResults as any[]).filter((result: any) => {
    const statusMatch = filterStatus === "all" || result.syncStatus === filterStatus;
    const resultMatch = filterResult === "all" || result.result.toLowerCase().includes(filterResult.toLowerCase());
    return statusMatch && resultMatch;
  });

  const columns = [
    {
      key: "contactName",
      label: "Контакт",
      sortable: true,
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{value}</span>
        </div>
      )
    },
    {
      key: "phone",
      label: "Телефон",
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono">{value}</span>
        </div>
      )
    },
    {
      key: "result",
      label: "Результат",
      render: (value: string) => (
        <Badge variant="secondary" className={getResultBadgeColor(value)}>
          {value}
        </Badge>
      )
    },
    {
      key: "duration",
      label: "Длительность",
      render: (value: number) => (
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono">{formatDuration(value)}</span>
        </div>
      )
    },
    {
      key: "callDate",
      label: "Дата звонка",
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString('ru-RU')
    },
    {
      key: "syncStatus",
      label: "Синхронизация",
      render: (value: string) => (
        <div className="flex items-center space-x-2">
          {getSyncStatusIcon(value)}
          <span className={`status-indicator ${
            value === 'synced' ? 'status-connected' :
            value === 'failed' ? 'status-disconnected' :
            'status-pending'
          }`}>
            {getSyncStatusLabel(value)}
          </span>
        </div>
      )
    }
  ];

  if (callResultsLoading) {
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Результаты прозвонов</h1>
          <p className="text-muted-foreground mt-1">
            Управление результатами звонков и их синхронизация
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Добавить результат
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить результат прозвона</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="contactName">Имя контакта</Label>
                  <Input
                    id="contactName"
                    value={newCallResult.contactName}
                    onChange={(e) => setNewCallResult({
                      ...newCallResult,
                      contactName: e.target.value
                    })}
                    placeholder="Имя Фамилия"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={newCallResult.phone}
                    onChange={(e) => setNewCallResult({
                      ...newCallResult,
                      phone: e.target.value
                    })}
                    placeholder="+7 (999) 123-45-67"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="result">Результат</Label>
                  <Select
                    value={newCallResult.result}
                    onValueChange={(value) => setNewCallResult({
                      ...newCallResult,
                      result: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите результат" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Заинтересован">Заинтересован</SelectItem>
                      <SelectItem value="Не интересует">Не интересует</SelectItem>
                      <SelectItem value="Не отвечает">Не отвечает</SelectItem>
                      <SelectItem value="Недозвон">Недозвон</SelectItem>
                      <SelectItem value="Отказ">Отказ</SelectItem>
                      <SelectItem value="Перезвонить позже">Перезвонить позже</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Длительность (секунды)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newCallResult.duration}
                    onChange={(e) => setNewCallResult({
                      ...newCallResult,
                      duration: parseInt(e.target.value) || 0
                    })}
                    min="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="callDate">Дата и время звонка</Label>
                  <Input
                    id="callDate"
                    type="datetime-local"
                    value={newCallResult.callDate}
                    onChange={(e) => setNewCallResult({
                      ...newCallResult,
                      callDate: e.target.value
                    })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    type="submit" 
                    disabled={addCallResultMutation.isPending}
                    className="gradient-primary hover:opacity-90"
                  >
                    {addCallResultMutation.isPending ? "Добавление..." : "Добавить"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowAddDialog(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
              <Label>Статус синхронизации</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="synced">Синхронизировано</SelectItem>
                  <SelectItem value="failed">Ошибка</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Результат</Label>
              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger>
                  <SelectValue placeholder="Все результаты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все результаты</SelectItem>
                  <SelectItem value="заинтересован">Заинтересован</SelectItem>
                  <SelectItem value="не интересует">Не интересует</SelectItem>
                  <SelectItem value="не отвечает">Не отвечает</SelectItem>
                  <SelectItem value="отказ">Отказ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilterStatus("all");
                  setFilterResult("all");
                }}
              >
                Сбросить фильтры
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список результатов</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredData}
            columns={columns}
            loading={callResultsLoading}
            emptyMessage="Нет результатов прозвонов. Добавьте первый результат."
          />
        </CardContent>
      </Card>
    </div>
  );
}

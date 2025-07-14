import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";


import { useAuthRedirect, isUnauthorizedError, handleUnauthorizedError } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import RuleConstructor from "@/components/RuleConstructor";
import DataTable from "@/components/DataTable";
import { Plus, Edit, Play, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function RuleBuilder() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConstructor, setShowConstructor] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Fetch rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ['/api/sync-rules'],
    retry: false,
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      await apiRequest('/api/sync-rules', 'POST', rule);
    },
    onSuccess: () => {
      toast({
        title: "Правило создано",
        description: "Новое правило синхронизации успешно создано",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-rules'] });
      setShowConstructor(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось создать правило",
        variant: "destructive",
      });
    },
  });

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, rule }: { id: number; rule: any }) => {
      await apiRequest(`/api/sync-rules/${id}`, 'PUT', rule);
    },
    onSuccess: () => {
      toast({
        title: "Правило обновлено",
        description: "Правило синхронизации успешно обновлено",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-rules'] });
      setEditingRule(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось обновить правило",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/sync-rules/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Правило удалено",
        description: "Правило синхронизации успешно удалено",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sync-rules'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError(error, toast);
        return;
      }
      toast({
        title: "Ошибка",
        description: "Не удалось удалить правило",
        variant: "destructive",
      });
    },
  });



  const handleCreateRule = (rule: any) => {
    createRuleMutation.mutate(rule);
  };

  const handleUpdateRule = (rule: any) => {
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, rule });
    }
  };

  const handleDeleteRule = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить это правило?")) {
      deleteRuleMutation.mutate(id);
    }
  };

  const handleTestRule = (rule: any) => {
    toast({
      title: "Тестирование правила",
      description: "Функция тестирования правил будет реализована позже",
    });
  };

  const toggleRuleStatus = (rule: any) => {
    updateRuleMutation.mutate({
      id: rule.id,
      rule: { ...rule, isActive: !rule.isActive }
    });
  };

  const columns = [
    {
      key: "name",
      label: "Название",
      sortable: true,
      render: (value: string, row: any) => (
        <div>
          <div className="font-medium text-foreground">{value}</div>
          {row.description && (
            <div className="text-sm text-muted-foreground">{row.description}</div>
          )}
        </div>
      )
    },
    {
      key: "webhookSource",
      label: "Источник",
      render: (value: string) => (
        <div className="text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'amocrm' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          }`}>
            {value === 'amocrm' ? 'AmoCRM' : 'LPTracker'}
          </span>
        </div>
      )
    },
    {
      key: "conditions",
      label: "Условия",
      render: (value: any) => (
        <div className="text-sm text-muted-foreground">
          {value?.rules?.length || 0} условий
        </div>
      )
    },
    {
      key: "actions",
      label: "Действия",
      render: (value: any) => (
        <div className="text-sm text-muted-foreground">
          {value?.list?.length || 0} действий
        </div>
      )
    },
    {
      key: "isActive",
      label: "Статус",
      render: (value: boolean) => (
        <div className={`status-indicator ${value ? 'status-connected' : 'status-disconnected'}`}>
          {value ? "Активно" : "Неактивно"}
        </div>
      )
    },
    {
      key: "executionCount",
      label: "Выполнено",
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{value || 0} раз</span>
      )
    },
    {
      key: "createdAt",
      label: "Создано",
      sortable: true
    },
    {
      key: "actions_column",
      label: "Действия",
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingRule(row)}
            className="text-primary hover:text-primary/80"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleRuleStatus(row)}
            className={row.isActive ? "text-yellow-500 hover:text-yellow-600" : "text-green-500 hover:text-green-600"}
          >
            {row.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTestRule(row)}
            className="text-blue-500 hover:text-blue-600"
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteRule(row.id)}
            className="text-destructive hover:text-destructive/80"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  if (rulesLoading) {
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
          <h1 className="text-3xl font-bold">Конструктор правил</h1>
          <p className="text-muted-foreground mt-1">
            Создание и управление правилами синхронизации
          </p>
        </div>
        <Button
          onClick={() => setShowConstructor(true)}
          className="gradient-primary hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Новое правило
        </Button>
      </div>

      {/* Rule Constructor */}
      {(showConstructor || editingRule) && (
        <RuleConstructor
          initialRule={editingRule}
          isEditing={!!editingRule}
          onSave={editingRule ? handleUpdateRule : handleCreateRule}
          onTest={handleTestRule}
        />
      )}

      {(showConstructor || editingRule) && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowConstructor(false);
              setEditingRule(null);
            }}
          >
            Отменить
          </Button>
        </div>
      )}

      {/* Rules Table - скрываем при создании/редактировании */}
      {!showConstructor && !editingRule && (
        <div className="space-y-6">
          {/* Статистика правил */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Всего правил</p>
                    <p className="text-2xl font-bold">{rules?.length || 0}</p>
                  </div>
                  <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Активных</p>
                    <p className="text-2xl font-bold text-green-600">
                      {rules?.filter(rule => rule.isActive).length || 0}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Неактивных</p>
                    <p className="text-2xl font-bold text-gray-500">
                      {rules?.filter(rule => !rule.isActive).length || 0}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-gray-500/10 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Список правил */}
          <Card>
            <CardHeader>
              <CardTitle>Список правил</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={rules}
                columns={columns}
                loading={rulesLoading}
                emptyMessage="Нет созданных правил. Создайте первое правило."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

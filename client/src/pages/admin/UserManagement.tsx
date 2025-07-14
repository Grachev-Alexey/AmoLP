import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Edit, Trash2, Shield, User, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/AdminPageHeader";
import DataTable from "@/components/DataTable";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingLpTracker, setEditingLpTracker] = useState<any>(null);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: lpTrackerSettings } = useQuery({
    queryKey: ["/api/admin/lptracker-user-settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest("/api/admin/users", "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Успешно",
        description: "Пользователь создан",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать пользователя",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: any) => {
      return apiRequest(`/api/admin/users/${id}`, "PATCH", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({
        title: "Успешно",
        description: "Пользователь обновлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить пользователя",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/users/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Успешно",
        description: "Пользователь удален",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить пользователя",
        variant: "destructive",
      });
    },
  });

  const updateLpTrackerMutation = useMutation({
    mutationFn: async ({ userId, projectId }: any) => {
      return apiRequest(`/api/admin/users/${userId}/lptracker`, "POST", { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lptracker-user-settings"] });
      setEditingLpTracker(null);
      toast({
        title: "Успешно",
        description: "ID проекта LPTracker обновлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить ID проекта LPTracker",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const userData = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      role: formData.get("role"),
    };
    createUserMutation.mutate(userData);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const userData = {
      id: editingUser.id,
      username: formData.get("username"),
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      role: formData.get("role"),
    };
    updateUserMutation.mutate(userData);
  };

  const handleUpdateLpTracker = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const projectId = formData.get("projectId") as string;
    updateLpTrackerMutation.mutate({
      userId: editingLpTracker.id,
      projectId,
    });
  };

  const getUserLpTrackerSettings = (userId: string) => {
    return (lpTrackerSettings as any)?.find((setting: any) => setting.userId === userId);
  };

  const userColumns = [
    {
      key: 'username',
      label: 'Имя пользователя',
      sortable: true,
      render: (value: string, row: any) => (
        <div className="flex items-center gap-2">
          {row.role === "superuser" ? (
            <Shield className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="font-medium text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">
              {row.firstName} {row.lastName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value: string) => (
        <span className="text-foreground">{value || "—"}</span>
      ),
    },
    {
      key: 'role',
      label: 'Роль',
      render: (value: string) => (
        <Badge variant={value === 'superuser' ? 'default' : 'secondary'}>
          {value === 'superuser' ? 'Администратор' : 'Пользователь'}
        </Badge>
      ),
    },
    {
      key: 'lptracker_project',
      label: 'LPTracker ID',
      render: (value: any, row: any) => (
        <div className="flex items-center gap-2">
          {row.role !== "superuser" && (
            <>
              <span className="text-sm text-foreground">
                {getUserLpTrackerSettings(row.id)?.projectId || "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingLpTracker(row)}
              >
                <Zap className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Дата регистрации',
      sortable: true,
      render: (value: string) => (
        <span className="text-foreground">
          {new Date(value).toLocaleDateString("ru-RU")}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Действия',
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingUser(row)}
          >
            <Edit className="w-3 h-3 mr-1" />
            Изменить
          </Button>
          {row.role !== 'superuser' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteUserMutation.mutate(row.id)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Удалить
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Users}
        title="Управление пользователями"
        description="Создание, редактирование и удаление пользователей системы"
      >
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Создать пользователя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать нового пользователя</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="username">Имя пользователя</Label>
                <Input id="username" name="username" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="password">Пароль</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <div>
                <Label htmlFor="firstName">Имя</Label>
                <Input id="firstName" name="firstName" />
              </div>
              <div>
                <Label htmlFor="lastName">Фамилия</Label>
                <Input id="lastName" name="lastName" />
              </div>
              <div>
                <Label htmlFor="role">Роль</Label>
                <Select name="role" defaultValue="user">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Пользователь</SelectItem>
                    <SelectItem value="superuser">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </AdminPageHeader>

      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Пользователи системы</CardTitle>
          <CardDescription className="text-muted-foreground">
            Управление учетными записями и настройками пользователей
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={Array.isArray(users) ? users : []}
            columns={userColumns}
            searchable={true}
            pagination={true}
            pageSize={10}
            emptyMessage="Нет пользователей для отображения"
            loading={usersLoading}
          />
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <Label htmlFor="edit-username">Имя пользователя</Label>
                <Input
                  id="edit-username"
                  name="username"
                  defaultValue={editingUser.username}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  defaultValue={editingUser.email}
                />
              </div>
              <div>
                <Label htmlFor="edit-firstName">Имя</Label>
                <Input
                  id="edit-firstName"
                  name="firstName"
                  defaultValue={editingUser.firstName}
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Фамилия</Label>
                <Input
                  id="edit-lastName"
                  name="lastName"
                  defaultValue={editingUser.lastName}
                />
              </div>
              <div>
                <Label htmlFor="edit-role">Роль</Label>
                <Select name="role" defaultValue={editingUser.role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Пользователь</SelectItem>
                    <SelectItem value="superuser">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit LPTracker Dialog */}
      <Dialog open={!!editingLpTracker} onOpenChange={() => setEditingLpTracker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройка LPTracker для пользователя</DialogTitle>
          </DialogHeader>
          {editingLpTracker && (
            <form onSubmit={handleUpdateLpTracker} className="space-y-4">
              <div>
                <Label>Пользователь</Label>
                <p className="text-sm text-muted-foreground">
                  {editingLpTracker.username}
                </p>
              </div>
              <div>
                <Label htmlFor="projectId">ID проекта LPTracker</Label>
                <Input
                  id="projectId"
                  name="projectId"
                  defaultValue={getUserLpTrackerSettings(editingLpTracker.id)?.projectId || ""}
                  placeholder="Введите ID проекта"
                  required
                />
              </div>
              <Button type="submit" disabled={updateLpTrackerMutation.isPending}>
                {updateLpTrackerMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
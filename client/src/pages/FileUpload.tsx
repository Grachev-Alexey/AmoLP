import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useAuthRedirect,
  isUnauthorizedError,
  handleUnauthorizedError,
} from "@/lib/auth";

import { apiRequest } from "@/lib/queryClient";
import DataTable from "@/components/DataTable";
import {
  Upload,
  File,
  X,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

export default function FileUpload() {
  useAuthRedirect();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Fetch uploads
  const { data: uploads = [], isLoading: uploadsLoading } = useQuery({
    queryKey: ["/api/file-uploads"],
    retry: false,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/file-uploads", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    },
    onSuccess: () => {
      toast({
        title: "Файл загружен",
        description: "Файл успешно загружен и поставлен в очередь на обработку",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/file-uploads"] });
      setSelectedFiles([]);
    },
    onError: (error) => {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить файл",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(
      (file) =>
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "text/csv" ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".csv"),
    );

    if (validFiles.length !== files.length) {
      toast({
        title: "Недопустимые файлы",
        description: "Поддерживаются только файлы .xlsx и .csv",
        variant: "destructive",
      });
    }

    setSelectedFiles(validFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  };

  const handleUpload = () => {
    selectedFiles.forEach((file) => {
      uploadMutation.mutate(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((files) => files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "processing":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const columns = [
    {
      key: "originalName",
      label: "Файл",
      sortable: true,
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "size",
      label: "Размер",
      render: (value: number) => formatFileSize(value),
    },
    {
      key: "status",
      label: "Статус",
      render: (value: string, row: any) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(value)}
          <span
            className={`status-indicator ${
              value === "completed"
                ? "status-connected"
                : value === "failed"
                  ? "status-disconnected"
                  : "status-pending"
            }`}
          >
            {value === "completed"
              ? "Завершено"
              : value === "failed"
                ? "Ошибка"
                : value === "processing"
                  ? "Обработка"
                  : "Ожидает"}
          </span>
        </div>
      ),
    },
    {
      key: "processedRecords",
      label: "Обработано",
      render: (value: number, row: any) => (
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {value || 0} / {row.totalRecords || 0}
          </div>
          {row.totalRecords > 0 && (
            <Progress
              value={((value || 0) / row.totalRecords) * 100}
              className="h-2 w-24"
            />
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Дата загрузки",
      sortable: true,
    },
    {
      key: "actions_column",
      label: "Действия",
      render: (value: any, row: any) => (
        <div className="flex items-center space-x-2">
          {row.status === "completed" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          {row.status === "failed" && row.errorMessage && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive/80"
              onClick={() =>
                toast({
                  title: "Ошибка обработки",
                  description: row.errorMessage,
                  variant: "destructive",
                })
              }
            >
              <AlertCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (uploadsLoading) {
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
          <h1 className="text-3xl font-bold">Загрузка контактов</h1>
          <p className="text-muted-foreground mt-1">
            Массовая загрузка и обработка контактов из Excel файлов
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Загрузить новый файл</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Перетащите файлы сюда
            </h3>
            <p className="text-muted-foreground mb-4">
              или нажмите для выбора файлов
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
            >
              Выбрать файлы
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Поддерживаются файлы: .xlsx, .csv (максимум 10MB)
            </p>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="font-medium">Выбранные файлы:</h4>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <File className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end">
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="gradient-primary hover:opacity-90"
                >
                  {uploadMutation.isPending ? "Загрузка..." : "Загрузить файлы"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle>История загрузок</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={uploads as any[]}
            columns={columns}
            loading={uploadsLoading}
            emptyMessage="Нет загруженных файлов. Загрузите первый файл."
          />
        </CardContent>
      </Card>
    </div>
  );
}

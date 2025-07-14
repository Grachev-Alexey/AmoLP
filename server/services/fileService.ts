import { IStorage } from "../storage";
import { LogService } from "./logService";
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export class FileService {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  async processFile(userId: string, file: Express.Multer.File): Promise<any> {
    try {
      // Создаем запись о загрузке файла
      const fileUpload = await this.storage.createFileUpload({
        userId,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        status: 'pending',
        processedRecords: 0,
        totalRecords: 0,
      });

      await this.logService.log(userId, 'info', 'Файл загружен, начинается обработка', { file: file.originalname }, 'upload');

      // Обрабатываем файл в фоновом режиме
      this.processFileInBackground(userId, fileUpload.id, file.path);

      return fileUpload;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при загрузке файла', { error }, 'upload');
      throw error;
    }
  }

  private async processFileInBackground(userId: string, fileUploadId: number, filePath: string): Promise<void> {
    try {
      await this.storage.updateFileUpload(fileUploadId, { status: 'processing' });

      // Читаем файл
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      await this.storage.updateFileUpload(fileUploadId, { 
        totalRecords: data.length,
        status: 'processing'
      });

      // Обрабатываем каждую запись
      let processedCount = 0;
      for (const record of data) {
        try {
          // Здесь можно добавить логику обработки каждой записи
          // Например, создание контактов в AmoCRM
          
          processedCount++;
          
          // Обновляем прогресс каждые 10 записей
          if (processedCount % 10 === 0) {
            await this.storage.updateFileUpload(fileUploadId, { 
              processedRecords: processedCount 
            });
          }
        } catch (recordError) {
          await this.logService.log(userId, 'warning', 'Ошибка при обработке записи', { 
            error: recordError, 
            record 
          }, 'upload');
        }
      }

      // Завершаем обработку
      await this.storage.updateFileUpload(fileUploadId, { 
        status: 'completed',
        processedRecords: processedCount
      });

      await this.logService.log(userId, 'info', 'Обработка файла завершена', { 
        processedRecords: processedCount,
        totalRecords: data.length
      }, 'upload');

      // Удаляем временный файл
      fs.unlinkSync(filePath);
    } catch (error) {
      await this.storage.updateFileUpload(fileUploadId, { 
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      await this.logService.log(userId, 'error', 'Ошибка при обработке файла', { error }, 'upload');
      
      // Удаляем временный файл в случае ошибки
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        // Игнорируем ошибки удаления
      }
    }
  }

  async getUploadProgress(fileUploadId: number): Promise<any> {
    const upload = await this.storage.getFileUpload(fileUploadId);
    if (!upload) {
      throw new Error('Файл не найден');
    }

    return {
      status: upload.status,
      processedRecords: upload.processedRecords || 0,
      totalRecords: upload.totalRecords || 0,
      progress: (upload.totalRecords || 0) > 0 ? ((upload.processedRecords || 0) / (upload.totalRecords || 0)) * 100 : 0,
      errorMessage: upload.errorMessage,
    };
  }
}

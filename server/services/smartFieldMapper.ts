import { IStorage } from '../storage';
import { LogService } from './logService';

interface FieldMappingResult {
  contactFields: any;
  leadFields: any;
  customFields: any;
  notes: any[];
  tasks: any[];
}

export class SmartFieldMapper {
  private storage: IStorage;
  private logService: LogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  /**
   * Маппинг полей с использованием пользовательских настроек маппирования
   * Пользователь сам указывает, в какую сущность (контакт/лид) и в какое поле записывать данные
   */
  async smartMapFields(userId: string, fieldMappings: any, sourceData: any, targetCrm: 'amocrm' | 'lptracker'): Promise<FieldMappingResult> {
    const result: FieldMappingResult = {
      contactFields: {},
      leadFields: {},
      customFields: {},
      notes: [],
      tasks: []
    };

    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      return result;
    }

    await this.logService.log(userId, 'info', `Smart Field Mapper - Начинаем маппирование для ${targetCrm}`, { 
      fieldMappings,
      sourceDataKeys: Object.keys(sourceData || {}),
      hasContact: !!(sourceData && sourceData.contact),
      hasContactFields: !!(sourceData && sourceData.contact && sourceData.contact.fields),
      contactFieldsLength: sourceData && sourceData.contact && sourceData.contact.fields ? sourceData.contact.fields.length : 0
    }, 'smart_mapper');

    // Обрабатываем каждое маппирование
    for (const [sourceField, targetMapping] of Object.entries(fieldMappings)) {
      if (!sourceField || !targetMapping) continue;

      // Получаем значение из исходных данных
      const sourceValue = this.extractSourceValue(sourceField, sourceData);
      

      
      if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
        await this.logService.log(userId, 'warning', `Smart Field Mapper - Пропускаем поле с пустым значением`, { 
          sourceField,
          sourceValue
        }, 'smart_mapper');
        continue;
      }

      // Существующий формат: простой маппинг sourceField -> targetFieldId
      const targetFieldId = targetMapping as string;
      
      // Применяем маппирование с использованием существующей логики
      await this.applyDirectFieldMapping(result, sourceField, targetFieldId, sourceValue, targetCrm, userId);

      await this.logService.log(userId, 'info', `Smart Field Mapper - Поле успешно замаппировано`, { 
        sourceField,
        targetFieldId,
        sourceValue,
        targetCrm
      }, 'smart_mapper');
    }

    await this.logService.log(userId, 'info', `Smart Field Mapper - Результат маппирования`, { 
      contactFieldsCount: Object.keys(result.contactFields).length,
      leadFieldsCount: Object.keys(result.leadFields).length,
      customFieldsCount: Object.keys(result.customFields).length,
      result
    }, 'smart_mapper');

    return result;
  }



  /**
   * Применяет прямое маппирование поля (существующий формат)
   */
  private async applyDirectFieldMapping(result: FieldMappingResult, sourceField: string, targetFieldId: string, sourceValue: any, targetCrm: 'amocrm' | 'lptracker', userId: string): Promise<void> {
    // Определяем тип поля по targetFieldId
    const fieldInfo = await this.determineFieldInfo(targetFieldId, targetCrm, userId);
    
    if (!fieldInfo) {
      await this.logService.log(userId, 'warning', `Smart Field Mapper - Не удалось определить тип поля`, { 
        sourceField,
        targetFieldId,
        targetCrm
      }, 'smart_mapper');
      return;
    }

    // Применяем маппирование в зависимости от типа поля
    if (fieldInfo.isStandard) {
      await this.applyStandardFieldMapping(result, fieldInfo.standardType!, sourceValue, targetCrm, userId);
    } else {
      await this.applyCustomFieldMapping(result, fieldInfo.entity!, targetFieldId, sourceValue, targetCrm);
    }
  }

  /**
   * Определяет информацию о поле по его ID
   */
  private async determineFieldInfo(targetFieldId: string, targetCrm: 'amocrm' | 'lptracker', userId: string): Promise<{
    isStandard: boolean;
    standardType?: 'name' | 'phone' | 'email' | 'price' | 'note' | 'task';
    entity?: 'contact' | 'lead';
    action?: 'note' | 'task';
  } | null> {
    // Стандартные поля
    const standardFields: Record<string, {
      isStandard: boolean;
      standardType: 'name' | 'phone' | 'email' | 'price' | 'note' | 'task';
      action?: 'note' | 'task';
    }> = {
      'name': { isStandard: true, standardType: 'name' },
      'phone': { isStandard: true, standardType: 'phone' },
      'email': { isStandard: true, standardType: 'email' },
      'first_name': { isStandard: true, standardType: 'name' },
      'last_name': { isStandard: true, standardType: 'name' },
      'price': { isStandard: true, standardType: 'price' },
      'note': { isStandard: true, standardType: 'note', action: 'note' },
      'task': { isStandard: true, standardType: 'task', action: 'task' }
    };

    if (standardFields[targetFieldId]) {
      return standardFields[targetFieldId];
    }

    // Кастомные поля - используем метаданные для определения entity
    if (/^\d+$/.test(targetFieldId)) {
      const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
      if (metadata) {
        if (targetCrm === 'amocrm') {
          const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
          const leadFields = metadata.leadFields?._embedded?.custom_fields || [];

          const isContactField = contactFields.some((field: any) => field.id == targetFieldId);
          const isLeadField = leadFields.some((field: any) => field.id == targetFieldId);

          if (isContactField) return { isStandard: false, entity: 'contact' };
          if (isLeadField) return { isStandard: false, entity: 'lead' };
        } else {
          const contactFields = metadata.contactFields?.result || [];
          const customFields = metadata.customFields?.result || [];

          const isContactField = contactFields.some((field: any) => field.id == targetFieldId);
          const isCustomField = customFields.some((field: any) => field.id == targetFieldId);

          if (isContactField) return { isStandard: false, entity: 'contact' };
          if (isCustomField) return { isStandard: false, entity: 'lead' };
        }
      }
    }

    return null;
  }

  /**
   * Применяет маппирование стандартного поля
   */
  private async applyStandardFieldMapping(result: FieldMappingResult, standardType: string, sourceValue: any, targetCrm: 'amocrm' | 'lptracker', userId: string): Promise<void> {
    if (standardType === 'name') {
      result.contactFields.name = sourceValue;
    } else if (standardType === 'price') {
      result.leadFields.price = sourceValue;
    } else if (standardType === 'note') {
      // Создаем примечание
      result.notes.push({
        note_type: 'common',
        text: sourceValue
      });
    } else if (standardType === 'task') {
      // Создаем задачу
      result.tasks.push({
        text: sourceValue,
        task_type_id: 1, // Звонок по умолчанию
        complete_till: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) // Завтра
      });
    } else if (standardType === 'phone') {
      if (targetCrm === 'lptracker') {
        result.contactFields.phone = sourceValue;
      } else {
        // AmoCRM - находим ID поля телефона из метаданных
        const phoneFieldId = await this.findStandardFieldId(userId, targetCrm, 'phone');
        if (phoneFieldId) {
          if (!result.contactFields.custom_fields_values) {
            result.contactFields.custom_fields_values = [];
          }
          result.contactFields.custom_fields_values.push({
            field_id: phoneFieldId,
            values: [{ value: sourceValue, enum_code: 'WORK' }]
          });
        }
      }
    } else if (standardType === 'email') {
      if (targetCrm === 'lptracker') {
        result.contactFields.email = sourceValue;
      } else {
        // AmoCRM - находим ID поля email из метаданных
        const emailFieldId = await this.findStandardFieldId(userId, targetCrm, 'email');
        if (emailFieldId) {
          if (!result.contactFields.custom_fields_values) {
            result.contactFields.custom_fields_values = [];
          }
          result.contactFields.custom_fields_values.push({
            field_id: emailFieldId,
            values: [{ value: sourceValue, enum_code: 'WORK' }]
          });
        }
      }
    }
  }

  /**
   * Применяет маппирование кастомного поля
   */
  private async applyCustomFieldMapping(result: FieldMappingResult, entity: string, targetFieldId: string, sourceValue: any, targetCrm: 'amocrm' | 'lptracker'): Promise<void> {
    if (entity === 'contact') {
      if (targetCrm === 'lptracker') {
        result.contactFields[targetFieldId] = sourceValue;
      } else {
        // AmoCRM
        if (!result.contactFields.custom_fields_values) {
          result.contactFields.custom_fields_values = [];
        }
        result.contactFields.custom_fields_values.push({
          field_id: parseInt(targetFieldId),
          values: [{ value: sourceValue }]
        });
      }
    } else if (entity === 'lead') {
      if (targetCrm === 'lptracker') {
        result.leadFields[targetFieldId] = sourceValue;
      } else {
        // AmoCRM
        if (!result.leadFields.custom_fields_values) {
          result.leadFields.custom_fields_values = [];
        }
        result.leadFields.custom_fields_values.push({
          field_id: parseInt(targetFieldId),
          values: [{ value: sourceValue }]
        });
      }
    }
  }

  /**
   * Применяет маппирование поля к результату (новый формат - пока не используется)
   */
  private async applyFieldMapping(result: FieldMappingResult, mapping: any, sourceValue: any, targetCrm: 'amocrm' | 'lptracker', userId: string): Promise<void> {
    const { entity, field, type } = mapping;

    if (entity === 'contact') {
      if (type === 'standard') {
        // Стандартные поля контакта
        if (field === 'name') {
          result.contactFields.name = sourceValue;
        } else if (field === 'phone') {
          if (targetCrm === 'lptracker') {
            result.contactFields.phone = sourceValue;
          } else {
            // AmoCRM - находим ID поля телефона из метаданных
            const phoneFieldId = await this.findStandardFieldId(userId, targetCrm, 'phone');
            if (phoneFieldId) {
              if (!result.contactFields.custom_fields_values) {
                result.contactFields.custom_fields_values = [];
              }
              result.contactFields.custom_fields_values.push({
                field_id: phoneFieldId,
                values: [{ value: sourceValue, enum_code: 'WORK' }]
              });
            }
          }
        } else if (field === 'email') {
          if (targetCrm === 'lptracker') {
            result.contactFields.email = sourceValue;
          } else {
            // AmoCRM - находим ID поля email из метаданных
            const emailFieldId = await this.findStandardFieldId(userId, targetCrm, 'email');
            if (emailFieldId) {
              if (!result.contactFields.custom_fields_values) {
                result.contactFields.custom_fields_values = [];
              }
              result.contactFields.custom_fields_values.push({
                field_id: emailFieldId,
                values: [{ value: sourceValue, enum_code: 'WORK' }]
              });
            }
          }
        }
      } else if (type === 'custom') {
        // Кастомные поля контакта
        if (targetCrm === 'lptracker') {
          result.contactFields[field] = sourceValue;
        } else {
          // AmoCRM
          if (!result.contactFields.custom_fields_values) {
            result.contactFields.custom_fields_values = [];
          }
          result.contactFields.custom_fields_values.push({
            field_id: parseInt(field),
            values: [{ value: sourceValue }]
          });
        }
      }
    } else if (entity === 'lead') {
      if (type === 'standard') {
        // Стандартные поля лида
        if (field === 'name') {
          result.leadFields.name = sourceValue;
        } else if (field === 'price') {
          result.leadFields.price = sourceValue;
        }
      } else if (type === 'custom') {
        // Кастомные поля лида
        if (targetCrm === 'lptracker') {
          result.leadFields[field] = sourceValue;
        } else {
          // AmoCRM
          if (!result.leadFields.custom_fields_values) {
            result.leadFields.custom_fields_values = [];
          }
          result.leadFields.custom_fields_values.push({
            field_id: parseInt(field),
            values: [{ value: sourceValue }]
          });
        }
      }
    }
  }

  private async getTargetCrmMetadata(userId: string, targetCrm: 'amocrm' | 'lptracker'): Promise<any> {
    try {
      if (targetCrm === 'amocrm') {
        const contactFields = await this.storage.getAmoCrmMetadata(userId, 'contacts_fields');
        const leadFields = await this.storage.getAmoCrmMetadata(userId, 'leads_fields');
        return {
          contactFields: contactFields?.data,
          leadFields: leadFields?.data
        };
      } else {
        const contactFields = await this.storage.getLpTrackerMetadata(userId, 'contact_fields');
        const customFields = await this.storage.getLpTrackerMetadata(userId, 'custom_fields');
        return {
          contactFields: contactFields?.data,
          customFields: customFields?.data
        };
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка получения метаданных`, { 
        error: (error as Error).message, 
        targetCrm 
      }, 'smart_mapper');
      return null;
    }
  }

  /**
   * Получает список доступных полей для маппирования
   */
  async getAvailableFields(userId: string, targetCrm: 'amocrm' | 'lptracker'): Promise<{
    contactFields: { standard: any[], custom: any[] },
    leadFields: { standard: any[], custom: any[] }
  }> {
    const result = {
      contactFields: { standard: [] as any[], custom: [] as any[] },
      leadFields: { standard: [] as any[], custom: [] as any[] }
    };

    // Стандартные поля контакта
    result.contactFields.standard = [
      { id: 'name', name: 'Имя контакта', type: 'standard' },
      { id: 'phone', name: 'Телефон', type: 'standard' },
      { id: 'email', name: 'Email', type: 'standard' }
    ];

    // Стандартные поля сделки + действия
    result.leadFields.standard = [
      { id: 'name', name: 'Название сделки', type: 'standard' },
      { id: 'price', name: 'Бюджет', type: 'standard' },
      { id: 'note', name: '📝 Примечание к сделке', type: 'action', description: 'Создать текстовое примечание' },
      { id: 'task', name: '📋 Задача', type: 'action', description: 'Создать задачу-напоминание' }
    ];

    try {
      const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
      
      if (metadata && targetCrm === 'amocrm') {
        // AmoCRM кастомные поля
        const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
        const leadFields = metadata.leadFields?._embedded?.custom_fields || [];

        result.contactFields.custom = contactFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom',
          code: field.code,
          field_type: field.type
        }));

        result.leadFields.custom = leadFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom',
          code: field.code,
          field_type: field.type
        }));
      } else if (metadata && targetCrm === 'lptracker') {
        // LPTracker кастомные поля
        const contactFields = metadata.contactFields?.result || [];
        const customFields = metadata.customFields?.result || [];

        result.contactFields.custom = contactFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom'
        }));

        result.leadFields.custom = customFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: 'custom'
        }));
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка получения доступных полей`, { 
        error: (error as Error).message,
        targetCrm
      }, 'smart_mapper');
    }

    return result;
  }

  private extractSourceValue(sourceField: string, sourceData: any): any {
    // Добавляем детальное логирование для отладки
    this.logService.log(undefined, 'info', 'Smart Field Mapper - Извлечение значения', {
      sourceField,
      hasContact: !!(sourceData && sourceData.contact),
      hasContactFields: !!(sourceData && sourceData.contact && sourceData.contact.fields),
      contactFieldsLength: sourceData && sourceData.contact && sourceData.contact.fields ? sourceData.contact.fields.length : 0,
      contactFieldsPreview: sourceData && sourceData.contact && sourceData.contact.fields ? sourceData.contact.fields.slice(0, 2) : []
    }, 'smart_mapper');

    // Стандартные поля
    const standardFields: { [key: string]: (data: any) => any } = {
      'name': (data) => data.leadDetails?.name || data.contactsDetails?.[0]?.name || data.name || '',
      'first_name': (data) => data.contactsDetails?.[0]?.first_name || data.first_name || '',
      'last_name': (data) => data.contactsDetails?.[0]?.last_name || data.last_name || '',
      'phone': (data) => this.extractPhoneFromContact(data.contactsDetails?.[0]) || data.phone || '',
      'email': (data) => this.extractEmailFromContact(data.contactsDetails?.[0]) || data.email || '',
      'deal_name': (data) => data.leadDetails?.name || data.deal_name || '',
      'price': (data) => data.leadDetails?.price || data.price || 0
    };

    if (standardFields[sourceField]) {
      return standardFields[sourceField](sourceData);
    }

    // Кастомные поля AmoCRM
    if (/^\d+$/.test(sourceField)) {
      const fieldId = parseInt(sourceField);
      
      // Поиск в лидах
      const leadCustomField = sourceData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id === fieldId);
      if (leadCustomField && leadCustomField.values && leadCustomField.values[0] && leadCustomField.values[0].value !== null) {
        return leadCustomField.values[0].value;
      }
      
      // Поиск в контактах
      const contactCustomField = sourceData.contactsDetails?.[0]?.custom_fields_values?.find((f: any) => f.field_id === fieldId);
      if (contactCustomField && contactCustomField.values && contactCustomField.values[0] && contactCustomField.values[0].value !== null) {
        return contactCustomField.values[0].value;
      }
      
      // Дополнительная проверка в исходных данных webhook (backup)
      if (sourceData.custom_fields && Array.isArray(sourceData.custom_fields)) {
        const customField = sourceData.custom_fields.find((f: any) => f.field_id === fieldId);
        if (customField && customField.values && customField.values[0] && customField.values[0].value !== null) {
          return customField.values[0].value;
        }
      }
      
      // Поиск в данных LPTracker
      if (sourceData.custom && Array.isArray(sourceData.custom)) {
        const customField = sourceData.custom.find((f: any) => f.id === fieldId);
        if (customField && customField.value !== null && customField.value !== undefined) {
          return customField.value;
        }
      }
      
      // Поиск в полях контакта LPTracker
      if (sourceData.contact && sourceData.contact.fields && Array.isArray(sourceData.contact.fields)) {
        const contactField = sourceData.contact.fields.find((f: any) => f.id === fieldId);
        if (contactField && contactField.value !== null && contactField.value !== undefined) {
          return contactField.value;
        }
      }
    }

    return '';
  }

  /**
   * Находит ID стандартного поля (phone, email) в метаданных CRM
   */
  private async findStandardFieldId(userId: string, targetCrm: 'amocrm' | 'lptracker', fieldType: 'phone' | 'email'): Promise<number | null> {
    if (targetCrm !== 'amocrm') return null;

    try {
      const metadata = await this.getTargetCrmMetadata(userId, targetCrm);
      if (!metadata) return null;

      const contactFields = metadata.contactFields?._embedded?.custom_fields || [];
      
      // Ищем поле по типу
      const standardField = contactFields.find((field: any) => {
        if (fieldType === 'phone') {
          return field.type === 'multitext' && field.code === 'PHONE';
        } else if (fieldType === 'email') {
          return field.type === 'multitext' && field.code === 'EMAIL';
        }
        return false;
      });

      if (standardField) {
        await this.logService.log(userId, 'info', `Smart Field Mapper - Найдено стандартное поле ${fieldType}`, { 
          fieldId: standardField.id,
          fieldName: standardField.name,
          fieldCode: standardField.code
        }, 'smart_mapper');
        return standardField.id;
      }
    } catch (error) {
      await this.logService.log(userId, 'error', `Smart Field Mapper - Ошибка поиска стандартного поля ${fieldType}`, { 
        error: (error as Error).message,
        targetCrm
      }, 'smart_mapper');
    }

    return null;
  }

  private extractPhoneFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const phoneField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'PHONE' || field.field_name === 'Телефон'
    );
    
    return phoneField?.values?.[0]?.value || '';
  }

  private extractEmailFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const emailField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'EMAIL' || field.field_name === 'Email'
    );
    
    return emailField?.values?.[0]?.value || '';
  }
}
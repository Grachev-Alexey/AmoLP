import { IStorage } from "../storage";
import { LogService } from "./logService";
import { AmoCrmService } from "./amoCrmService";
import { LpTrackerService } from "./lpTrackerService";
import { SmartFieldMapper } from "./smartFieldMapper";
import { PerformanceOptimizer } from "./performanceOptimizer";
import { webhookQueue } from "../config/queue";
import { cache } from "../config/redis";

export class WebhookService {
  private storage: IStorage;
  private logService: LogService;
  private amoCrmService: AmoCrmService;
  private lpTrackerService: LpTrackerService;
  private smartFieldMapper: SmartFieldMapper;
  private performanceOptimizer: PerformanceOptimizer;
  
  // TTL для дедупликации webhook (10 минут)
  private readonly WEBHOOK_DEDUP_TTL = 10 * 60;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
    this.amoCrmService = new AmoCrmService(storage);
    this.lpTrackerService = new LpTrackerService(storage);
    this.smartFieldMapper = new SmartFieldMapper(storage);
    this.performanceOptimizer = new PerformanceOptimizer(storage);
  }

  // Быстрые входные точки - добавляют в Bull Queue и возвращают управление
  async handleAmoCrmWebhook(payload: any): Promise<string> {
    try {
      const job = await webhookQueue.add('amocrm-webhook', {
        payload,
        timestamp: Date.now()
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50
      });

      await this.logService.info(undefined, 'AmoCRM Webhook добавлен в Bull Queue', { 
        jobId: job.id,
        payloadKeys: Object.keys(payload || {}),
        queueName: 'amocrm-webhook'
      }, 'webhook');

      return job.id.toString();
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка добавления AmoCRM webhook в Bull Queue', { 
        error: (error as Error).message, 
        payload 
      }, 'webhook');
      throw error;
    }
  }

  async handleLpTrackerWebhook(payload: any): Promise<string> {
    try {
      const job = await webhookQueue.add('lptracker-webhook', {
        payload,
        timestamp: Date.now()
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50
      });

      await this.logService.info(undefined, 'LPTracker Webhook добавлен в Bull Queue', { 
        jobId: job.id,
        payloadKeys: Object.keys(payload || {}),
        queueName: 'lptracker-webhook'
      }, 'webhook');

      return job.id.toString();
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка добавления LPTracker webhook в Bull Queue', { 
        error: (error as Error).message, 
        payload 
      }, 'webhook');
      throw error;
    }
  }

  // Получение статистики очередей для мониторинга
  async getQueueStats() {
    try {
      const { getQueueStats } = await import('../config/queue');
      return await getQueueStats();
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка получения статистики очередей', { 
        error: (error as Error).message 
      }, 'webhook');
      return {
        webhook: { waiting: 0, active: 0, completed: 0, failed: 0 },
        fileProcessing: { waiting: 0, active: 0, completed: 0, failed: 0 },
      };
    }
  }

  // Получение метрик производительности
  async getPerformanceMetrics() {
    return await this.performanceOptimizer.getPerformanceMetrics();
  }

  // Принудительная очистка кешей (для админа)
  clearCaches() {
    this.performanceOptimizer.clearAllCaches();
  }

  // Методы фактической обработки (вызываются из Bull Queue)
  async processAmoCrmWebhookDirect(payload: any): Promise<void> {
    try {
      await this.logService.info(undefined, 'AmoCRM Webhook - Начало обработки', { 
        payloadKeys: Object.keys(payload || {}),
        payloadType: typeof payload,
        payloadLength: JSON.stringify(payload).length,
        fullPayload: payload 
      }, 'webhook');

      // Извлекаем информацию о поддомене для идентификации клиента
      const subdomain = payload['account[subdomain]'];
      const accountId = payload['account[id]'];
      
      if (!subdomain) {
        await this.logService.warning(undefined, 'AmoCRM Webhook без поддомена', { payload }, 'webhook');
        return;
      }

      // Находим пользователя по поддомену
      const userId = await this.findUserBySubdomain(subdomain);
      if (!userId) {
        await this.logService.warning(undefined, `AmoCRM - Пользователь не найден для поддомена: ${subdomain}`, { 
          subdomain, payload 
        }, 'webhook');
        return;
      }

      // Извлекаем ID сделки из любого типа события
      let leadId = null;
      
      // Ищем ID сделки в различных форматах
      if (payload['leads[add][0][id]']) {
        leadId = payload['leads[add][0][id]'];
      } else if (payload['leads[status][0][id]']) {
        leadId = payload['leads[status][0][id]'];
      } else if (payload['leads[update][0][id]']) {
        leadId = payload['leads[update][0][id]'];
      } else if (payload['leads[delete][0][id]']) {
        leadId = payload['leads[delete][0][id]'];
      }
      
      if (!leadId) {
        await this.logService.warning(userId, 'AmoCRM - ID сделки не найден в вебхуке', { 
          subdomain,
          payload,
          availableKeys: Object.keys(payload)
        }, 'webhook');
        return;
      }

      // Получаем полную информацию о сделке через API
      try {
        const leadDetails = await this.getLeadDetails(userId, leadId);
        await this.logService.info(userId, `AmoCRM - Получена детальная информация о сделке ${leadId}`, { 
          leadDetails,
          originalPayload: payload
        }, 'webhook');

        // Получаем детали всех связанных контактов
        let contactsDetails = [];
        if (leadDetails._embedded?.contacts && leadDetails._embedded.contacts.length > 0) {
          for (const contact of leadDetails._embedded.contacts) {
            try {
              const contactDetails = await this.getContactDetails(userId, contact.id);
              contactsDetails.push(contactDetails);
              
              await this.logService.info(userId, `AmoCRM - Получена информация о контакте ${contact.id}`, { 
                contactDetails,
                isMainContact: contact.is_main,
                leadId
              }, 'webhook');
            } catch (error) {
              await this.logService.warning(userId, `AmoCRM - Не удалось получить данные контакта ${contact.id}`, { 
                error, contactId: contact.id, leadId 
              }, 'webhook');
            }
          }
        }

        // Проверяем правила пользователя и выполняем подходящие действия
        await this.processLeadRules(userId, leadId, leadDetails, contactsDetails, payload);

      } catch (error) {
        await this.logService.error(userId, `Ошибка получения данных сделки ${leadId}`, { 
          error, leadId, payload 
        }, 'webhook');
      }
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка при обработке webhook AmoCRM', { error, payload }, 'webhook');
      throw error;
    }
  }

  async processLpTrackerWebhookDirect(payload: any): Promise<void> {
    try {
      // LPTracker отправляет данные в формате { data: "JSON_STRING" }
      let webhookData;
      if (payload.data && typeof payload.data === 'string') {
        try {
          webhookData = JSON.parse(payload.data);
        } catch (parseError) {
          await this.logService.error(undefined, 'LPTracker - Ошибка парсинга данных', { 
            payload, parseError 
          }, 'webhook');
          return;
        }
      } else {
        webhookData = payload;
      }
      
      await this.logService.info(undefined, 'LPTracker Webhook - Детальный анализ', { 
        originalPayload: payload,
        parsedData: webhookData,
        projectId: webhookData.project_id,
        action: webhookData.action
      }, 'webhook');

      // Находим пользователя по project_id
      const projectId = webhookData.project_id;
      if (!projectId) {
        await this.logService.warning(undefined, 'LPTracker - Отсутствует project_id', { 
          webhookData 
        }, 'webhook');
        return;
      }

      // Находим пользователя с данным project_id
      const userId = await this.findUserByProjectId(projectId);
      if (!userId) {
        await this.logService.warning(undefined, `LPTracker - Пользователь не найден для проекта: ${projectId}`, { 
          projectId, webhookData 
        }, 'webhook');
        return;
      }

      await this.logService.info(userId, `LPTracker - Обработка вебхука для проекта ${projectId}`, { 
        projectId,
        action: webhookData.action,
        leadId: webhookData.id,
        stageName: webhookData.stage?.name,
        contactName: webhookData.contact?.name
      }, 'webhook');

      // Получаем правила пользователя с кешированием для производительности
      const syncRules = await this.performanceOptimizer.getCachedSyncRules(userId);
      
      // Обрабатываем вебхук через правила с умной фильтрацией
      for (const rule of syncRules) {
        try {
          // Проверяем условия правила
          if (this.checkConditions(rule.conditions, webhookData)) {
            
            const leadId = String(webhookData.id);
            const actionTimestamp = webhookData.action_timestamp;

            // Быстрая проверка дедупликации через Redis
            if (await this.isWebhookAlreadyProcessed(userId, leadId, rule.id, actionTimestamp)) {
              await this.logService.info(userId, `LPTracker - Правило "${rule.name}" уже обработано (Redis)`, { 
                ruleId: rule.id,
                ruleName: rule.name,
                leadId: webhookData.id,
                actionTimestamp
              }, 'webhook');
              continue;
            }

            // Умная проверка релевантности изменений
            if (!this.isWebhookRelevant(webhookData, rule)) {
              await this.logService.info(userId, `LPTracker - Правило "${rule.name}" пропущено: изменения не релевантны`, { 
                ruleId: rule.id,
                ruleName: rule.name,
                leadId: webhookData.id,
                updatedFields: webhookData.action_update_fields
              }, 'webhook');
              continue;
            }

            await this.logService.info(userId, `LPTracker - Правило "${rule.name}" применимо`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId: webhookData.id,
              actionTimestamp
            }, 'webhook');

            // Выполняем действия правила
            await this.executeActions(rule.actions, { ...webhookData, userId });
            
            // Используем Redis для быстрой дедупликации
            await this.markWebhookProcessedInRedis(userId, leadId, rule.id, actionTimestamp);
            
            // Увеличиваем счетчик выполнений правила
            await this.storage.incrementRuleExecution(rule.id);
          } else {
            await this.logService.info(userId, `LPTracker - Правило "${rule.name}" не применимо`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId: webhookData.id
            }, 'webhook');
          }
        } catch (ruleError) {
          await this.logService.error(userId, `LPTracker - Ошибка обработки правила "${rule.name}"`, { 
            ruleId: rule.id,
            error: ruleError,
            leadId: webhookData.id
          }, 'webhook');
        }
      }
      
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка при обработке webhook LPTracker', { error, payload }, 'webhook');
      throw error;
    }
  }

  // Вспомогательный метод для поиска пользователя по project_id LPTracker
  private async findUserByProjectId(projectId: number): Promise<string | null> {
    try {
      const allLpTrackerSettings = await this.storage.getAllLpTrackerSettings();
      
      for (const settings of allLpTrackerSettings) {
        if (settings.projectId === projectId.toString()) {
          return settings.userId;
        }
      }
      
      return null;
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка поиска пользователя по project_id', { error, projectId }, 'webhook');
      return null;
    }
  }

  // Вспомогательный метод для поиска пользователя по поддомену
  private async findUserBySubdomain(subdomain: string): Promise<string | null> {
    try {
      // Получаем всех пользователей и проверяем их настройки AmoCRM
      const { db } = await import('../db');
      const { users } = await import('../../shared/schema');
      const allUsers = await db.select().from(users);
      
      for (const user of allUsers) {
        const amoCrmSettings = await this.storage.getAmoCrmSettings(user.id);
        if (amoCrmSettings?.subdomain === subdomain) {
          return user.id;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Получение детальной информации о сделке через AmoCRM API
  private async getLeadDetails(userId: string, leadId: string): Promise<any> {
    try {
      const amoCrmSettings = await this.storage.getAmoCrmSettings(userId);
      if (!amoCrmSettings?.subdomain || !amoCrmSettings?.apiKey) {
        throw new Error('AmoCRM настройки не найдены');
      }

      const url = `https://${amoCrmSettings.subdomain}.amocrm.ru/api/v4/leads/${leadId}?with=contacts,companies,catalog_elements,loss_reason,source`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${amoCrmSettings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AmoCRM API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Получение детальной информации о контакте через AmoCRM API
  private async getContactDetails(userId: string, contactId: string): Promise<any> {
    try {
      const amoCrmSettings = await this.storage.getAmoCrmSettings(userId);
      if (!amoCrmSettings?.subdomain || !amoCrmSettings?.apiKey) {
        throw new Error('AmoCRM настройки не найдены');
      }

      const url = `https://${amoCrmSettings.subdomain}.amocrm.ru/api/v4/contacts/${contactId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${amoCrmSettings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AmoCRM Contact API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Современные методы дедупликации webhook через Redis
  private generateWebhookKey(userId: string, leadId: string, ruleId: number, timestamp?: number): string {
    return `webhook:${userId}:${leadId}:${ruleId}:${timestamp || 'default'}`;
  }

  private async isWebhookAlreadyProcessed(userId: string, leadId: string, ruleId: number, timestamp?: number): Promise<boolean> {
    const key = this.generateWebhookKey(userId, leadId, ruleId, timestamp);
    return await cache.exists(key);
  }

  private async markWebhookProcessedInRedis(userId: string, leadId: string, ruleId: number, timestamp?: number): Promise<void> {
    const key = this.generateWebhookKey(userId, leadId, ruleId, timestamp);
    await cache.setWithTTL(key, { processed: true, timestamp: Date.now() }, this.WEBHOOK_DEDUP_TTL);
  }

  /**
   * Умная проверка релевантности webhook на основе измененных полей
   * Обрабатываем только те webhook, которые действительно важны для правила
   */
  private isWebhookRelevant(webhookData: any, rule: any): boolean {
    // Если нет информации об измененных полях - обрабатываем
    if (!webhookData.action_update_fields || !Array.isArray(webhookData.action_update_fields)) {
      return true;
    }

    const updatedFields = webhookData.action_update_fields;
    
    // Всегда обрабатываем изменения этапа/статуса
    if (updatedFields.includes('stage') || updatedFields.includes('stage_id')) {
      return true;
    }

    // Всегда обрабатываем изменения оплат
    if (updatedFields.includes('payments')) {
      return true;
    }

    // Проверяем, затрагивают ли изменения поля, используемые в условиях правила
    if (rule.conditions?.rules) {
      for (const condition of rule.conditions.rules) {
        if (condition.field && condition.type?.includes('field_')) {
          // Проверяем, изменилось ли поле, которое используется в условии
          const fieldPattern = `custom.${condition.field}`;
          if (updatedFields.some((field: string) => field.includes(condition.field) || field === fieldPattern)) {
            return true;
          }
        }
      }
    }

    // Проверяем, затрагивают ли изменения поля из маппинга действий правила
    if (rule.actions?.list) {
      for (const action of rule.actions.list) {
        if (action.fieldMappings) {
          for (const [sourceField] of Object.entries(action.fieldMappings)) {
            const fieldPattern = `custom.${sourceField}`;
            if (updatedFields.some((field: string) => field.includes(sourceField) || field === fieldPattern)) {
              return true;
            }
          }
        }
      }
    }

    // Если изменения не касаются полей, используемых в правиле - пропускаем
    return false;
  }

  // Главный метод обработки правил для сделки
  private async processLeadRules(userId: string, leadId: string, leadDetails: any, contactsDetails: any[], originalPayload: any): Promise<void> {
    try {
      // Получаем правила пользователя только для AmoCRM
      const rules = await this.storage.getSyncRules(userId);
      const amoCrmRules = rules.filter(rule => rule.webhookSource === 'amocrm');
      const activeRules = amoCrmRules.filter(rule => rule.isActive);

      await this.logService.info(userId, `AmoCRM - Проверяем ${activeRules.length} активных правил для сделки ${leadId}`, { 
        leadId, 
        rulesCount: activeRules.length,
        leadName: leadDetails.name || 'Без названия'
      }, 'webhook');

      for (const rule of activeRules) {
        try {
          // Проверяем условия правила
          const eventData = {
            leadId,
            leadDetails,
            contactsDetails,
            webhookPayload: originalPayload,
            userId
          };

          // Детальное логирование для отладки
          await this.logService.info(userId, `AmoCRM - Проверяем правило "${rule.name}"`, { 
            ruleId: rule.id,
            ruleName: rule.name,
            leadId,
            conditions: rule.conditions,
            pipelineFromLead: leadDetails.pipeline_id,
            statusFromLead: leadDetails.status_id,
            pipelineFromPayload: originalPayload?.['leads[add][0][pipeline_id]'],
            statusFromPayload: originalPayload?.['leads[add][0][status_id]']
          }, 'webhook');

          if (this.checkConditions(rule.conditions, eventData)) {
            await this.logService.info(userId, `AmoCRM - Правило "${rule.name}" подходит для сделки ${leadId}`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId
            }, 'webhook');

            // Быстрая проверка дедупликации через Redis для AmoCRM
            const leadIdStr = String(leadId);
            if (await this.isWebhookAlreadyProcessed(userId, leadIdStr, rule.id)) {
              await this.logService.info(userId, `AmoCRM - Правило "${rule.name}" уже обработано (Redis)`, { 
                ruleId: rule.id,
                ruleName: rule.name,
                leadId
              }, 'webhook');
              continue;
            }

            // Выполняем действия правила
            await this.executeActions(rule.actions, eventData);
            
            // Отмечаем webhook как обработанный в Redis
            await this.markWebhookProcessedInRedis(userId, leadIdStr, rule.id);
            
            await this.storage.incrementRuleExecution(rule.id);
          } else {
            await this.logService.info(userId, `AmoCRM - Правило "${rule.name}" не подходит для сделки ${leadId}`, { 
              ruleId: rule.id,
              ruleName: rule.name,
              leadId
            }, 'webhook');
          }
        } catch (error) {
          await this.logService.error(userId, `Ошибка применения правила "${rule.name}" для сделки ${leadId}`, { 
            error, 
            ruleId: rule.id,
            leadId 
          }, 'webhook');
        }
      }
    } catch (error) {
      await this.logService.error(userId, `Ошибка обработки правил для сделки ${leadId}`, { 
        error, 
        leadId 
      }, 'webhook');
    }
  }

  private checkConditions(conditions: any, eventData: any): boolean {
    try {
      if (!conditions || !conditions.rules) {
        return false;
      }

      const operator = conditions.operator || 'AND';
      const results: boolean[] = conditions.rules.map((condition: any): boolean => {
        switch (condition.type) {
          case 'event_type':
            return eventData.type === condition.value;
          
          case 'pipeline':
            // Проверяем ID воронки из данных сделки
            const pipelineId = eventData.leadDetails?.pipeline_id || eventData.webhookPayload?.['leads[add][0][pipeline_id]'];
            return String(pipelineId) === String(condition.value);
          
          case 'status':
            // Проверяем ID статуса из данных сделки (AmoCRM) или LPTracker
            const statusId = eventData.leadDetails?.status_id || 
                           eventData.webhookPayload?.['leads[add][0][status_id]'] ||
                           eventData.stage_id || 
                           eventData.stage?.id;
            return String(statusId) === String(condition.value);
          
          case 'field_equals':
            // Для AmoCRM проверяем в custom_fields_values
            const fieldValue = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            if (fieldValue !== undefined) {
              return String(fieldValue) === String(condition.value);
            }
            
            // Для LPTracker проверяем в массиве custom
            const lpTrackerFieldValue = eventData.custom?.find((f: any) => f.id == condition.field)?.value;
            if (lpTrackerFieldValue !== undefined) {
              return String(lpTrackerFieldValue) === String(condition.value);
            }
            
            return false;
          
          case 'field_contains':
            // Для AmoCRM проверяем в custom_fields_values
            const fieldValueContains = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            if (fieldValueContains !== undefined) {
              return fieldValueContains?.includes(condition.value);
            }
            
            // Для LPTracker проверяем в массиве custom
            const lpTrackerField = eventData.custom?.find((f: any) => f.id == condition.field)?.value;
            if (lpTrackerField !== undefined) {
              return lpTrackerField?.includes(condition.value);
            }
            
            return false;
          
          case 'field_not_empty':
            // Для AmoCRM проверяем в custom_fields_values
            const fieldValueNotEmpty = eventData.leadDetails?.custom_fields_values?.find((f: any) => f.field_id == condition.field)?.values?.[0]?.value;
            if (fieldValueNotEmpty !== undefined) {
              return fieldValueNotEmpty != null && fieldValueNotEmpty !== '';
            }
            
            // Для LPTracker проверяем в массиве custom
            const lpTrackerFieldNotEmpty = eventData.custom?.find((f: any) => f.id == condition.field)?.value;
            if (lpTrackerFieldNotEmpty !== undefined) {
              return lpTrackerFieldNotEmpty != null && lpTrackerFieldNotEmpty !== '';
            }
            
            return false;
          
          default:
            return false;
        }
      });

      // Применяем оператор AND/OR
      if (operator === 'OR') {
        return results.some((result: boolean) => result);
      } else {
        return results.every((result: boolean) => result);
      }
    } catch (error) {
      return false;
    }
  }

  private async executeActions(actions: any, eventData: any): Promise<void> {
    try {
      if (!actions || !actions.list) {
        return;
      }

      for (const action of actions.list) {
        try {
          await this.logService.info(eventData.userId, `Выполняется действие: ${action.type}`, { action, eventDataUserId: eventData.userId }, 'webhook');

          // Подготавливаем данные для синхронизации из различных источников
          const webhookData: any = {
            // Имя контакта: приоритет AmoCRM контактам, затем LPTracker контактам
            name: eventData.contactsDetails?.[0]?.name || eventData.contactsDetails?.[0]?.first_name || eventData.contact?.name || eventData.callData?.contact_name || 'Новый контакт',
            first_name: eventData.contactsDetails?.[0]?.first_name || eventData.callData?.contact_name || '',
            last_name: eventData.contactsDetails?.[0]?.last_name || '',
            phone: this.extractPhoneFromLpTrackerContact(eventData.contact) || this.extractPhoneFromContact(eventData.contactsDetails?.[0]) || eventData.callData?.phone || '',
            email: this.extractEmailFromContact(eventData.contactsDetails?.[0]) || eventData.callData?.email || '',
            deal_name: eventData.leadDetails?.name || eventData.name || 'Новая сделка',
            price: eventData.leadDetails?.price || 0,
            custom_fields: eventData.leadDetails?.custom_fields_values || {},
            source: 'webhook_automation',
            campaign: eventData.callData?.campaign || '',
            keyword: eventData.callData?.keyword || ''
          };

          // Логируем исходные данные для понимания структуры
          await this.logService.info(eventData.userId, 'Исходные данные webhook для синхронизации', { 
            eventDataKeys: Object.keys(eventData),
            contactData: eventData.contact,
            webhookDataBefore: webhookData
          }, 'webhook');

          // Добавляем fieldMappings в данные для Smart Field Mapper
          webhookData.fieldMappings = action.fieldMappings || {};
          
          // Сохраняем исходные данные события для SmartFieldMapper
          webhookData.originalEventData = eventData;

          // Добавляем настройки воронки и статуса для AmoCRM (только если не пустые)
          if (action.amocrmPipelineId && action.amocrmPipelineId !== '') {
            webhookData.amocrmPipelineId = action.amocrmPipelineId;
          }
          if (action.amocrmStatusId && action.amocrmStatusId !== '') {
            webhookData.amocrmStatusId = action.amocrmStatusId;
          }

          // Добавляем настройки этапа и проекта для LPTracker (только если не пустые)
          if (action.lptrackerStageId && action.lptrackerStageId !== '') {
            webhookData.lptrackerStageId = action.lptrackerStageId;
          }
          if (action.lptrackerProjectId && action.lptrackerProjectId !== '') {
            webhookData.lptrackerProjectId = action.lptrackerProjectId;
          }

          switch (action.type) {
            case 'sync_to_amocrm':
              await this.amoCrmService.syncToAmoCrm(eventData.userId, webhookData, action.searchBy || 'phone');
              break;
            case 'sync_to_lptracker':
              await this.lpTrackerService.syncToLpTracker(eventData.userId, webhookData, action.searchBy || 'phone');
              break;
            default:
              await this.logService.warning(eventData.userId, `Неизвестный тип действия: ${action.type}`, { action }, 'webhook');
          }
        } catch (error) {
          await this.logService.error(eventData.userId, `Ошибка выполнения действия: ${action.type}`, { 
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
              name: (error as Error).name
            }, 
            action,
            eventDataKeys: Object.keys(eventData)
          }, 'webhook');
        }
      }
    } catch (error) {
      await this.logService.error(eventData.userId, 'Ошибка при выполнении действий', { error: (error as Error).message, actions }, 'webhook');
    }
  }

  private extractPhoneFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const phoneField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'PHONE' || field.field_name === 'Телефон'
    );
    
    if (phoneField && phoneField.values && phoneField.values.length > 0) {
      return phoneField.values[0].value;
    }
    
    return '';
  }

  private extractEmailFromContact(contact: any): string {
    if (!contact || !contact.custom_fields_values) return '';
    
    const emailField = contact.custom_fields_values.find((field: any) => 
      field.field_code === 'EMAIL' || field.field_name === 'Email'
    );
    
    if (emailField && emailField.values && emailField.values.length > 0) {
      return emailField.values[0].value;
    }
    
    return '';
  }

  private extractPhoneFromLpTrackerContact(contact: any): string {
    if (!contact || !contact.contacts) return '';
    
    const phoneContact = contact.contacts.find((c: any) => c.type === 'phone');
    return phoneContact ? phoneContact.data : '';
  }
}
import { IStorage } from "../storage";
import { LogService } from "./logService";
import { SmartFieldMapper } from "./smartFieldMapper";

export class LpTrackerService {
  private storage: IStorage;
  private logService: LogService;
  private smartFieldMapper: SmartFieldMapper;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
    this.smartFieldMapper = new SmartFieldMapper(storage);
  }

  private encrypt(text: string): string {
    // Простое шифрование для демонстрации - в продакшене используйте crypto
    return Buffer.from(text).toString('base64');
  }

  private decrypt(hash: string): string {
    return Buffer.from(hash, 'base64').toString();
  }

  async syncToLpTracker(userId: string, webhookData: any, searchBy: string = "phone"): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      await this.logService.log(userId, 'info', 'Starting LPTracker sync with Smart Field Mapping', { webhookData, searchBy }, 'lptracker');

      // 1. Найти или создать контакт
      const contact = await this.findOrCreateContact(userId, baseUrl, token, userSettings.projectId, webhookData, searchBy);
      
      // 2. Найти или создать лид для контакта
      const lead = await this.findOrCreateLead(userId, baseUrl, token, contact.id, webhookData);

      await this.logService.log(userId, 'info', 'LPTracker sync completed', { 
        contact: { id: contact.id, name: contact.name },
        lead: { id: lead.id, name: lead.name }
      }, 'lptracker');

      return { contact, lead };
    } catch (error) {
      await this.logService.log(userId, 'error', 'LPTracker sync failed', { error: error.message }, 'lptracker');
      throw error;
    }
  }

  private async findOrCreateContact(userId: string, baseUrl: string, token: string, projectId: string, webhookData: any, searchBy: string): Promise<any> {
    try {
      // Используем Smart Field Mapper для умного маппирования полей
      // Формируем структуру данных, ожидаемую Smart Field Mapper
      const sourceDataForMapper = {
        leadDetails: webhookData.leadDetails || {},
        contactsDetails: webhookData.contactsDetails || [],
        contact: webhookData.contact || {},
        ...webhookData
      };
      
      const mappedFields = await this.smartFieldMapper.smartMapFields(
        userId, 
        webhookData.fieldMappings || {}, 
        sourceDataForMapper, 
        'lptracker'
      );

      // Базовые данные контакта
      const contactData = {
        name: webhookData.first_name || webhookData.name || '',
        profession: webhookData.profession || '',
        site: webhookData.site || '',
        details: [],
        fields: {}
      };

      // Применяем умно замапированные поля контакта
      if (mappedFields.contactFields.name) {
        contactData.name = mappedFields.contactFields.name;
      }
      
      // Объединяем кастомные поля контакта
      contactData.fields = { 
        ...contactData.fields, 
        ...mappedFields.contactFields,
        ...webhookData.lptracker_custom_fields || {} 
      };

      await this.logService.log(userId, 'info', 'LPTracker - Smart Field Mapper результат для контакта', { 
        originalWebhookData: {
          name: webhookData.name,
          first_name: webhookData.first_name,
          lptracker_custom_fields: webhookData.lptracker_custom_fields
        },
        mappedFields,
        finalContactData: contactData
      }, 'lptracker');

      // Добавляем контактные данные
      if (webhookData.phone) {
        contactData.details.push({
          type: 'phone',
          data: webhookData.phone
        });
      }

      if (webhookData.email) {
        contactData.details.push({
          type: 'email',
          data: webhookData.email
        });
      }

      const requestBody = {
        project_id: projectId,
        ...contactData
      };
      
      await this.logService.log(userId, 'info', 'LPTracker - Отправка данных контакта в API', { 
        requestBody,
        url: `${baseUrl}/contact`
      }, 'lptracker');

      const createResponse = await fetch(`${baseUrl}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': token
        },
        body: JSON.stringify(requestBody),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create contact: ${createResponse.status}`);
      }

      const createResult = await createResponse.json();
      if (createResult.status === 'success') {
        const newContact = createResult.result;
        await this.logService.log(userId, 'info', 'Created new contact in LPTracker', { contactId: newContact.id }, 'lptracker');
        return newContact;
      } else {
        throw new Error('Failed to create contact in LPTracker');
      }

    } catch (error) {
      await this.logService.log(userId, 'error', 'Contact find/create failed', { error: error.message }, 'lptracker');
      throw error;
    }
  }

  private async findOrCreateLead(userId: string, baseUrl: string, token: string, contactId: number, webhookData: any): Promise<any> {
    try {
      // Используем Smart Field Mapper для умного маппирования полей лида
      // Формируем структуру данных, ожидаемую Smart Field Mapper  
      const sourceDataForMapper = {
        leadDetails: webhookData.leadDetails || {},
        contactsDetails: webhookData.contactsDetails || [],
        contact: webhookData.contact || {},
        ...webhookData
      };
      
      const mappedFields = await this.smartFieldMapper.smartMapFields(
        userId, 
        webhookData.fieldMappings || {}, 
        sourceDataForMapper, 
        'lptracker'
      );

      // Создание нового лида (LPTracker всегда создает новый лид)
      const leadData = {
        contact_id: contactId,
        name: webhookData.deal_name || webhookData.name || 'Новый лид',
        callback: webhookData.callback || false,
        funnel: (webhookData.lptrackerStageId && webhookData.lptrackerStageId !== '') ? parseInt(webhookData.lptrackerStageId) : (webhookData.funnel || null),
        view: {
          source: webhookData.source || 'API',
          campaign: webhookData.campaign || '',
          keyword: webhookData.keyword || ''
        },
        custom: {}
      };

      // Применяем умно замапированные кастомные поля лида
      leadData.custom = { 
        ...leadData.custom, 
        ...mappedFields.leadFields,
        ...webhookData.lptracker_custom_fields || {} 
      };

      await this.logService.log(userId, 'info', 'LPTracker - Smart Field Mapper результат для лида', { 
        originalWebhookData: {
          deal_name: webhookData.deal_name,
          lptracker_custom_fields: webhookData.lptracker_custom_fields
        },
        mappedFields,
        finalLeadData: leadData
      }, 'lptracker');

      const createResponse = await fetch(`${baseUrl}/lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': token
        },
        body: JSON.stringify(leadData),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create lead: ${createResponse.status}`);
      }

      const createResult = await createResponse.json();
      if (createResult.status === 'success') {
        const newLead = createResult.result;
        await this.logService.log(userId, 'info', 'Created new lead in LPTracker', { leadId: newLead.id }, 'lptracker');
        return newLead;
      } else {
        throw new Error('Failed to create lead in LPTracker');
      }

    } catch (error) {
      await this.logService.log(userId, 'error', 'Lead find/create failed', { error: error.message }, 'lptracker');
      throw error;
    }
  }

  async updateLead(userId: string, leadId: string, leadData: any): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const baseUrl = `https://${globalSettings.address}/api`;
      
      const requestData = {
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        project_id: userSettings.projectId,
        lead_id: leadId,
        ...leadData
      };

      const response = await fetch(`${baseUrl}/update-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Лид обновлен в LPTracker', { result }, 'lptracker');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении лида в LPTracker', { error }, 'lptracker');
      throw error;
    }
  }

  async getLeadStatus(userId: string, leadId: string): Promise<any> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const baseUrl = `https://${globalSettings.address}/api`;
      
      const requestData = {
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        project_id: userSettings.projectId,
        lead_id: leadId
      };

      const response = await fetch(`${baseUrl}/get-lead-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      await this.logService.log(userId, 'info', 'Статус лида получен из LPTracker', { result }, 'lptracker');
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при получении статуса лида из LPTracker', { error }, 'lptracker');
      throw error;
    }
  }

  async testConnection(login: string, password: string, address: string = 'direct.lptracker.ru'): Promise<boolean> {
    try {
      const baseUrl = `https://${address}`;
      
      // First, test authentication by getting a token
      const authResponse = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          login, 
          password, 
          service: 'CRM Integration',
          version: '1.0'
        }),
      });

      if (!authResponse.ok) {
        await this.logService.error(undefined, `LPTracker connection test failed: ${authResponse.status}`, { login, address });
        return false;
      }

      const authResult = await authResponse.json();
      
      // Check if the response contains a token according to LPTracker API documentation
      if (authResult.status !== 'success' || !authResult.result?.token) {
        await this.logService.error(undefined, 'LPTracker connection test failed: Invalid auth response', { login, address, response: authResult });
        return false;
      }

      const token = authResult.result.token;

      // Test the token by getting projects list
      const projectsResponse = await fetch(`${baseUrl}/projects`, {
        method: 'GET',
        headers: {
          'token': token,
        },
      });

      if (!projectsResponse.ok) {
        await this.logService.error(undefined, `LPTracker projects test failed: ${projectsResponse.status}`, { login, address });
        return false;
      }

      const projectsResult = await projectsResponse.json();
      
      if (projectsResult.status === 'success') {
        await this.logService.info(undefined, 'LPTracker connection test successful', { 
          login, 
          address, 
          projectsCount: projectsResult.result?.length || 0 
        });
        
        // Save the token for future use
        const globalSettings = await this.storage.getLpTrackerGlobalSettings();
        if (globalSettings) {
          await this.storage.updateLpTrackerGlobalSettings({
            token: token,
            isActive: true
          });
        }
        
        return true;
      } else {
        await this.logService.error(undefined, 'LPTracker connection test failed: Invalid projects response', { login, address, response: projectsResult });
        return false;
      }
    } catch (error) {
      await this.logService.error(undefined, `LPTracker connection test error: ${error}`, { login, address });
      return false;
    }
  }

  private async getAuthToken(globalSettings: any): Promise<string> {
    // Check if we have a cached token
    if (globalSettings.token) {
      return globalSettings.token;
    }
    
    const baseUrl = `https://${globalSettings.address}`;
    
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: globalSettings.login,
        password: globalSettings.password,
        service: globalSettings.service,
        version: '1.0'
      }),
    });

    if (!response.ok) {
      throw new Error(`LPTracker auth failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.status !== 'success' || !result.result?.token) {
      throw new Error('LPTracker auth failed: no token received');
    }

    // Save the token for future use
    await this.storage.updateLpTrackerGlobalSettings({
      token: result.result.token
    });

    return result.result.token;
  }

  async refreshMetadata(userId: string): Promise<void> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      // Skip projects loading - we don't need project metadata, just fields and funnel info

      // Get contact fields and custom fields metadata for the user's project
      try {
        const userSettings = await this.storage.getLpTrackerSettings(userId);
        if (userSettings?.projectId) {
          // Get contact fields 
          const contactFieldsResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/fields`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (contactFieldsResponse.ok) {
            const contactFields = await contactFieldsResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'contact_fields',
              data: contactFields
            });
            await this.logService.info(userId, 'Поля контактов LPTracker загружены', { fieldsCount: contactFields.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await contactFieldsResponse.text();
            await this.logService.warning(userId, `Failed to fetch contact fields: ${contactFieldsResponse.status}`, { error: errorText }, 'metadata');
          }

          // Get custom fields
          const customFieldsResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/customs`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (customFieldsResponse.ok) {
            const customFields = await customFieldsResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'custom_fields',
              data: customFields
            });
            await this.logService.info(userId, 'Кастомные поля LPTracker загружены', { fieldsCount: customFields.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await customFieldsResponse.text();
            await this.logService.warning(userId, `Failed to fetch custom fields: ${customFieldsResponse.status}`, { error: errorText }, 'metadata');
          }

          // Get funnel steps
          const funnelResponse = await fetch(`${baseUrl}/project/${userSettings.projectId}/funnel`, {
            method: 'GET',
            headers: {
              'token': token,
            },
          });

          if (funnelResponse.ok) {
            const funnel = await funnelResponse.json();
            await this.storage.saveLpTrackerMetadata({
              userId,
              type: 'funnel',
              data: funnel
            });
            await this.logService.info(userId, 'Воронка проекта LPTracker загружена', { stepsCount: funnel.result?.length || 0 }, 'metadata');
          } else {
            const errorText = await funnelResponse.text();
            await this.logService.warning(userId, `Failed to fetch funnel: ${funnelResponse.status}`, { error: errorText }, 'metadata');
          }
        } else {
          await this.logService.warning(userId, 'LPTracker project ID not configured for user', {}, 'metadata');
        }
      } catch (error) {
        await this.logService.error(userId, 'Failed to fetch LPTracker project metadata', { error: error.message }, 'metadata');
      }

      await this.logService.log(userId, 'info', 'Метаданные LPTracker обновлены', {}, 'metadata');
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при обновлении метаданных LPTracker', { error }, 'metadata');
      throw error;
    }
  }

  async setupWebhook(userId: string, webhookUrl: string): Promise<boolean> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      // Use the correct LPTracker API: PUT project/[project_id]/callback-url
      const response = await fetch(`${baseUrl}/project/${userSettings.projectId}/callback-url`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': token,
        },
        body: JSON.stringify({
          url: webhookUrl
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await this.logService.error(userId, `Failed to setup LPTracker webhook: ${response.status}`, { error: errorText, projectId: userSettings.projectId }, 'webhook');
        return false;
      }

      const result = await response.json();
      if (result.status === 'success') {
        // Update user settings to mark webhook as active
        await this.storage.updateLpTrackerSettings(userId, {
          webhookActive: true
        });
        
        // Update global settings with webhook URL if not set
        if (!globalSettings.webhookUrl) {
          await this.storage.updateLpTrackerGlobalSettings({
            webhookUrl: webhookUrl,
            webhookActive: true
          });
        }
        
        await this.logService.info(userId, 'LPTracker webhook установлен успешно', { webhookUrl, projectId: userSettings.projectId }, 'webhook');
        return true;
      } else {
        await this.logService.error(userId, 'Failed to setup LPTracker webhook', { result, projectId: userSettings.projectId }, 'webhook');
        return false;
      }
    } catch (error) {
      await this.logService.error(userId, 'Ошибка при установке LPTracker webhook', { error: error.message }, 'webhook');
      return false;
    }
  }

  async getWebhookStatus(userId?: string): Promise<{ url: string | null; active: boolean }> {
    try {
      if (userId) {
        // Get user-specific webhook status
        const userSettings = await this.storage.getLpTrackerSettings(userId);
        if (!userSettings) {
          return { url: null, active: false };
        }

        const globalSettings = await this.storage.getLpTrackerGlobalSettings();
        return {
          url: globalSettings?.webhookUrl || null,
          active: userSettings.webhookActive || false
        };
      } else {
        // Get global webhook status
        const globalSettings = await this.storage.getLpTrackerGlobalSettings();
        if (!globalSettings) {
          return { url: null, active: false };
        }

        return {
          url: globalSettings.webhookUrl || null,
          active: globalSettings.webhookActive || false
        };
      }
    } catch (error) {
      await this.logService.error(userId, 'Error getting webhook status', { error }, 'webhook');
      return { url: null, active: false };
    }
  }

  async removeWebhook(userId: string): Promise<boolean> {
    try {
      const userSettings = await this.storage.getLpTrackerSettings(userId);
      if (!userSettings) {
        throw new Error('LPTracker project settings not found');
      }

      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      // Remove webhook using correct API: PUT with empty URL to disable
      const response = await fetch(`${baseUrl}/project/${userSettings.projectId}/callback-url`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': token,
        },
        body: JSON.stringify({
          url: ""
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await this.logService.error(userId, `Failed to remove LPTracker webhook: ${response.status}`, { error: errorText, projectId: userSettings.projectId });
        return false;
      }

      const result = await response.json();
      if (result.status === 'success') {
        // Update user settings
        await this.storage.updateLpTrackerSettings(userId, {
          webhookActive: false
        });
        
        await this.logService.info(userId, 'LPTracker webhook удален успешно', { projectId: userSettings.projectId }, 'webhook');
        return true;
      } else {
        await this.logService.error(userId, 'Failed to remove LPTracker webhook', { result, projectId: userSettings.projectId }, 'webhook');
        return false;
      }
    } catch (error) {
      await this.logService.error(userId, 'Error removing LPTracker webhook', { error }, 'webhook');
      return false;
    }
  }

  async getProjects(userId: string): Promise<any> {
    try {
      const globalSettings = await this.storage.getLpTrackerGlobalSettings();
      if (!globalSettings) {
        throw new Error('LPTracker global settings not configured');
      }

      const token = await this.getAuthToken(globalSettings);
      const baseUrl = `https://${globalSettings.address}`;

      const response = await fetch(`${baseUrl}/projects`, {
        method: 'GET',
        headers: {
          'token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`LPTracker API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      await this.logService.log(userId, 'error', 'Ошибка при получении проектов LPTracker', { error }, 'lptracker');
      throw error;
    }
  }
}
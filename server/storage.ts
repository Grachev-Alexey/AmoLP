import {
  users,
  amoCrmSettings,
  lpTrackerSettings,
  lpTrackerGlobalSettings,
  amoCrmMetadata,
  lpTrackerMetadata,
  syncRules,
  fileUploads,
  callResults,
  systemLogs,
  type User,
  type UpsertUser,
  type AmoCrmSettings,
  type InsertAmoCrmSettings,
  type LpTrackerSettings,
  type InsertLpTrackerSettings,
  type LpTrackerGlobalSettings,
  type InsertLpTrackerGlobalSettings,
  type AmoCrmMetadata,
  type InsertAmoCrmMetadata,
  type LpTrackerMetadata,
  type InsertLpTrackerMetadata,
  type SyncRule,
  type InsertSyncRule,
  type FileUpload,
  type InsertFileUpload,
  type CallResult,
  type InsertCallResult,
  type SystemLog,
  type InsertSystemLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserForAPI(id: string): Promise<Omit<User, 'password'> | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  // AmoCRM operations
  getAmoCrmSettings(userId: string): Promise<AmoCrmSettings | undefined>;
  saveAmoCrmSettings(settings: InsertAmoCrmSettings): Promise<AmoCrmSettings>;
  updateAmoCrmSettings(userId: string, settings: Partial<InsertAmoCrmSettings>): Promise<AmoCrmSettings | undefined>;

  // LPTracker operations
  getLpTrackerGlobalSettings(): Promise<LpTrackerGlobalSettings | undefined>;
  saveLpTrackerGlobalSettings(settings: InsertLpTrackerGlobalSettings): Promise<LpTrackerGlobalSettings>;
  updateLpTrackerGlobalSettings(settings: Partial<InsertLpTrackerGlobalSettings>): Promise<LpTrackerGlobalSettings | undefined>;
  
  getLpTrackerSettings(userId: string): Promise<LpTrackerSettings | undefined>;
  getAllLpTrackerSettings(): Promise<LpTrackerSettings[]>;
  saveLpTrackerSettings(settings: InsertLpTrackerSettings): Promise<LpTrackerSettings>;
  updateLpTrackerSettings(userId: string, settings: Partial<InsertLpTrackerSettings>): Promise<LpTrackerSettings | undefined>;

  // Metadata operations
  getAmoCrmMetadata(userId: string, type: string): Promise<AmoCrmMetadata | undefined>;
  saveAmoCrmMetadata(metadata: InsertAmoCrmMetadata): Promise<AmoCrmMetadata>;
  updateAmoCrmMetadata(userId: string, type: string, data: any): Promise<AmoCrmMetadata | undefined>;
  
  getLpTrackerMetadata(userId: string, type: string): Promise<LpTrackerMetadata | undefined>;
  saveLpTrackerMetadata(metadata: InsertLpTrackerMetadata): Promise<LpTrackerMetadata>;
  updateLpTrackerMetadata(userId: string, type: string, data: any): Promise<LpTrackerMetadata | undefined>;

  // Sync rules operations
  getSyncRules(userId: string): Promise<SyncRule[]>;
  getSyncRule(id: number): Promise<SyncRule | undefined>;
  createSyncRule(rule: InsertSyncRule): Promise<SyncRule>;
  updateSyncRule(id: number, rule: Partial<InsertSyncRule>): Promise<SyncRule | undefined>;
  deleteSyncRule(id: number): Promise<void>;
  incrementRuleExecution(id: number): Promise<void>;

  // File upload operations
  getFileUploads(userId: string): Promise<FileUpload[]>;
  getFileUpload(id: number): Promise<FileUpload | undefined>;
  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  updateFileUpload(id: number, upload: Partial<InsertFileUpload>): Promise<FileUpload | undefined>;

  // Call results operations
  getCallResults(userId: string): Promise<CallResult[]>;
  createCallResult(result: InsertCallResult): Promise<CallResult>;
  updateCallResult(id: number, result: Partial<InsertCallResult>): Promise<CallResult | undefined>;

  // Logs operations
  getSystemLogs(userId?: string): Promise<SystemLog[]>;
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    
    if (user) {
      // Force object recreation to ensure all properties are enumerable
      const cleanUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        password: user.password,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      return cleanUser;
    }
    
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserForAPI(id: string): Promise<Omit<User, 'password'> | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    
    if (user) {

      
      // Return object without password for API responses
      const apiUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      

      return apiUser;
    }
    
    return undefined;
  }

  // AmoCRM operations
  async getAmoCrmSettings(userId: string): Promise<AmoCrmSettings | undefined> {
    const [settings] = await db
      .select()
      .from(amoCrmSettings)
      .where(eq(amoCrmSettings.userId, userId));
    return settings;
  }

  async saveAmoCrmSettings(settings: InsertAmoCrmSettings): Promise<AmoCrmSettings> {
    const [saved] = await db
      .insert(amoCrmSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: amoCrmSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async updateAmoCrmSettings(userId: string, settings: Partial<InsertAmoCrmSettings>): Promise<AmoCrmSettings | undefined> {
    const [updated] = await db
      .update(amoCrmSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(amoCrmSettings.userId, userId))
      .returning();
    return updated;
  }

  // LPTracker operations
  async getLpTrackerGlobalSettings(): Promise<LpTrackerGlobalSettings | undefined> {
    const [settings] = await db.select().from(lpTrackerGlobalSettings).limit(1);
    return settings;
  }

  async saveLpTrackerGlobalSettings(settings: InsertLpTrackerGlobalSettings): Promise<LpTrackerGlobalSettings> {
    // Check if settings already exist
    const existingSettings = await this.getLpTrackerGlobalSettings();
    
    if (existingSettings) {
      // Update existing settings
      const [updatedSettings] = await db
        .update(lpTrackerGlobalSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(lpTrackerGlobalSettings.id, existingSettings.id))
        .returning();
      return updatedSettings;
    } else {
      // Insert new settings
      const [savedSettings] = await db
        .insert(lpTrackerGlobalSettings)
        .values({
          ...settings,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return savedSettings;
    }
  }

  async updateLpTrackerGlobalSettings(settings: Partial<InsertLpTrackerGlobalSettings>): Promise<LpTrackerGlobalSettings | undefined> {
    const [existingSettings] = await db.select().from(lpTrackerGlobalSettings).limit(1);
    if (!existingSettings) return undefined;

    const [updatedSettings] = await db
      .update(lpTrackerGlobalSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
      })
      .where(eq(lpTrackerGlobalSettings.id, existingSettings.id))
      .returning();

    return updatedSettings;
  }

  async getLpTrackerSettings(userId: string): Promise<LpTrackerSettings | undefined> {
    const [settings] = await db
      .select()
      .from(lpTrackerSettings)
      .where(eq(lpTrackerSettings.userId, userId));
    
    return settings;
  }

  async getAllLpTrackerSettings(): Promise<LpTrackerSettings[]> {
    return await db.select().from(lpTrackerSettings);
  }

  async saveLpTrackerSettings(settings: InsertLpTrackerSettings): Promise<LpTrackerSettings> {
    const [saved] = await db
      .insert(lpTrackerSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: lpTrackerSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async updateLpTrackerSettings(userId: string, settings: Partial<InsertLpTrackerSettings>): Promise<LpTrackerSettings | undefined> {
    const [updated] = await db
      .update(lpTrackerSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(lpTrackerSettings.userId, userId))
      .returning();
    return updated;
  }

  // Metadata operations
  async getAmoCrmMetadata(userId: string, type: string): Promise<AmoCrmMetadata | undefined> {
    const [metadata] = await db
      .select()
      .from(amoCrmMetadata)
      .where(and(eq(amoCrmMetadata.userId, userId), eq(amoCrmMetadata.type, type)));
    return metadata;
  }

  async saveAmoCrmMetadata(metadata: InsertAmoCrmMetadata): Promise<AmoCrmMetadata> {
    // Сначала пробуем найти существующую запись
    const existing = await this.getAmoCrmMetadata(metadata.userId, metadata.type);
    
    if (existing) {
      // Если существует, обновляем
      const [updated] = await db
        .update(amoCrmMetadata)
        .set({
          data: metadata.data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(amoCrmMetadata.userId, metadata.userId),
          eq(amoCrmMetadata.type, metadata.type)
        ))
        .returning();
      return updated;
    } else {
      // Если не существует, создаем новую
      const [created] = await db
        .insert(amoCrmMetadata)
        .values(metadata)
        .returning();
      return created;
    }
  }

  async updateAmoCrmMetadata(userId: string, type: string, data: any): Promise<AmoCrmMetadata | undefined> {
    const [updated] = await db
      .update(amoCrmMetadata)
      .set({ data, updatedAt: new Date() })
      .where(and(eq(amoCrmMetadata.userId, userId), eq(amoCrmMetadata.type, type)))
      .returning();
    return updated;
  }

  // LPTracker metadata operations
  async getLpTrackerMetadata(userId: string, type: string): Promise<LpTrackerMetadata | undefined> {
    const [metadata] = await db
      .select()
      .from(lpTrackerMetadata)
      .where(and(eq(lpTrackerMetadata.userId, userId), eq(lpTrackerMetadata.type, type)));
    return metadata;
  }

  async saveLpTrackerMetadata(metadata: InsertLpTrackerMetadata): Promise<LpTrackerMetadata> {
    // Check if metadata already exists
    const existing = await this.getLpTrackerMetadata(metadata.userId, metadata.type);
    
    if (existing) {
      // Update existing metadata
      const [updated] = await db
        .update(lpTrackerMetadata)
        .set({ data: metadata.data, updatedAt: new Date() })
        .where(and(eq(lpTrackerMetadata.userId, metadata.userId), eq(lpTrackerMetadata.type, metadata.type)))
        .returning();
      return updated;
    } else {
      // Create new metadata
      const [created] = await db
        .insert(lpTrackerMetadata)
        .values(metadata)
        .returning();
      return created;
    }
  }

  async updateLpTrackerMetadata(userId: string, type: string, data: any): Promise<LpTrackerMetadata | undefined> {
    const [updated] = await db
      .update(lpTrackerMetadata)
      .set({ data, updatedAt: new Date() })
      .where(and(eq(lpTrackerMetadata.userId, userId), eq(lpTrackerMetadata.type, type)))
      .returning();
    return updated;
  }

  // Sync rules operations
  async getSyncRules(userId: string): Promise<SyncRule[]> {
    return await db
      .select()
      .from(syncRules)
      .where(eq(syncRules.userId, userId))
      .orderBy(desc(syncRules.createdAt));
  }

  async getSyncRule(id: number): Promise<SyncRule | undefined> {
    const [rule] = await db
      .select()
      .from(syncRules)
      .where(eq(syncRules.id, id));
    return rule;
  }

  async createSyncRule(rule: InsertSyncRule): Promise<SyncRule> {
    const [created] = await db
      .insert(syncRules)
      .values(rule)
      .returning();
    return created;
  }

  async updateSyncRule(id: number, rule: Partial<InsertSyncRule>): Promise<SyncRule | undefined> {
    const [updated] = await db
      .update(syncRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(eq(syncRules.id, id))
      .returning();
    return updated;
  }

  async deleteSyncRule(id: number): Promise<void> {
    await db.delete(syncRules).where(eq(syncRules.id, id));
  }

  async incrementRuleExecution(id: number): Promise<void> {
    await db
      .update(syncRules)
      .set({ executionCount: sql`${syncRules.executionCount} + 1` })
      .where(eq(syncRules.id, id));
  }

  // File upload operations
  async getFileUploads(userId: string): Promise<FileUpload[]> {
    return await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.userId, userId))
      .orderBy(desc(fileUploads.createdAt));
  }

  async getFileUpload(id: number): Promise<FileUpload | undefined> {
    const [upload] = await db
      .select()
      .from(fileUploads)
      .where(eq(fileUploads.id, id));
    return upload;
  }

  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    const [created] = await db
      .insert(fileUploads)
      .values(upload)
      .returning();
    return created;
  }

  async updateFileUpload(id: number, upload: Partial<InsertFileUpload>): Promise<FileUpload | undefined> {
    const [updated] = await db
      .update(fileUploads)
      .set({ ...upload, updatedAt: new Date() })
      .where(eq(fileUploads.id, id))
      .returning();
    return updated;
  }

  // Call results operations
  async getCallResults(userId: string): Promise<CallResult[]> {
    return await db
      .select()
      .from(callResults)
      .where(eq(callResults.userId, userId))
      .orderBy(desc(callResults.createdAt));
  }

  async createCallResult(result: InsertCallResult): Promise<CallResult> {
    const [created] = await db
      .insert(callResults)
      .values(result)
      .returning();
    return created;
  }

  async updateCallResult(id: number, result: Partial<InsertCallResult>): Promise<CallResult | undefined> {
    const [updated] = await db
      .update(callResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(callResults.id, id))
      .returning();
    return updated;
  }

  // Logs operations
  async getSystemLogs(userId?: string): Promise<SystemLog[]> {
    const query = db.select().from(systemLogs);
    if (userId) {
      query.where(eq(systemLogs.userId, userId));
    }
    return await query.orderBy(desc(systemLogs.createdAt));
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [created] = await db
      .insert(systemLogs)
      .values(log)
      .returning();
    return created;
  }

  // Методы webhookProcessing удалены - используем in-memory дедупликацию в WebhookService для лучшей производительности
}

export const storage = new DatabaseStorage();

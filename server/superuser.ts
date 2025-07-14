import { storage } from "./storage";
import { nanoid } from "nanoid";
import crypto from "crypto";

export async function createSuperuserIfNotExists(): Promise<void> {
  try {
    // Check if admin user exists
    const existingAdmin = await storage.getUserByUsername("admin");
    
    if (existingAdmin) {
      if (process.env.NODE_ENV === 'development') {
      }
      return;
    }

    // Create admin user with simple hashing for testing
    const hashedPassword = crypto.createHash('sha256').update("admin123").digest('hex');
    
    const admin = await storage.createUser({
      id: nanoid(),
      username: "admin",
      email: "admin@test.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "superuser",
    });

    if (process.env.NODE_ENV === 'development') {
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    }
  }
}
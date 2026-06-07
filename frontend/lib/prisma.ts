import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// This file is used to create a single instance of PrismaClient that can be shared across the entire application. 
// This is important because creating multiple instances of PrismaClient can lead to performance issues and connection exhaustion.

// set up a global variable to hold the PrismaClient instance
const globalForPrisma = globalThis as {
    prisma?: PrismaClient;
};

// Created adapter to connect to the PostgreSQL database using the connection string from the environment variable
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});

// If the PrismaClient instance already exists, use it. Otherwise, create a new instance and assign it to the global variable.
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({
    adapter,
  });

// In development, we want to use the same PrismaClient instance across hot reloads to prevent exhausting the database connections.
if (process.env.NODE_ENV !== 'production'){
    globalForPrisma.prisma = prisma;
};

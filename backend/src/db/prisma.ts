import { PrismaClient } from "@prisma/client";

/**
 * Runtime PrismaClient singleton. Connects via APP_DATABASE_URL (the least-privilege
 * "baotin_app" role — see infra/postgres/init/002-app-role.sql), never the migrator role.
 */
export const prisma = new PrismaClient({
  datasourceUrl: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL,
});

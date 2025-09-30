import { relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid, varchar, integer, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { users } from '../user';

export const usageCounters = pgTable('usage_counters', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    
    // Metric type: 'sandbox_minutes', 'ai_requests', 'storage_mb', 'bandwidth_gb'
    metric: varchar('metric', { length: 50 }).notNull(),
    
    // Usage value
    value: decimal('value', { precision: 10, scale: 2 }).notNull().default('0'),
    
    // Billing period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const usageCounterRelations = relations(usageCounters, ({ one }) => ({
    user: one(users, {
        fields: [usageCounters.userId],
        references: [users.id],
    }),
}));

export const usageCounterInsertSchema = createInsertSchema(usageCounters);

export type UsageCounter = typeof usageCounters.$inferSelect;
export type NewUsageCounter = typeof usageCounters.$inferInsert;

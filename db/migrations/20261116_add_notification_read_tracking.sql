SET @notification_read_at_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'read_at'
);
SET @notification_read_at_migration = IF(
    @notification_read_at_exists = 0,
    'ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL, ADD INDEX idx_notifications_unread (recipient_id, read_at, dismissed_at)',
    'SELECT 1'
);
PREPARE migration_statement FROM @notification_read_at_migration;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

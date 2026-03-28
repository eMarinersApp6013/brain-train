-- Add profile-building columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_kids BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anniversary DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_mood VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_step VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_modules TEXT[];

-- Allow multiple sessions per day (for 10-question rounds)
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_session_date_session_type_key;

-- BrainPing PostgreSQL Schema
-- Idempotent: safe to re-run

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS leaderboard_weekly CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS brain_assessments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS whitelist CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS module_state CASCADE;

-- ============================================================
-- 1. settings
-- ============================================================
CREATE TABLE settings (
    key         VARCHAR PRIMARY KEY,
    value       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. whitelist
-- ============================================================
CREATE TABLE whitelist (
    id          SERIAL PRIMARY KEY,
    phone       VARCHAR(20) UNIQUE NOT NULL,
    label       TEXT,
    difficulty  VARCHAR(10) DEFAULT 'medium',
    time_slot   VARCHAR(10) DEFAULT '08:00',
    is_active   BOOLEAN DEFAULT true,
    added_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. plans
-- ============================================================
CREATE TABLE plans (
    id                          SERIAL PRIMARY KEY,
    name                        VARCHAR(100) NOT NULL,
    price_inr                   INT DEFAULT 0,
    billing_cycle               VARCHAR(20) DEFAULT 'monthly',
    challenges_per_day          INT DEFAULT 1,
    has_analytics               BOOLEAN DEFAULT false,
    has_special_modules         BOOLEAN DEFAULT false,
    has_kids_mode               BOOLEAN DEFAULT false,
    has_corporate_dashboard     BOOLEAN DEFAULT false,
    is_active                   BOOLEAN DEFAULT true,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. users
-- ============================================================
CREATE TABLE users (
    id                          SERIAL PRIMARY KEY,
    phone                       VARCHAR(20) UNIQUE NOT NULL,
    name                        VARCHAR(100),
    age                         INT,
    mode                        VARCHAR(10) DEFAULT 'adult',
    age_group                   VARCHAR(10),
    difficulty                  VARCHAR(10) DEFAULT 'medium',
    time_slot                   VARCHAR(10) DEFAULT '08:00',
    streak                      INT DEFAULT 0,
    longest_streak              INT DEFAULT 0,
    total_points                INT DEFAULT 0,
    brain_age_score             INT,
    iq_estimate_score           INT,
    cognitive_style             VARCHAR(50),
    brain_health_score          INT,
    is_premium                  BOOLEAN DEFAULT false,
    plan_id                     INT REFERENCES plans(id),
    premium_until               DATE,
    onboarding_step             VARCHAR(30) DEFAULT 'start',
    is_active                   BOOLEAN DEFAULT true,
    window_expired              BOOLEAN DEFAULT false,
    last_user_message_at        TIMESTAMPTZ,
    window_open_until           TIMESTAMPTZ,
    chatwoot_contact_id         INT,
    chatwoot_conversation_id    INT,
    module_state                JSONB,
    gender                      VARCHAR(10),
    country                     VARCHAR(50),
    country_code                VARCHAR(5),
    marital_status              VARCHAR(20),
    has_kids                    BOOLEAN,
    interests                   TEXT,
    birthday                    DATE,
    anniversary                 DATE,
    profession                  VARCHAR(100),
    daily_mood                  VARCHAR(20),
    profile_data                JSONB DEFAULT '{}',
    profile_step                VARCHAR(30),
    preferred_modules           TEXT[],
    joined_at                   TIMESTAMPTZ DEFAULT NOW(),
    last_active                 TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. questions
-- ============================================================
CREATE TABLE questions (
    id                  SERIAL PRIMARY KEY,
    week_number         INT,
    day_of_week         VARCHAR(10),
    type                VARCHAR(30),
    difficulty          VARCHAR(10),
    audience            VARCHAR(20) DEFAULT 'adult',
    question_text       TEXT NOT NULL,
    question_image_url  TEXT,
    hint_text           TEXT,
    answer              TEXT NOT NULL,
    answer_type         VARCHAR(20) DEFAULT 'exact',
    explanation         TEXT,
    tip_text            TEXT,
    points              INT DEFAULT 10,
    time_limit_seconds  INT,
    memory_recall_text  TEXT,
    theme               VARCHAR(50),
    is_active           BOOLEAN DEFAULT true,
    source              VARCHAR(20) DEFAULT 'manual',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. user_sessions
-- ============================================================
CREATE TABLE user_sessions (
    id                      SERIAL PRIMARY KEY,
    user_id                 INT REFERENCES users(id),
    question_id             INT REFERENCES questions(id),
    sent_at                 TIMESTAMPTZ DEFAULT NOW(),
    answered_at             TIMESTAMPTZ,
    user_answer             TEXT,
    is_correct              BOOLEAN,
    points_earned           INT DEFAULT 0,
    hint_used               BOOLEAN DEFAULT false,
    response_time_seconds   INT,
    session_date            DATE DEFAULT CURRENT_DATE,
    session_type            VARCHAR(20) DEFAULT 'daily'
);

-- ============================================================
-- 7. scores
-- ============================================================
CREATE TABLE scores (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id),
    question_id         INT REFERENCES questions(id),
    score_date          DATE DEFAULT CURRENT_DATE,
    points              INT DEFAULT 0,
    is_correct          BOOLEAN,
    response_time_sec   INT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, score_date)
);

-- ============================================================
-- 8. subscriptions
-- ============================================================
CREATE TABLE subscriptions (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    plan_id         INT REFERENCES plans(id),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    payment_ref     VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. brain_assessments
-- ============================================================
CREATE TABLE brain_assessments (
    id                  SERIAL PRIMARY KEY,
    user_id             INT REFERENCES users(id),
    assessment_type     VARCHAR(20),
    score               INT,
    result_label        VARCHAR(100),
    questions_json      TEXT,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. achievements
-- ============================================================
CREATE TABLE achievements (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    badge_type      VARCHAR(50) NOT NULL,
    badge_label     VARCHAR(100),
    earned_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. leaderboard_weekly
-- ============================================================
CREATE TABLE leaderboard_weekly (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    week_start      DATE NOT NULL,
    points          INT DEFAULT 0,
    rank            INT,
    accuracy_pct    INT,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- ============================================================
-- 12. module_state (tracking table)
-- ============================================================
CREATE TABLE module_state (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id),
    module_name     VARCHAR(50) NOT NULL,
    state           JSONB DEFAULT '{}'::jsonb,
    step            VARCHAR(50),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_name)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_users_phone                ON users(phone);
CREATE INDEX idx_questions_type             ON questions(type);
CREATE INDEX idx_questions_difficulty       ON questions(difficulty);
CREATE INDEX idx_user_sessions_user_id      ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_date ON user_sessions(session_date);
CREATE INDEX idx_user_sessions_user_date_type ON user_sessions(user_id, session_date, session_type);
CREATE INDEX idx_scores_user_id             ON scores(user_id);
CREATE INDEX idx_leaderboard_week_start     ON leaderboard_weekly(week_start);

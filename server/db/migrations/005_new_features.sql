-- 005_new_features.sql — Health tips, reminders, engagement, consent

CREATE TABLE IF NOT EXISTS health_tips (
    id SERIAL PRIMARY KEY,
    category VARCHAR(30) NOT NULL DEFAULT 'general',
    audience VARCHAR(20) DEFAULT 'all',
    tip_text TEXT NOT NULL,
    source VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    reminder_text TEXT NOT NULL,
    remind_at TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    is_recurring BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_content (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(30) NOT NULL,
    content_text TEXT NOT NULL,
    answer_text TEXT,
    explanation TEXT,
    category VARCHAR(50),
    audience VARCHAR(20) DEFAULT 'all',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_closeout (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    closeout_date DATE DEFAULT CURRENT_DATE,
    mood_morning VARCHAR(20),
    mood_evening VARCHAR(20),
    day_summary TEXT,
    gratitude_items TEXT,
    ai_reflection TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, closeout_date)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aspiration TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emotional_state VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_tip_time VARCHAR(10) DEFAULT '08:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS horoscope_sign VARCHAR(20);

-- Seed health tips
INSERT INTO health_tips (category, audience, tip_text, source) VALUES
('brain', 'all', '🧠 Learning a new skill for just 15 minutes today creates more neural connections than repeating something familiar for an hour.', 'Harvard Health'),
('brain', 'all', '🧠 Your brain uses 20% of your body''s energy. Stay hydrated — even 2% dehydration reduces cognitive performance.', 'NIH Research'),
('sleep', 'all', '😴 During deep sleep, your brain clears toxic proteins linked to Alzheimer''s. Aim for 7-8 hours.', 'NIH'),
('nutrition', 'all', '🥗 Blueberries, walnuts, and dark chocolate contain flavonoids that improve memory and focus.', 'Harvard Health'),
('body', 'all', '🏃 Just 20 minutes of brisk walking increases blood flow to your brain by 15% and boosts memory.', 'University of British Columbia'),
('stress', 'all', '🧘 Deep breathing (4 counts in, 7 hold, 8 out) reduces cortisol in 90 seconds.', 'Harvard Medical School'),
('kids', 'kids-6-9', '🌟 Playing with building blocks helps your brain learn math and spatial thinking!', 'Child Development Research'),
('kids', 'kids-10-13', '🌟 Your brain is growing super fast right now! Every new thing you learn creates connections that last a lifetime.', 'NIH'),
('kids', 'kids-14-17', '🌟 Teens who get 8-10 hours of sleep perform 30% better on tests.', 'Sleep Foundation');

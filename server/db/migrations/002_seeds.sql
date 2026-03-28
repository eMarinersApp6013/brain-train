-- ============================================================
-- BrainPing Seed Data
-- Run after schema.sql
-- ============================================================

-- ============================================================
-- 1. Settings
-- ============================================================
INSERT INTO settings (key, value) VALUES
    ('TEST_MODE',       'true'),
    ('TRIGGER_KEYWORD', 'brain'),
    ('CHATWOOT_URL',    'https://chat.nordsurge.tech'),
    ('CHATWOOT_TOKEN',  'REPLACE'),
    ('CHATWOOT_INBOX_ID', '3'),
    ('ANTHROPIC_API_KEY', 'REPLACE'),
    ('OPENAI_API_KEY',  'REPLACE'),
    ('CLAUDE_MODEL',    'claude-sonnet-4-6'),
    ('OPENAI_MODEL',    'gpt-4o'),
    ('TIMEZONE',        'Asia/Kolkata'),
    ('BOT_NAME',        'BrainPing')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================
-- 2. Plans
-- ============================================================
INSERT INTO plans (name, price_inr, billing_cycle, challenges_per_day, has_analytics, has_special_modules, has_kids_mode, has_corporate_dashboard) VALUES
    ('Free',       0,    'monthly',  1,  false, false, false, false),
    ('Premium',    99,   'monthly',  3,  true,  true,  true,  false),
    ('Corporate',  5000, 'monthly',  99, true,  true,  true,  true);

-- ============================================================
-- 3. Questions — Adult Medium, Week 1
-- ============================================================

-- Week 1, Monday — Logic
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, explanation, points)
VALUES (1, 'monday', 'logic', 'medium', 'adult',
    'Three friends — Aman, Bina, and Charu — sit in a row. Aman is not next to Bina. Charu is on the far left. Who sits in the middle?',
    'Think about who CANNOT be next to whom.',
    'Bina|bina',
    'keyword',
    'Charu is on the far left. Aman can''t be next to Bina, so Aman must be on the far right. That puts Bina in the middle.',
    20);

-- Week 1, Tuesday — Words
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, points)
VALUES (1, 'tuesday', 'words', 'medium', 'adult',
    E'Unscramble these words:\n1. TIHKN\n2. BAELNCA\n3. YRTAEGST',
    'They are common English words',
    'think, balance, strategy|think balance strategy',
    'keyword',
    15);

-- Week 1, Wednesday — Math (3 separate questions)
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'wednesday', 'math', 'medium', 'adult',
    'What is 17 × 6 + 14?',
    '116',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'wednesday', 'math', 'medium', 'adult',
    'What is 256 ÷ 8 − 13?',
    '19',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'wednesday', 'math', 'medium', 'adult',
    'What is √144 × 3 + 17?',
    '53',
    'exact',
    10);

-- Week 1, Thursday — Pattern
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, explanation, points)
VALUES (1, 'thursday', 'pattern', 'medium', 'adult',
    E'What comes next in this pattern?\n🔵🔴🔵🔵🔴🔵🔵🔵❓\nA) 🔴\nB) 🔵\nC) 🟢\nD) 🟡',
    'Count how many blues appear between each red',
    'A',
    'mcq',
    'Blue count increases by 1 each time: 1,2,3... so next is red',
    15);

-- Week 1, Friday — Memory
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, memory_recall_text, answer, answer_type, points)
VALUES (1, 'friday', 'memory', 'medium', 'adult',
    E'Memorise these words. You''ll be asked to recall them later today!\n\nShip  Mango  Clock  River  Purple  Guitar  Sand  Mirror',
    'Earlier today you memorised 8 words. How many can you recall? Reply with the words separated by commas.',
    'ship,mango,clock,river,purple,guitar,sand,mirror',
    'keyword',
    20);

-- Week 1, Saturday — Trivia
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (1, 'saturday', 'trivia', 'medium', 'adult',
    E'Which planet in our solar system has the most moons?\nA) Jupiter\nB) Saturn\nC) Uranus\nD) Neptune',
    'B',
    'mcq',
    'Saturn has 146 confirmed moons, surpassing Jupiter''s 95',
    10);

-- Week 1, Sunday — Riddle
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, points)
VALUES (1, 'sunday', 'riddle', 'medium', 'adult',
    'I have cities but no houses, forests but no trees, and water but no fish. What am I?',
    'Think about representations of the world',
    'map|a map|world map',
    'keyword',
    15);

-- ============================================================
-- 3. Questions — Adult Medium, Week 2
-- ============================================================

-- Week 2, Monday — Logic
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (2, 'monday', 'logic', 'medium', 'adult',
    'A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left?',
    '9|nine|9 sheep',
    'keyword',
    '''All but 9'' means 9 remain.',
    20);

-- Week 2, Tuesday — Words
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (2, 'tuesday', 'words', 'medium', 'adult',
    E'Create a word chain from COLD to WARM, changing one letter at a time. Each step must be a valid English word.\n\nCOLD → ____ → ____ → WARM',
    'cord,word|cord word|cold cord word warm',
    'ai_check',
    20);

-- Week 2, Wednesday — Math (3 separate questions)
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (2, 'wednesday', 'math', 'medium', 'adult',
    'A train travels 120 km in 1.5 hours. What is its speed in km/h?',
    '80',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (2, 'wednesday', 'math', 'medium', 'adult',
    'If 5x + 3 = 28, what is x?',
    '5',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (2, 'wednesday', 'math', 'medium', 'adult',
    'What is 15% of 200?',
    '30',
    'exact',
    10);

-- Week 2, Thursday — Pattern
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, explanation, points)
VALUES (2, 'thursday', 'pattern', 'medium', 'adult',
    'What comes next? 2, 6, 12, 20, 30, ?',
    'Look at the differences between consecutive numbers',
    '42',
    'exact',
    'Differences are 4,6,8,10,12 — increasing by 2 each time. 30+12=42',
    15);

-- Week 2, Friday — Memory
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, memory_recall_text, answer, answer_type, points)
VALUES (2, 'friday', 'memory', 'medium', 'adult',
    E'Memorise these words:\n\nTiger  Umbrella  Pencil  Mountain  Silver  Candle  Bridge  Feather',
    'Time to recall! What were the 8 words from this morning? Reply with commas between them.',
    'tiger,umbrella,pencil,mountain,silver,candle,bridge,feather',
    'keyword',
    20);

-- Week 2, Saturday — Trivia
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (2, 'saturday', 'trivia', 'medium', 'adult',
    E'How many bones are in the adult human body?\nA) 186\nB) 206\nC) 226\nD) 256',
    'B',
    'mcq',
    'An adult human has 206 bones',
    10);

-- Week 2, Sunday — Riddle
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (2, 'sunday', 'riddle', 'medium', 'adult',
    'The more you take, the more you leave behind. What am I?',
    'footsteps|foot steps',
    'keyword',
    15);

-- ============================================================
-- 3. Questions — Adult Medium, Week 3
-- ============================================================

-- Week 3, Monday — Logic
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (3, 'monday', 'logic', 'medium', 'adult',
    'In a row of 5 houses, each a different colour, the green house is immediately to the right of the ivory house. The red house is in the middle. The blue house is the first on the left. The yellow house is not next to the blue house. What position is the yellow house?',
    '5|fifth|5th|last|position 5',
    'keyword',
    'Blue=1, Red=3. Yellow can''t be next to blue so not position 2. Ivory-Green are consecutive. Ivory=2, Green=3 conflicts with Red=3. So Ivory=3 conflicts too. Ivory=4, Green=5 means position 2 must be Yellow — but Yellow can''t be next to Blue. The remaining arrangement: Blue=1, Ivory=2, Red=3, Green=4 won''t work (green must be right of ivory, which it is, but then position 5 = Yellow). The answer is position 5.',
    25);

-- Week 3, Tuesday — Words
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, points)
VALUES (3, 'tuesday', 'words', 'medium', 'adult',
    'Find at least 3 words that can be made by rearranging ALL letters of: AELST',
    'Think of common 5-letter words',
    'steal,tales,stale|steal tales stale|least,steal,tales|least steal tales stale tesla',
    'ai_check',
    15);

-- Week 3, Wednesday — Math (3 separate questions)
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (3, 'wednesday', 'math', 'medium', 'adult',
    'A shirt costs Rs.800. It is sold at 25% profit. What is the selling price?',
    '1000',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (3, 'wednesday', 'math', 'medium', 'adult',
    'What is the area of a circle with radius 7? (Use π = 22/7)',
    '154',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (3, 'wednesday', 'math', 'medium', 'adult',
    'If a = 3 and b = 4, what is a² + b²?',
    '25',
    'exact',
    10);

-- Week 3, Thursday — Pattern
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, explanation, points)
VALUES (3, 'thursday', 'pattern', 'medium', 'adult',
    'What comes next in the sequence? A, C, F, J, O, ?',
    'Look at the gaps between letters',
    'U',
    'exact',
    'Gaps are +2,+3,+4,+5,+6. O + 6 positions = U',
    15);

-- Week 3, Friday — Memory
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, memory_recall_text, answer, answer_type, points)
VALUES (3, 'friday', 'memory', 'medium', 'adult',
    E'Memorise these 10 words:\n\nVolcano  Bicycle  Emerald  Whisper  Anchor  Thunder  Library  Cinnamon  Lantern  Compass',
    'Recall challenge! What were the 10 words from this morning?',
    'volcano,bicycle,emerald,whisper,anchor,thunder,library,cinnamon,lantern,compass',
    'keyword',
    25);

-- Week 3, Saturday — Trivia
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (3, 'saturday', 'trivia', 'medium', 'adult',
    E'Which country has the most time zones?\nA) Russia\nB) USA\nC) France\nD) China',
    'C',
    'mcq',
    'France has 12 time zones due to its overseas territories',
    10);

-- Week 3, Sunday — Riddle
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (3, 'sunday', 'riddle', 'medium', 'adult',
    'I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?',
    'echo|an echo',
    'keyword',
    15);

-- ============================================================
-- 3. Questions — Adult Medium, Week 4
-- ============================================================

-- Week 4, Monday — Logic
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, points)
VALUES (4, 'monday', 'logic', 'medium', 'adult',
    'You have two ropes. Each takes exactly 60 minutes to burn completely, but they burn unevenly. How do you measure exactly 45 minutes?',
    'You can light ropes from both ends',
    'Light both ends of rope 1 and one end of rope 2. When rope 1 burns out (30 min), light the other end of rope 2. It will burn out in 15 more minutes. Total: 45 minutes.',
    'ai_check',
    25);

-- Week 4, Tuesday — Words
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (4, 'tuesday', 'words', 'medium', 'adult',
    E'Find the hidden words inside these words:\n1. BREAKFAST\n2. FRIENDSHIP\n3. BELIEVED',
    'fast,break|friend,ship|lie,lived|fast friend lie',
    'ai_check',
    15);

-- Week 4, Wednesday — Math (3 separate questions)
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (4, 'wednesday', 'math', 'medium', 'adult',
    'What is 15% of 840?',
    '126',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (4, 'wednesday', 'math', 'medium', 'adult',
    'A car travels at 60 km/h for 2.5 hours. How far does it go?',
    '150',
    'exact',
    10);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (4, 'wednesday', 'math', 'medium', 'adult',
    'What is 3⁴?',
    '81',
    'exact',
    10);

-- Week 4, Thursday — Pattern
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (4, 'thursday', 'pattern', 'medium', 'adult',
    'What comes next in the Fibonacci sequence? 1, 1, 2, 3, 5, 8, 13, 21, ?',
    '34',
    'exact',
    'Each number is the sum of the two before it: 13+21=34',
    15);

-- Week 4, Friday — Memory
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, memory_recall_text, answer, answer_type, points)
VALUES (4, 'friday', 'memory', 'medium', 'adult',
    E'Memorise these words:\n\nDiamond  Jungle  Trumpet  Marble  Horizon  Biscuit  Falcon  Capsule',
    'Memory test! What were the 8 words from earlier today?',
    'diamond,jungle,trumpet,marble,horizon,biscuit,falcon,capsule',
    'keyword',
    20);

-- Week 4, Saturday — Trivia
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, explanation, points)
VALUES (4, 'saturday', 'trivia', 'medium', 'adult',
    E'Which country is also a continent?\nA) Greenland\nB) Australia\nC) India\nD) Antarctica',
    'B',
    'mcq',
    'Australia is both a country and a continent',
    10);

-- Week 4, Sunday — Riddle
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (4, 'sunday', 'riddle', 'medium', 'adult',
    'I have no legs but I run. I have no lungs but I need air. I die if I touch water. What am I?',
    'fire|a fire',
    'keyword',
    15);

-- ============================================================
-- 4. Questions — Kids 6-9, Easy, Week 1
-- ============================================================

-- Kids Week 1, Monday — Logic
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'monday', 'logic', 'easy', 'kids-6-9',
    'I have 3 apples. I eat 1. How many do I have left?',
    '2|two',
    'exact',
    5);

-- Kids Week 1, Tuesday — Words
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'tuesday', 'words', 'easy', 'kids-6-9',
    E'Unscramble these animal words:\n1. TAC\n2. GOD\n3. ISF',
    'cat, dog, fish|cat dog fish',
    'keyword',
    5);

-- Kids Week 1, Wednesday — Math (2 questions)
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'wednesday', 'math', 'easy', 'kids-6-9',
    'What is 5 + 8?',
    '13',
    'exact',
    5);

INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'wednesday', 'math', 'easy', 'kids-6-9',
    'What is 12 - 4?',
    '8',
    'exact',
    5);

-- Kids Week 1, Thursday — Pattern
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'thursday', 'pattern', 'easy', 'kids-6-9',
    E'What comes next? ⭕ ⬛ ⭕ ⬛ ⭕ ?\nA) ⭕\nB) ⬛\nC) 🔺\nD) ⭐',
    'B',
    'mcq',
    5);

-- Kids Week 1, Friday — Memory
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, memory_recall_text, answer, answer_type, points)
VALUES (1, 'friday', 'memory', 'easy', 'kids-6-9',
    E'Remember these words:\n\nApple  Ball  Cat  Dog',
    'What were the 4 words from earlier?',
    'apple,ball,cat,dog',
    'keyword',
    5);

-- Kids Week 1, Saturday — Trivia
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'saturday', 'trivia', 'easy', 'kids-6-9',
    E'How many legs does a spider have?\nA) 6\nB) 8\nC) 10\nD) 12',
    'B',
    'mcq',
    5);

-- Kids Week 1, Sunday — Riddle
INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, answer, answer_type, points)
VALUES (1, 'sunday', 'riddle', 'easy', 'kids-6-9',
    'I have hands but cannot clap. What am I?',
    'clock|a clock|watch',
    'keyword',
    5);

-- ============================================================
-- 5. Questions — Brain Age Module (type='brain_age')
-- ============================================================

-- Brain Age 1: Logic
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly? Answer YES or NO.',
    'NO|no',
    'exact',
    10, 60);

-- Brain Age 2: Logic
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'Complete the analogy: Book is to Reading as Fork is to ___',
    'eating|Eating',
    'keyword',
    10, 60);

-- Brain Age 3: Pattern
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'What number comes next? 3, 6, 11, 18, 27, ?',
    '38',
    'exact',
    10, 60);

-- Brain Age 4: Pattern
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    E'Which shape completes the pattern? ◼◼◻ ◼◻◻ ◻◻◻ — The pattern shows?\nA) Decreasing black squares\nB) Increasing black squares\nC) Random\nD) Alternating',
    'A',
    'mcq',
    10, 60);

-- Brain Age 5: Memory
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'Remember this sequence: 7 - 3 - 9 - 1 - 5 - 8. Now, what was the 4th number?',
    '1',
    'exact',
    10, 60);

-- Brain Age 6: Memory
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'I''ll show you: BLUE GREEN RED YELLOW. What was the second colour?',
    'green|GREEN',
    'keyword',
    10, 60);

-- Brain Age 7: Math
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'What is 47 + 86?',
    '133',
    'exact',
    10, 60);

-- Brain Age 8: Math
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'If you buy 3 items at Rs.45 each and pay with Rs.200, what''s your change?',
    '65',
    'exact',
    10, 60);

-- Brain Age 9: Verbal
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'What is the opposite of ''benevolent''?',
    'malevolent|cruel|malicious|hostile',
    'keyword',
    10, 60);

-- Brain Age 10: Verbal
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('brain_age', 'medium', 'adult',
    'Rearrange to form a word: LANTERME',
    'terminal|TERMINAL',
    'keyword',
    10, 60);

-- ============================================================
-- 6. Questions — IQ Module (type='iq')
-- ============================================================

-- ---- IQ Easy (1-5) — time_limit_seconds = 60 ----

-- IQ 1: Easy — Number sequence
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'easy', 'adult',
    'What comes next in the sequence? 2, 4, 8, 16, 32, ?',
    '64',
    'exact',
    10, 60);

-- IQ 2: Easy — Simple analogy
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'easy', 'adult',
    E'Hot is to Cold as Tall is to ___?\nA) Big\nB) Short\nC) Wide\nD) Long',
    'B',
    'mcq',
    10, 60);

-- IQ 3: Easy — Basic spatial
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'easy', 'adult',
    E'If you fold a square piece of paper in half diagonally, what shape do you get?\nA) Rectangle\nB) Triangle\nC) Pentagon\nD) Circle',
    'B',
    'mcq',
    10, 60);

-- IQ 4: Easy — Number sequence
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'easy', 'adult',
    'What comes next? 5, 10, 15, 20, 25, ?',
    '30',
    'exact',
    10, 60);

-- IQ 5: Easy — Simple analogy
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'easy', 'adult',
    E'Pen is to Writer as Brush is to ___?\nA) Canvas\nB) Painter\nC) Colour\nD) Art',
    'B',
    'mcq',
    10, 60);

-- ---- IQ Medium (6-10) — time_limit_seconds = 90 ----

-- IQ 6: Medium — Word problem
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'medium', 'adult',
    'If it takes 5 machines 5 minutes to make 5 widgets, how many minutes would it take 100 machines to make 100 widgets?',
    '5',
    'exact',
    15, 90);

-- IQ 7: Medium — Pattern completion
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'medium', 'adult',
    'What number comes next? 1, 4, 9, 16, 25, ?',
    '36',
    'exact',
    15, 90);

-- IQ 8: Medium — Logical deduction
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'medium', 'adult',
    E'All Bloops are Razzies. All Razzies are Lazzies. Are all Bloops definitely Lazzies?\nA) Yes\nB) No\nC) Cannot be determined\nD) Only some',
    'A',
    'mcq',
    15, 90);

-- IQ 9: Medium — Pattern completion
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'medium', 'adult',
    'What comes next in the sequence? 3, 5, 9, 17, 33, ?',
    '65',
    'exact',
    15, 90);

-- IQ 10: Medium — Word problem
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'medium', 'adult',
    E'A bat and a ball cost Rs.110. The bat costs Rs.100 more than the ball. How much does the ball cost?\nA) Rs.10\nB) Rs.5\nC) Rs.15\nD) Rs.55',
    'B',
    'mcq',
    15, 90);

-- ---- IQ Hard (11-15) — time_limit_seconds = 120 ----

-- IQ 11: Hard — Abstract reasoning
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'hard', 'adult',
    E'If APPLE = 50, BANANA = 42, then CHERRY = ?\n(Hint: A=1, B=2 ... Z=26, sum the letters)',
    '70',
    'exact',
    20, 120);

-- IQ 12: Hard — Multi-step logic
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'hard', 'adult',
    E'Five people finished a race. Amy finished before Ben but after Cal. Dan finished before Eve but after Ben. Who finished third?\nA) Amy\nB) Ben\nC) Cal\nD) Dan',
    'B',
    'mcq',
    20, 120);

-- IQ 13: Hard — Complex pattern
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'hard', 'adult',
    'What comes next? 1, 2, 6, 24, 120, ?',
    '720',
    'exact',
    20, 120);

-- IQ 14: Hard — Abstract reasoning
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'hard', 'adult',
    E'If the day before yesterday was Thursday, what day will it be the day after tomorrow?\nA) Sunday\nB) Monday\nC) Tuesday\nD) Saturday',
    'B',
    'mcq',
    20, 120);

-- IQ 15: Hard — Multi-step logic
INSERT INTO questions (type, difficulty, audience, question_text, answer, answer_type, points, time_limit_seconds)
VALUES ('iq', 'hard', 'adult',
    E'In a group of 6 people, everyone shakes hands with everyone else exactly once. How many handshakes occur in total?',
    '15',
    'exact',
    20, 120);

-- ============================================================
-- Seed complete
-- ============================================================

# BrainPing Content Pipeline

## Overview

BrainPing uses three methods to populate its question bank. The primary method (bulk upload) incurs zero AI cost at delivery time.

## Method 1: Generate with Claude Code (Recommended)

This is the most cost-effective approach for bulk content creation.

### Steps
1. Open Claude Code in the brain-training repository
2. Prompt: *"Generate 50 trivia questions for adults medium difficulty in CSV format matching our question schema"*
3. Claude Code creates a CSV file (e.g., `questions-batch-1.csv`)
4. Push to GitHub: `git add . && git commit -m "Add question batch 1" && git push`
5. On VPS: `git pull && node server/scripts/import_csv.js questions-batch-1.csv`

### CSV Format
```csv
week_number,day_of_week,type,difficulty,audience,question_text,hint_text,answer,answer_type,explanation,tip_text,points,memory_recall_text,theme
1,mon,logic,medium,adult,"Question text here","Hint text","answer1|answer2",keyword,"Explanation","Tip",20,,
```

### Column Reference
| Column | Required | Values |
|--------|----------|--------|
| week_number | No | 1-4 |
| day_of_week | No | mon,tue,wed,thu,fri,sat,sun |
| type | Yes | logic,words,math,pattern,memory,trivia,riddle,brain_age,iq,speed |
| difficulty | Yes | easy,medium,hard |
| audience | Yes | adult,kids-6-9,kids-10-13,kids-14-17 |
| question_text | Yes | The question |
| hint_text | No | Optional hint |
| answer | Yes | Correct answer(s), pipe-separated |
| answer_type | Yes | exact,keyword,mcq,fuzzy,ai_check |
| explanation | No | Why the answer is correct |
| tip_text | No | Learning tip |
| points | No | Default 10 |
| memory_recall_text | No | For Friday memory challenges only |
| theme | No | For themed weeks |

## Method 2: Admin Panel AI Generator

### Steps
1. Go to Admin Panel → AI Generator
2. Select: type, difficulty, audience, count (1-50)
3. Choose AI provider (Claude recommended)
4. Click "Generate"
5. Review questions in the preview table
6. Edit any that need adjustment
7. Click "Save All" to add to database

### Cost
- Uses your Anthropic/OpenAI API key
- ~500 tokens per question generated
- 50 questions ≈ 25K tokens ≈ $0.08 with Claude Sonnet

## Method 3: Manual Entry

### Steps
1. Go to Admin Panel → Content → Add Question
2. Fill in all fields
3. Save

## Answer Types Explained

| Type | How It Works | Best For |
|------|-------------|----------|
| exact | Exact string match (case insensitive, pipe-separated variants) | Math, simple answers |
| mcq | Single letter match (A/B/C/D) | Multiple choice |
| keyword | User answer must contain one of the keywords | Riddles, short answers |
| fuzzy | OpenAI checks semantic equivalence | Open-ended answers |
| ai_check | Full OpenAI analysis with explanation | Complex reasoning |

## Kids Content Guidelines

- **6-9**: Simple vocabulary, fun emoji, no timer pressure, max 2 sentences
- **10-13**: Word puzzles, basic science, mild time awareness
- **14-17**: Exam-relevant topics, full features except IQ module
- No adult themes, violence, or complex finance in any kids content

## Themed Weeks

1. Create questions with a `theme` field (e.g., "Science Week")
2. In Admin Panel → Themes, activate the theme for a week
3. System automatically uses themed questions during the active week
4. Sunday evening: announcement sent to all users about the upcoming theme

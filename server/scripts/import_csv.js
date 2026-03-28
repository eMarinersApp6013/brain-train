#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
}

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool, query } = require('../db/pool');

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node import_csv.js <path-to-csv>');
  process.exit(1);
}

const fullPath = path.resolve(csvPath);
if (!fs.existsSync(fullPath)) {
  console.error('File not found:', fullPath);
  process.exit(1);
}

async function run() {
  const csvContent = fs.readFileSync(fullPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`Parsed ${records.length} records from CSV`);

  let inserted = 0;
  let errors = 0;

  for (const row of records) {
    try {
      await query(
        `INSERT INTO questions (week_number, day_of_week, type, difficulty, audience, question_text, hint_text, answer, answer_type, explanation, tip_text, points, memory_recall_text, theme, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'csv_import')`,
        [
          parseInt(row.week_number) || null,
          row.day_of_week || null,
          row.type || 'trivia',
          row.difficulty || 'medium',
          row.audience || 'adult',
          row.question_text,
          row.hint_text || null,
          row.answer,
          row.answer_type || 'exact',
          row.explanation || null,
          row.tip_text || null,
          parseInt(row.points) || 10,
          row.memory_recall_text || null,
          row.theme || null
        ]
      );
      inserted++;
    } catch (err) {
      console.error(`Error inserting row: ${err.message}`);
      errors++;
    }
  }

  console.log(`Import complete: ${inserted} inserted, ${errors} errors`);
  await pool.end();
}

run().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

# BrainPing API Reference

## Webhook Endpoint

### POST /webhook/chatwoot
Receives incoming messages from Chatwoot.

**Payload** (from Chatwoot):
```json
{
  "event": "message_created",
  "message_type": "incoming",
  "content": "user message text",
  "conversation": { "id": 123 },
  "meta": { "sender": { "phone_number": "+919876543210" } }
}
```

## Admin API

All admin endpoints require session authentication. Login first with POST /api/admin/login.

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | /api/admin/login | `{ password }` | `{ success: true }` |
| POST | /api/admin/logout | - | `{ success: true }` |

### Dashboard
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | /api/admin/dashboard | `{ totalUsers, activeToday, messagesSent, windowOpenCount, premiumUsers, monthlyRevenue }` |

### Test Mode & Whitelist
| Method | Endpoint | Body/Query | Response |
|--------|----------|------------|----------|
| GET | /api/admin/test-mode | - | `{ testMode, whitelist }` |
| PUT | /api/admin/test-mode | `{ enabled }` | `{ success }` |
| GET | /api/admin/whitelist | - | `[{ id, phone, label, ... }]` |
| POST | /api/admin/whitelist | `{ phone, label, difficulty, time_slot }` | `{ success }` |
| DELETE | /api/admin/whitelist/:id | - | `{ success }` |

### Users
| Method | Endpoint | Query | Response |
|--------|----------|-------|----------|
| GET | /api/admin/users | page, limit, search, status | `{ users, total, page }` |
| GET | /api/admin/users/:id | - | `{ user, sessions }` |
| PUT | /api/admin/users/:id | user fields | `{ success }` |

### Questions
| Method | Endpoint | Body/Query | Response |
|--------|----------|------------|----------|
| GET | /api/admin/questions | type, difficulty, audience, page, limit | `{ questions, total }` |
| POST | /api/admin/questions | question fields | `{ success, id }` |
| PUT | /api/admin/questions/:id | question fields | `{ success }` |
| DELETE | /api/admin/questions/:id | - | `{ success }` |
| POST | /api/admin/questions/generate | `{ type, difficulty, audience, count }` | `{ questions: [...] }` |
| POST | /api/admin/questions/bulk-save | `{ questions: [...] }` | `{ success, count }` |
| POST | /api/admin/questions/import-csv | multipart file | `{ success, count }` |

### Settings
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | /api/admin/settings | - | `{ key: value, ... }` |
| PUT | /api/admin/settings | `{ settings: { key: value } }` | `{ success }` |

### Plans
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | /api/admin/plans | - | `[{ id, name, ... }]` |
| POST | /api/admin/plans | plan fields | `{ success, id }` |
| PUT | /api/admin/plans/:id | plan fields | `{ success }` |

## User Portal API

All portal endpoints require session authentication via OTP login.

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | /api/portal/login | `{ phone }` | `{ success, message: "OTP sent" }` |
| POST | /api/portal/login | `{ phone, otp }` | `{ success: true }` |

### Portal Endpoints
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | /api/portal/dashboard | `{ user, stats, recentSessions }` |
| GET | /api/portal/results?month=3&year=2026 | `{ sessions, month, year }` |
| GET | /api/portal/assessments | `{ assessments }` |
| GET | /api/portal/badges | `{ badges }` |
| GET | /api/portal/leaderboard | `{ leaderboard, myRank }` |
| GET | /api/portal/subscription | `{ currentPlan, isPremium, allPlans }` |
| PUT | /api/portal/settings | `{ time_slot, difficulty }` | `{ success }` |

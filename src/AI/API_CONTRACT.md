# AI ↔ Backend API Contract

> Base URL: `http://<host>:8000/api/v1`

---

## 1. POST `/optimize-schedule` — Generate Study Plan

### Request (Backend → AI)

```json
{
  "user_id": 777,
  "deadline": "2026-04-26",
  "raw_history": {
    "recent_tasks": [
      {
        "id": 1000,
        "subject_id": 1,
        "estimated": 60.0,
        "actual": 72.5,
        "status": "completed"
      }
    ],
    "behavioral_logs": {
      "snooze_count_today": 2,
      "last_focus_ratings": [3, 4, 5],
      "study_hours_today": 4.5
    }
  },
  "current_tasks_to_plan": [
    {
      "id": 1,
      "subject": "Computer Science",
      "priority": 1,
      "difficulty_rating": 8,
      "days_since_last_study": 1,
      "consecutive_days_studied": 2
    }
  ],
  "available_slots": [
    {
      "start_time": "08:00",
      "end_time": "12:00"
    }
  ]
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `user_id` | `int` | Unique student ID |
| `deadline` | `string` | Global exam deadline, format `YYYY-MM-DD` |
| **raw_history.recent_tasks[]** | | Historical completed/snoozed tasks for ML training |
| `.id` | `int?` | Original task ID from DB (optional) |
| `.subject_id` | `int` | Subject identifier |
| `.estimated` | `float` | AI-suggested duration in minutes |
| `.actual` | `float` | Actual time spent in minutes |
| `.status` | `string` | `"completed"`, `"snoozed"`, etc. |
| **raw_history.behavioral_logs** | | Today's behavioral signals |
| `.snooze_count_today` | `int` | How many times student snoozed today |
| `.last_focus_ratings` | `List[int]` | Recent focus self-ratings (1–5) |
| `.study_hours_today` | `float` | Total hours studied today |
| **current_tasks_to_plan[]** | | Tasks the AI must schedule today |
| `.id` | `int` | Task ID |
| `.subject` | `string` | Subject name |
| `.priority` | `int` | Priority level |
| `.difficulty_rating` | `int` | User-rated difficulty (1–10) |
| `.days_since_last_study` | `int` | Days since this subject was last studied |
| `.consecutive_days_studied` | `int` | Consecutive days this subject has been studied |
| **available_slots[]** | | Time windows the student is free |
| `.start_time` | `string` | Slot start, format `HH:MM` |
| `.end_time` | `string` | Slot end, format `HH:MM` |

---

### Response (AI → Backend)

```json
{
  "status": "success",
  "analysis_results": {
    "user": 777,
    "mode": "Machine Learning (Personalized Models)",
    "burnout_score": 0.35,
    "is_exhausted": false,
    "difficulty_factors": {
      "1": 1.15
    }
  },
  "ai_schedule": {
    "scheduled_slots": [
      {
        "time_slot": "08:00",
        "subject": "Computer Science (Part 1)",
        "adjusted_duration_minutes": 50,
        "activity_type": "study",
        "task_id": 1
      },
      {
        "time_slot": "08:50",
        "subject": "Break",
        "adjusted_duration_minutes": 10,
        "activity_type": "break",
        "task_id": null
      }
    ],
    "postponed_tasks": [],
    "ai_message": "Strategic summary about the plan and deadline countdown."
  }
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"success"` on 200 |
| **analysis_results** | | ML/heuristic analysis output |
| `.user` | `int` | Echo of `user_id` |
| `.mode` | `string` | `"Cold Start (Heuristics)"` (< 40 tasks) or `"Machine Learning (Personalized Models)"` (≥ 40 tasks) |
| `.burnout_score` | `float` | Risk score `0.0–1.0`. ≥ 0.75 = exhausted |
| `.is_exhausted` | `bool` | `true` if burnout ≥ 0.75 |
| `.difficulty_factors` | `Dict[str, float]` | Per-subject difficulty multiplier (key = subject_id). `1.0` = on track, `> 1.0` = takes longer, `< 1.0` = faster |
| **ai_schedule** | | Gemini-generated schedule |
| `.scheduled_slots[]` | | Ordered list of study/break blocks |
| `.time_slot` | `string` | Start time `HH:MM` (always `:00` or `:30`) |
| `.subject` | `string` | Subject name or `"Break"` |
| `.adjusted_duration_minutes` | `int` | 50 for study, 10 for break |
| `.activity_type` | `string` | `"study"` or `"break"` |
| `.task_id` | `int?` | Task ID or `null` for breaks |
| `.postponed_tasks` | `List[int]` | Task IDs skipped due to burnout protection (consecutive_days ≥ 3) |
| `.ai_message` | `string` | Human-readable strategic summary (Arabic/English) with deadline countdown |

#### Error Response (Gemini failure)

```json
{
  "status": "success",
  "analysis_results": { ... },
  "ai_schedule": {
    "error": "Failed to generate schedule from AI.",
    "details": "Error message string"
  }
}
```

---

## Key Business Rules

- **Cold Start → ML Transition**: AI uses heuristics until a user/subject accumulates **≥ 40 completed tasks**, then switches to personalized ML models.
- **Burnout Threshold**: `burnout_score ≥ 0.75` → student is exhausted → AI reduces sessions and adds rest blocks.
- **Outlier Filtering**: Tasks where `actual > 3× estimated` are excluded from ML training.
- **Retraining Policy**: Difficulty models retrain every **10 new completed tasks**.
- **50/10 Method**: All study sessions are max 50 min, followed by 10 min breaks.
- **Subject Burnout Protection**: If `consecutive_days_studied ≥ 3`, that subject is postponed for the day.
- **Rotation Rule**: If `days_since_last_study > 3`, subject gets top scheduling priority.

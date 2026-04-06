import requests

# رابط السيرفر الخاص بك
URL = "http://127.0.0.1:8000/api/v1/optimize-schedule"

# البيانات الوهمية التي تحاكي ما سيرسله الـ Backend
dummy_data = {
  "user_id": "student_101",
  "raw_history": {
    "recent_tasks": [
      {"subject": "Math", "estimated": 60, "actual": 85, "status": "completed"},
      {"subject": "History", "estimated": 30, "actual": 25, "status": "completed"}
    ],
    "behavioral_logs": {
      "snooze_count_today": 4,
      "last_focus_ratings": [3, 4, 2],
      "study_hours_today": 7.5
    }
  },
  "current_tasks_to_plan": [
    {"id": 501, "subject": "Math", "estimated_min": 60, "priority": 1},
    {"id": 502, "subject": "Physics", "estimated_min": 45, "priority": 2}
  ],
  "available_slots": ["08:00", "10:00", "13:00"]
}

print("⏳ Sending data to AI Engine...")

# إرسال البيانات كـ POST Request
response = requests.post(URL, json=dummy_data)

# طباعة الرد القادم من سيرفرك
print(f"Status Code: {response.status_code}")
print("Response from AI:")
print(response.json())
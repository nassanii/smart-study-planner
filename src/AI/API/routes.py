from fastapi import APIRouter
from Core.models.incoming_payload import IncomingPayload

# استيراد الدوال التي كتبناها للتو
from utils.math_helpers import calculate_burnout_score, calculate_difficulty_factor

router = APIRouter()

@router.post("/optimize-schedule")
async def process_student_data(payload: IncomingPayload):
    print(f"✅ Processing data for user: {payload.user_id}")
    
    # 1. استخراج البيانات الخام
    logs = payload.raw_history.behavioral_logs
    recent_tasks = payload.raw_history.recent_tasks
    
    # 2. تشغيل دوال الذكاء (تحليل البيانات)
    burnout_score = calculate_burnout_score(
        snooze_count=logs.snooze_count_today, 
        study_hours=logs.study_hours_today
    )
    
    difficulty_factor = calculate_difficulty_factor(recent_tasks=recent_tasks)
    
    # 3. اتخاذ قرار مبدئي بناءً على الأرقام
    is_exhausted = burnout_score >= 0.75
    
    print(f"📊 Burnout Score: {burnout_score} | Difficulty Factor: {difficulty_factor}")
    if is_exhausted:
        print("⚠️ التحذير: الطالب مجهد جداً، يجب تخفيف الجدول!")

    # 4. إعادة النتائج (الخلاصة الذكية) للـ Backend
    return {
        "status": "success",
        "analysis_results": {
            "user": payload.user_id,
            "burnout_score": burnout_score,
            "is_exhausted": is_exhausted,
            "overall_difficulty_factor": difficulty_factor,
            "tasks_to_reschedule": len(payload.current_tasks_to_plan)
        }
    }
from fastapi import APIRouter
from Core.models.incoming_payload import IncomingPayload

from ml_models.model_manager import manage_models
from ml_models.gemini_service import generate_intelligent_schedule

router = APIRouter()

@router.post("/optimize-schedule")
async def process_student_data(payload: IncomingPayload):
    print(f" Processing data for user: {payload.user_id}")
    
    logs = payload.raw_history.behavioral_logs
    recent_tasks = payload.raw_history.recent_tasks
    
    burnout_score, difficulty_factor, mode = manage_models(
        user_id=payload.user_id,
        recent_tasks=recent_tasks,
        logs=logs
    )
    
    is_exhausted = burnout_score >= 0.75
    
    print(f" Calculation Mode: {mode} | Burnout Score: {burnout_score} | Difficulty Factor: {difficulty_factor}")
    if is_exhausted:
        print(" User is likely exhausted. Prioritizing rest in schedule optimization.")

    tasks_to_plan_dict = [task.model_dump() for task in payload.current_tasks_to_plan]
    available_slots_dict = [slot.model_dump() for slot in payload.available_slots]
    
    intelligent_response = await generate_intelligent_schedule(
        burnout_score=burnout_score,
        difficulty_factor=difficulty_factor,
        is_exhausted=is_exhausted,
        tasks_to_plan=tasks_to_plan_dict,
        available_slots=available_slots_dict,
        deadline=payload.deadline
    )

    return {
        "status": "success",
        "analysis_results": {
            "user": payload.user_id,
            "mode": mode,
            "burnout_score": burnout_score,
            "is_exhausted": is_exhausted,
            "overall_difficulty_factor": difficulty_factor,
        },
        "ai_schedule": intelligent_response
    }
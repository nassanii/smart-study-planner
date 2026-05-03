from fastapi import APIRouter, HTTPException
import os
import json
from Core.models.incoming_payload import IncomingPayload

from ml_models.model_manager import manage_models
from ml_models.gemini_service import generate_intelligent_schedule

router = APIRouter()


@router.post("/optimize-schedule")
async def process_student_data(payload: IncomingPayload):
    print(f" Processing data for user: {payload.user_id}")

    logs = payload.raw_history.behavioral_logs
    recent_tasks = payload.raw_history.recent_tasks

    burnout_score, difficulty_factors, mode = manage_models(
        user_id=payload.user_id,
        recent_tasks=recent_tasks,
        logs=logs,
    )

    is_exhausted = burnout_score >= 0.75

    print(f" Calculation Mode: {mode}")
    print(f" Burnout Score: {burnout_score} | Exhausted: {is_exhausted}")
    print(f" Per-Subject Difficulty Factors: {difficulty_factors}")
    if is_exhausted:
        print(" User is likely exhausted. Prioritizing rest in schedule optimization.")

    tasks_to_plan_dict = [task.model_dump() for task in payload.current_tasks_to_plan]
    subjects_dict = [s.model_dump() for s in payload.subjects]
    available_slots_dict = [slot.model_dump() for slot in payload.available_slots]

    intelligent_response = await generate_intelligent_schedule(
        burnout_score=burnout_score,
        difficulty_factors=difficulty_factors,
        is_exhausted=is_exhausted,
        tasks_to_plan=tasks_to_plan_dict,
        subjects=subjects_dict,
        available_slots=available_slots_dict,
        deadline=payload.deadline,
        mode=mode,
    )

    # Ensure native types for JSON serialization
    burnout_score = float(burnout_score)
    is_exhausted = bool(is_exhausted)
    difficulty_factors = {int(k): float(v) for k, v in difficulty_factors.items()}

    return {
        "status": "success",
        "analysis_results": {
            "user": payload.user_id,
            "mode": mode,
            "burnout_score": burnout_score,
            "is_exhausted": is_exhausted,
            "difficulty_factors": difficulty_factors,
        },
        "ai_schedule": intelligent_response,
    }

@router.get("/analytics/performance/{user_id}")
async def get_performance_metrics(user_id: int):
    """
    Returns the saved ML performance metrics for a specific user.
    """
    metrics_path = os.path.join(os.path.dirname(__file__), "..", "ml_models", "saved_models", f"user_{user_id}", "metrics.json")
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Performance metrics not found for this user.")
        
    try:
        with open(metrics_path, "r") as f:
            metrics_data = json.load(f)
        return {
            "user_id": user_id,
            "metrics": metrics_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading metrics: {str(e)}")
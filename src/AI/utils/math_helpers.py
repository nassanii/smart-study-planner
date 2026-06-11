from typing import List, Dict, Any

def calculate_burnout_score(snooze_count: int, study_hours: float, avg_focus: float = 4.0) -> float:
    """
    Calculates the burnout score (from 0.0 to 1.0).
    Based on: snooze count, study hours, and average focus rating.
    """
    # Base score: snooze count and study hours
    base_score = (snooze_count * 0.10) + (study_hours * 0.05)
    
    # Low focus penalty: if focus is less than 3, add extra burnout
    focus_penalty = 0
    if avg_focus < 3:
        focus_penalty = (3 - avg_focus) * 0.15
    elif avg_focus >= 4.5:
        base_score *= 0.9 # Slight reduction if focus is excellent
        
    score = base_score + focus_penalty
    
    # Ensure score does not exceed 1.0 (i.e., 100%)
    return min(max(0.0, round(score, 2)), 1.0)

def calculate_difficulty_factor(recent_tasks: List[Dict[str, Any]]) -> float:
    """
    Calculates the difficulty factor as the average ratio between actual and estimated time.
    If the factor is > 1, tasks are taking longer than estimated.
    """
    if not recent_tasks:
        return 1.0 # If no recent tasks, assume estimation is accurate
        
    total_factor = 0
    valid_tasks = 0
    
    for task in recent_tasks:
        # Ensure data exists and avoid division by zero
        if task.get("status") == "completed" and task.get("estimated", 0) > 0:
            factor = task["actual"] / task["estimated"]
            total_factor += factor
            valid_tasks += 1
            
    if valid_tasks == 0:
        return 1.0
        
    # Calculate average
    average_factor = total_factor / valid_tasks
    return round(average_factor, 2)
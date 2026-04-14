from typing import List, Dict, Any

def calculate_burnout_score(snooze_count: int, study_hours: float, avg_focus: float = 4.0) -> float:
    """
    يحسب نسبة الإرهاق (من 0.0 إلى 1.0).
    يعتمد على: عدد التأجيلات، ساعات الدراسة، وجودة التركيز.
    """
    # القاعدة الأساسية: السنوز وساعات الدراسة
    base_score = (snooze_count * 0.10) + (study_hours * 0.05)
    
    # عقوبة التركيز المنخفض: إذا كان التركيز أقل من 3، نضيف إرهاق إضافي
    focus_penalty = 0
    if avg_focus < 3:
        focus_penalty = (3 - avg_focus) * 0.15
    elif avg_focus >= 4.5:
        base_score *= 0.9 # تخفيض بسيط إذا كان التركيز خارق
        
    score = base_score + focus_penalty
    
    # التأكد من أن النتيجة لا تتجاوز 1.0 (أي 100%)
    return min(max(0.0, round(score, 2)), 1.0)

def calculate_difficulty_factor(recent_tasks: List[Dict[str, Any]]) -> float:
    """
    يحسب عامل الصعوبة بمتوسط الفرق بين الوقت المتوقع والفعلي.
    إذا كان الرقم > 1، فالمهام تستغرق وقتاً أطول من المتوقع.
    """
    if not recent_tasks:
        return 1.0 # إذا لم يكن هناك مهام سابقة، نفترض أن التقدير دقيق
        
    total_factor = 0
    valid_tasks = 0
    
    for task in recent_tasks:
        # التأكد من وجود البيانات وعدم القسمة على صفر
        if task.get("status") == "completed" and task.get("estimated", 0) > 0:
            factor = task["actual"] / task["estimated"]
            total_factor += factor
            valid_tasks += 1
            
    if valid_tasks == 0:
        return 1.0
        
    # حساب المتوسط (Average)
    average_factor = total_factor / valid_tasks
    return round(average_factor, 2)
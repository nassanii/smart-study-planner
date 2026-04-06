from pydantic import BaseModel
from typing import List

class BehavioralLogs(BaseModel):
    snooze_count_today: int
    last_focus_ratings: List[int]
    study_hours_today: float

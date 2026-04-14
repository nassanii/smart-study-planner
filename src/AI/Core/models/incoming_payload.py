from pydantic import BaseModel
from typing import List
from .raw_history import RawHistory
from .task import Task
from .time_range import TimeRange

class IncomingPayload(BaseModel):
    user_id: int
    deadline: str # Global deadline for all subjects (e.g., "2024-06-15")
    raw_history: RawHistory
    current_tasks_to_plan: List[Task]
    available_slots: List[TimeRange] # Changed from List[str]

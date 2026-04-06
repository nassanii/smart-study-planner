from pydantic import BaseModel
from typing import List
from .raw_history import RawHistory
from .task import Task

class IncomingPayload(BaseModel):
    user_id: str
    raw_history: RawHistory
    current_tasks_to_plan: List[Task]
    available_slots: List[str]

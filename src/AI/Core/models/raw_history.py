from pydantic import BaseModel
from typing import List
from .behavioral_logs import BehavioralLogs
from .recent_task import RecentTask

class RawHistory(BaseModel):
    recent_tasks: List[RecentTask]
    behavioral_logs: BehavioralLogs

from pydantic import BaseModel
from typing import List, Dict, Any
from .behavioral_logs import BehavioralLogs

class RawHistory(BaseModel):
    recent_tasks: List[Dict[str, Any]]
    behavioral_logs: BehavioralLogs

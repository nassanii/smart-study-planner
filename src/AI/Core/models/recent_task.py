from typing import Optional
from pydantic import BaseModel


class RecentTask(BaseModel):
    id: Optional[int] = None  # Original task ID from DB
    subject_id: int
    estimated: float  # AI-suggested minutes
    actual: float     # Actual minutes spent
    status: str       # "completed", "snoozed", etc.

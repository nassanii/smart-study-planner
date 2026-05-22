from pydantic import BaseModel
from typing import Optional


class FixedBlock(BaseModel):
    """A manually-scheduled study block that the AI scheduler must NOT overwrite or overlap.

    The AI should treat these times as already committed and plan ONLY around them.
    """
    subject: str
    start_time: str  # "HH:MM" format
    duration_minutes: int
    topic: Optional[str] = None
    task_id: Optional[int] = None

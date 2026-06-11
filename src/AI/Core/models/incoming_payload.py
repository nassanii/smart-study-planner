from pydantic import BaseModel
from typing import List
from .raw_history import RawHistory
from .time_range import TimeRange
from .subject import Subject
from .fixed_block import FixedBlock

class IncomingPayload(BaseModel):
    user_id: int
    deadline: str # Global deadline for all subjects (e.g., "2024-06-15")
    raw_history: RawHistory
    subjects: List[Subject] = []
    available_slots: List[TimeRange] # Changed from List[str]
    fixed_blocks: List[FixedBlock] = [] # User-created manual blocks the AI must NOT overlap

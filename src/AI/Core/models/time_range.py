from pydantic import BaseModel

class TimeRange(BaseModel):
    start_time: str # e.g., "08:00"
    end_time: str   # e.g., "12:00"

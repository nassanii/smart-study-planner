from pydantic import BaseModel

class Task(BaseModel):
    id: int
    subject: str
    estimated_min: int
    priority: int

from typing import Optional

class Subject(BaseModel):
    id: int
    name: str
    difficulty: int
    priority: int
    exam_date: Optional[str] = None

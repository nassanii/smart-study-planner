from pydantic import BaseModel

class Task(BaseModel):
    id: int
    subject: str
    priority: int
    difficulty_rating: int # Added 1-10 rating from user feedback
    days_since_last_study: int # To prevent "Forgotten Subjects"
    consecutive_days_studied: int # To prevent "Subject Burnout"
    estimated_minutes: int
    actual_minutes: int

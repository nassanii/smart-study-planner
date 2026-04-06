import os
import json
import google.generativeai as genai
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

async def generate_intelligent_schedule(
    burnout_score: float, 
    difficulty_factor: float, 
    is_exhausted: bool, 
    tasks_to_plan: List[Dict[str, Any]], 
    available_slots: List[str]
) -> Dict[str, Any]:
    
    # Reload to catch .env updates without restarting server automatically
    load_dotenv(override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key or api_key == "YOUR_API_KEY_HERE" or api_key == "":
        return {
            "error": "Gemini API key is missing. Please add it to the .env file."
        }
        
    genai.configure(api_key=api_key)

    # We use Gemini 2.5 Flash for speed, cost, and JSON generation abilities
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    You are an intelligent Study Planner AI. 
    Your goal is to allocate the following studying tasks into the available time slots.
    
    STUDENT CONTEXT:
    - Burnout Score: {burnout_score} (0 is fresh, 1 is completely exhausted)
    - Is Exhausted: {is_exhausted}
    - Difficulty Factor: {difficulty_factor} (If > 1, tasks take longer than expected, multiply estimated times by this factor).
    
    TASKS TO PLAN:
    {json.dumps(tasks_to_plan, indent=2)}
    
    AVAILABLE SLOTS (times of day):
    {json.dumps(available_slots, indent=2)}
    
    INSTRUCTIONS:
    1. If the student is exhausted (is_exhausted=True), you MUST schedule breaks and consider postponing lower priority tasks.
    2. Multiply the 'estimated_min' for each task by the Difficulty Factor to get the realistic 'adjusted_duration_minutes'.
    3. Map tasks to the available slots.
    4. Provide a supportive, personalized 'ai_message' to the student.
    
    Provide your output STRICTLY as a JSON object matching this exact structure:
    {{
        "scheduled_slots": [
            {{
                "time_slot": "08:00",
                "task_id": 501, 
                "subject": "Math",
                "adjusted_duration_minutes": 67, 
                "activity_type": "study"
            }}
        ],
        "postponed_tasks": [],
        "ai_message": "Your message here..."
    }}
    """
    
    try:
        # Use async generation and enforce JSON return type
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {
            "error": "Failed to generate schedule from AI.",
            "details": str(e)
        }

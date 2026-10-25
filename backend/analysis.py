import os
from anthropic import Anthropic
from dotenv import load_dotenv
import json

# Load the API key from the .env file
load_dotenv()

# Create the Anthropic client using the key from .env
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def analyze_wifi_coverage(measurements: list, network_info: dict) -> dict:
    # Sends wifi measurements and network info to Claude
    # Returns AI generated analysis and router recommendations
    try:
        # Format measurements into readable text for Claude
        measurement_text = ""
        for m in measurements:
            measurement_text += f"- Location ({m['x']:.2f}, {m['y']:.2f}) on {m['scan_id']}: signal {m['signal']}% on {m['ssid']}\n"

        # Build the prompt to send to Claude
        prompt = f"""You are a professional Wi-Fi network analyst. 
    
A user has collected Wi-Fi measurements throughout their building and needs your expert analysis.

Network Information:
- Number of current routers/access points: {network_info.get('router_count', 'Unknown')}
- Budget for improvements: {network_info.get('budget', 'Unknown')}
- Main pain points: {network_info.get('pain_points', 'Unknown')}

Wi-Fi Measurements (x and y are positions on the floor plan from 0 to 1):
{measurement_text}

Please provide:
1. Overall coverage score out of 100
2. Identification of dead zones (areas with signal below 50%)
3. Root cause analysis of weak coverage areas
4. Specific router placement recommendations with coordinates
5. Equipment recommendations within their budget
6. A summary a non-technical person can understand

Be specific and actionable. Reference actual coordinates from the measurements.

Return your response as a JSON object with exactly these fields:
{{
    "coverage_score": <number 0-100>,
    "summary": "<plain english summary a non-technical person can understand>",
    "dead_zones": [
        {{"x": <float>, "y": <float>, "signal": <int>, "severity": "<critical|moderate>"}}
    ],
    "router_recommendations": [
        {{"x": <float>, "y": <float>, "reason": "<why place router here>"}}
    ],
    "equipment_recommendations": "<text advice within their budget>"
}}

Return only the JSON object, no extra text, no markdown, no backticks."""
        # Send the prompt to Claude and get a response
        message = client.messages.create(
            model="claude-sonnet-4-6",      # Current Claude model in use
            max_tokens=2048,                 # Maximum length of the response
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        # Pull the text out of Claude's response
        response_text = message.content[0].text

        # Parse Claude's JSON response into a Python dictionary
        response_data = json.loads(response_text)

        # Return the structured analysis
        return {
            "analysis": response_data,
            "measurement_count": len(measurements),
            "network_info": network_info
        }
    # If anything goes wrong calling Claude, catch it and return an error
    except Exception as e:
        return {
            "error": f"Analysis failed: {str(e)}"
        }

import os
from dotenv import load_dotenv

def verify_env():
    # Try loading from .env in current dir
    load_dotenv()
    
    key = os.getenv("ANTHROPIC_API_KEY")
    
    print("-" * 40)
    print("Environment Verification")
    print("-" * 40)
    
    if not key:
        print("❌ ANTHROPIC_API_KEY is MISSING in environment.")
        # Check if .env file exists
        if os.path.exists(".env"):
            print("   .env file exists but verify content.")
        else:
            print("   .env file NOT found in current directory.")
            
    else:
        if key.startswith("sk-ant-"):
            print("✅ ANTHROPIC_API_KEY is present and has correct prefix.")
            print(f"   Key length: {len(key)}")
        elif key == "your_anthropic_api_key":
            print("❌ ANTHROPIC_API_KEY is set to placeholder value.")
        else:
            print("⚠️ ANTHROPIC_API_KEY is present but has unusual format.")
            print(f"   Value starts with: {key[:5]}...")
            
    print("-" * 40)

if __name__ == "__main__":
    verify_env()

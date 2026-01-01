
import os
from dotenv import load_dotenv, find_dotenv
import pathlib

print("=== Environment Diagnostic ===")
cwd = os.getcwd()
print(f"Current Working Directory: {cwd}")

# Try to find .env
env_path = find_dotenv(usecwd=True)
print(f"find_dotenv found: {env_path}")

if env_path:
    print(f"Loading .env from: {env_path}")
    load_dotenv(env_path)
else:
    print("No .env file found by dotenv.")
    # Check manually in CWD
    manual_env = os.path.join(cwd, ".env")
    if os.path.exists(manual_env):
        print(f"Wait, .env exists at {manual_env} but find_dotenv didn't pick it up?")
        load_dotenv(manual_env)

# Check Keys
key = os.environ.get("ANTHROPIC_API_KEY")
if key:
    print(f"ANTHROPIC_API_KEY is SET. Length: {len(key)}")
    if key.startswith("sk-"):
        print("Key format looks correct (starts with sk-)")
    else:
        print("Key format might be invalid (does not start with sk-)")
else:
    print("ANTHROPIC_API_KEY is NOT SET in environment.")

print("============================")

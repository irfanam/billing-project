from dotenv import load_dotenv
from supabase import create_client, Client
import os
import logging

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')


logging.info(f"SUPABASE_URL: {SUPABASE_URL}")
logging.info(f"SUPABASE_KEY: {SUPABASE_KEY[:8]}... (truncated)")
if not SUPABASE_URL or not SUPABASE_KEY:
	logging.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
	raise RuntimeError('SUPABASE_URL and SUPABASE_KEY must be set in the environment')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

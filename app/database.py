from dotenv import load_dotenv
from supabase import create_client, Client
import os

load_dotenv()

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
 

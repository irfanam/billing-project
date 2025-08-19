from fastapi import APIRouter
from app.models import BillingRecord
from app.database import supabase

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.post("/")
async def create_billing(record: BillingRecord):
    res = supabase.table('billing').insert(record.dict()).execute()
    return {"status": "success", "data": res.data}

@router.get("/{user_id}")
async def get_billing(user_id: str):
    res = supabase.table('billing').select('*').eq('user_id', user_id).execute()
    return {"status": "success", "data": res.data}

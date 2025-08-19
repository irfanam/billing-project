from fastapi import APIRouter, HTTPException
from app.models import BillingRecord
from app.database import supabase
from starlette.concurrency import run_in_threadpool
import logging

router = APIRouter(prefix="/billing", tags=["Billing"])


def _insert_billing(record_dict: dict):
    return supabase.table('billing').insert(record_dict).execute()


def _select_billing(user_id: str):
    return supabase.table('billing').select('*').eq('user_id', user_id).execute()


@router.post("/")
async def create_billing(record: BillingRecord):
    res = await run_in_threadpool(_insert_billing, record.dict())
    if getattr(res, 'error', None):
        logging.error('Supabase insert error: %s', res.error)
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}


@router.get("/{user_id}")
async def get_billing(user_id: str):
    res = await run_in_threadpool(_select_billing, user_id)
    if getattr(res, 'error', None):
        logging.error('Supabase select error: %s', res.error)
        raise HTTPException(status_code=500, detail=str(res.error))
    return {"status": "success", "data": res.data}

from fastapi import APIRouter

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.get("/")
def get_bills():
    return {"message": "List of bills"}

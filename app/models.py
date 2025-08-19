from pydantic import BaseModel

class BillingRecord(BaseModel):
    user_id: str
    amount: float
    description: str
 

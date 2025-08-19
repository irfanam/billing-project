from fastapi import FastAPI
from . import routes

app = FastAPI(title="Billing Project")

app.include_router(routes.router)

@app.get("/")
def root():
    return {"message": "Welcome to the Billing Project API"}

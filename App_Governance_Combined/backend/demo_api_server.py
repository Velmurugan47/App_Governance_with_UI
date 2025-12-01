from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import asyncio
import json
from datetime import datetime

app = FastAPI(title="Ticket Portal API - Demo Mode", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

# Global state for tickets
current_tickets: Dict[str, Any] = {}

# Mock ticket data
MOCK_TICKETS = [
    {
        "id": "TKT-IAM-001",
        "title": "Access Request for Finance Application",
        "description": "User needs access to the finance application for quarterly reporting",
        "customer": "John Smith",
        "priority": "high",
        "createdAt": "2025-11-29 09:00 AM",
        "category": "IAM",
        "slaDeadline": "2025-12-01",
        "aitNumber": "AIT-12345",
        "applicationName": "Finance Portal",
        "armId": "ARM-001",
        "lobOwner": "finance@company.com",
        "aitOwner": "it@company.com",
        "contacts": ["john.smith@company.com", "manager@company.com"]
    },
    {
        "id": "TKT-IAM-002",
        "title": "Role Modification for HR System",
        "description": "Update user roles and permissions in the HR management system",
        "customer": "Emily Davis",
        "priority": "urgent",
        "createdAt": "2025-11-29 08:15 AM",
        "category": "IAM",
        "slaDeadline": "2025-11-30",
        "aitNumber": "AIT-12346",
        "applicationName": "HR Portal",
        "armId": "ARM-002",
        "lobOwner": "hr@company.com",
        "aitOwner": "it@company.com",
        "contacts": ["emily.davis@company.com", "hr-manager@company.com"]
    },
    {
        "id": "TKT-IAM-003",
        "title": "Deactivate User Account - Employee Departure",
        "description": "Remove access for departing employee and archive data",
        "customer": "Robert Wilson",
        "priority": "medium",
        "createdAt": "2025-11-28 14:20 PM",
        "category": "IAM",
        "slaDeadline": "2025-12-02",
        "aitNumber": "AIT-12347",
        "applicationName": "Corporate Systems",
        "armId": "ARM-003",
        "lobOwner": "operations@company.com",
        "aitOwner": "it@company.com",
        "contacts": ["robert.wilson@company.com", "ops-manager@company.com"]
    }
]

def create_ticket_with_stages(mock_ticket):
    """Create a ticket object with stage information"""
    return {
        **mock_ticket,
        "currentStage": 0,
        "status": "not-started",
        "stages": [
            {"id": 1, "name": "Ticket Fetching", "status": "pending", "message": ""},
            {"id": 2, "name": "Category Check", "status": "pending", "message": ""},
            {"id": 3, "name": "SLA Prioritization", "status": "pending", "message": ""},
            {"id": 4, "name": "Ownership Enrichment", "status": "pending", "message": ""},
            {"id": 5, "name": "App Owner Check", "status": "pending", "message": ""},
            {"id": 6, "name": "Evidence Collection", "status": "pending", "message": ""},
            {"id": 7, "name": "Ticket Closure", "status": "pending", "message": ""},
            {"id": 8, "name": "Logging", "status": "pending", "message": ""},
        ]
    }

async def update_stage_progress(ticket_id: str, stage_index: int, status: str, message: str):
    """Update ticket stage progress and broadcast to WebSocket clients"""
    if ticket_id in current_tickets:
        current_tickets[ticket_id]["currentStage"] = stage_index
        current_tickets[ticket_id]["stages"][stage_index]["status"] = status
        current_tickets[ticket_id]["stages"][stage_index]["message"] = message
        
        if status == "in-progress":
            current_tickets[ticket_id]["status"] = "in-progress"
        elif status == "completed" and stage_index == 7:
            current_tickets[ticket_id]["status"] = "completed"
        
        await manager.broadcast({
            "type": "ticket_update",
            "ticket": current_tickets[ticket_id]
        })

async def process_individual_ticket(ticket_id: str):
    """Process a single ticket through the agent pipeline"""
    try:
        if ticket_id not in current_tickets:
            await manager.broadcast({
                "type": "error",
                "message": f"Ticket {ticket_id} not found"
            })
            return
        
        ticket = current_tickets[ticket_id]
        current_stage = ticket["currentStage"]
        
        # Start from current stage
        await manager.broadcast({
            "type": "processing_start",
            "message": f"Processing ticket {ticket_id} (Demo Mode)..."
        })
        
        # Stage 1: Category Check (if not done)
        if current_stage < 1:
            await update_stage_progress(ticket_id, 1, "in-progress", "Checking category...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 1, "completed", f"Category: {ticket['category']}")
            current_stage = 1
        
        # Stage 2: SLA Prioritization (if not done)
        if current_stage < 2:
            await update_stage_progress(ticket_id, 2, "in-progress", "Calculating SLA priority...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 2, "completed", f"SLA: {ticket['slaDeadline']}")
            current_stage = 2
        
        # Stage 3: Ownership Enrichment (if not done)
        if current_stage < 3:
            await update_stage_progress(ticket_id, 3, "in-progress", "Fetching ownership details...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 3, "completed", f"Owner: {ticket['lobOwner']}")
            current_stage = 3
        
        # Stage 4: App Owner Check (if not done)
        if current_stage < 4:
            await update_stage_progress(ticket_id, 4, "in-progress", "Checking app owner space...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 4, "completed", "App owner verified")
            current_stage = 4
        
        # Stage 5: Evidence Collection (PAUSE FOR HUMAN REVIEW)
        if current_stage < 5:
            await update_stage_progress(ticket_id, 5, "in-progress", "Preparing evidence emails...")
            await asyncio.sleep(1)
            # Mark as waiting for review
            current_tickets[ticket_id]["waitingForReview"] = True
            await update_stage_progress(ticket_id, 5, "in-progress", "⏸️ Waiting for application team review...")
            
            await manager.broadcast({
                "type": "ticket_update",
                "ticket": current_tickets[ticket_id]
            })
            
            # STOP HERE - wait for human approval
            return
        
        # Stage 6: Ticket Closure (only after review approved)
        if current_stage < 6:
            await update_stage_progress(ticket_id, 6, "in-progress", "Closing ticket...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 6, "completed", "Ticket closed")
            current_stage = 6
        
        # Stage 7: Logging
        if current_stage < 7:
            await update_stage_progress(ticket_id, 7, "in-progress", "Logging...")
            await asyncio.sleep(1)
            await update_stage_progress(ticket_id, 7, "completed", "Logged successfully")
            current_tickets[ticket_id]["status"] = "completed"
        
        await manager.broadcast({
            "type": "processing_complete",
            "message": f"Ticket {ticket_id} processed successfully",
            "ticket": current_tickets[ticket_id]
        })
        
    except Exception as e:
        error_message = f"Error processing ticket {ticket_id}: {str(e)}"
        await manager.broadcast({
            "type": "error",
            "message": error_message
        })

async def load_initial_tickets():
    """Load tickets on startup"""
    for mock_ticket in MOCK_TICKETS:
        ticket = create_ticket_with_stages(mock_ticket)
        # Mark first stage as completed (tickets are already fetched)
        ticket["stages"][0]["status"] = "completed"
        ticket["stages"][0]["message"] = "Ticket fetched successfully"
        ticket["currentStage"] = 0
        current_tickets[ticket["id"]] = ticket

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Ticket Portal API is running in Demo Mode"}

@app.get("/api/tickets")
async def get_tickets():
    """Get all tickets"""
    return JSONResponse(content={
        "tickets": list(current_tickets.values()),
        "count": len(current_tickets)
    })

@app.post("/api/tickets/{ticket_id}/process")
async def process_single_ticket(ticket_id: str):
    """Process a single ticket through the agent pipeline"""
    try:
        asyncio.create_task(process_individual_ticket(ticket_id))
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Processing ticket {ticket_id} (Demo Mode)"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/tickets/{ticket_id}/approve-review")
async def approve_review(ticket_id: str):
    """Approve the review and continue processing"""
    try:
        if ticket_id not in current_tickets:
            return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})
        
        ticket = current_tickets[ticket_id]
        
        # Check if waiting for review
        if not ticket.get("waitingForReview", False):
            return JSONResponse(status_code=400, content={"error": "Ticket is not waiting for review"})
        
        # Mark review as completed
        current_tickets[ticket_id]["waitingForReview"] = False
        await update_stage_progress(ticket_id, 5, "completed", "Review approved - Evidence collected")
        current_tickets[ticket_id]["currentStage"] = 5
        
        # Continue processing from stage 6
        asyncio.create_task(process_individual_ticket(ticket_id))
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Review approved for ticket {ticket_id}"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Get specific ticket by ID"""
    if ticket_id in current_tickets:
        return JSONResponse(content=current_tickets[ticket_id])
    else:
        return JSONResponse(status_code=404, content={"error": f"Ticket {ticket_id} not found"})

@app.on_event("startup")
async def startup_event():
    """Load tickets on startup"""
    await load_initial_tickets()
    print("✅ Initial tickets loaded")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        # Send current tickets on connection
        await websocket.send_json({
            "type": "initial_state",
            "tickets": list(current_tickets.values())
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("Starting Ticket Portal API in DEMO MODE")
    print("=" * 60)
    print("Backend: http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

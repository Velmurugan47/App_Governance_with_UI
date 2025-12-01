import json
import os
from schemas.ticket_context import TicketResponse, Ticket
from langchain.agents import create_agent
from langchain_core.tools import Tool
from langchain_core.messages import ToolMessage

# ✅ Tool function for filtering IAM tickets
def fetch_iam_tickets(data_file: str) -> TicketResponse:
    """Fetch tickets from JSON and return only IAM category tickets."""
    with open(data_file, "r") as f:
        sample_data = json.load(f)

    iam_tickets = [Ticket(**t) for t in sample_data if t["category"].upper() == "IAM"]
    return TicketResponse(tickets=iam_tickets)

class TicketFetcherAgent:
    def __init__(self, llm=None, data_file=None):
        self.llm = llm
        self.data_file = data_file or os.path.join(
            os.path.dirname(__file__), "..", "resources", "ticket_data.json"
        )

        # ✅ Register tool
        tools = [
            Tool(
                name="FetchIAMTickets",
                func=lambda _: fetch_iam_tickets(self.data_file),
                description="Fetches tickets from JSON and filters IAM category tickets"
            )
        ]

        # ✅ Create agent with LLM + tool
        self.agent = create_agent(
            model=self.llm,
            tools=tools,
            context_schema=TicketResponse,
            system_prompt="Fetch the IAM tickets using the provided tool."
        )

    def invoke(self) -> TicketResponse:
        # ✅ Call the agent, which internally uses the tool
        result = self.agent.invoke({"messages": [{"role": "user", "content": "Fetch IAM tickets"}]})
        
        # Extract result from ToolMessage
        if isinstance(result, dict) and "messages" in result:
            for msg in reversed(result["messages"]):
                if isinstance(msg, ToolMessage) and msg.name == "FetchIAMTickets":
                    try:
                        return TicketResponse.parse_raw(msg.content)
                    except Exception as e:
                        print(f"Error parsing tool output: {e}")
        
        return TicketResponse(tickets=[])

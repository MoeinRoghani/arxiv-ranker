"""
Research Reader Agent for ACADEMIC READER API

This module contains the research reader agent for the ACADEMIC READER API.
The research reader agent takes a list of research papers, uses web_search to fetch
their content, and produces dense technical distillations of each paper.
"""

from src.agents.bases import precontex_agent_base
from src.utils import get_research_reader_prompt, get_openai_model
from src.tools import READER_TOOLS


#---- Pre Context Function ----#
def reader_context(user_message: str = "", **kwargs) -> str:
    """
    Context function that prepares the analysis context for the research reader agent.
    
    Counts the number of papers detected in the input to give the model
    awareness of the batch size it needs to process.
    """
    config = kwargs.get('config', {})
    configurable = config.get('configurable', {})
    session_id = configurable.get('session_id')

    lines = [line.strip() for line in user_message.strip().splitlines() if line.strip()]
    paper_count = len(lines) if lines else 0
    
    context_parts = [
        f"Context: The user has provided {paper_count} research paper reference(s) for technical distillation.",
        "Use web_search to look up each paper individually. Process every paper in the list.",
    ]
    
    if session_id:
        context_parts.append(f"Session: {session_id}")
    
    return " | ".join(context_parts)

#---- Research Reader Expert Agent ----#
def research_reader_agent_executor():
    """
    Create a research reader agent executor for the ACADEMIC READER API.

    Returns:
        PrecontexAgent: The research reader agent with web_search capability.
    """
    prompt = get_research_reader_prompt()
    model = get_openai_model("gpt-5.4", temperature=0.2, top_p=0.85)

    research_reader_agent = precontex_agent_base(
        model, 
        context_function=reader_context, 
        tools=READER_TOOLS, 
        prompt=prompt, 
        name="research_reader_agent",
    )

    return research_reader_agent

"""
Agent for ACADEMIC READER API

This module contains the research reader agent instance.
Since this system has a single agent (no supervisor needed),
we instantiate the research reader agent directly.
"""

from src.agents.research_reader_agent.agent import research_reader_agent_executor


def create_reader_agent():
    """
    Create the ACADEMIC READER agent.
    
    This is a single-agent system — the research reader agent handles
    all incoming requests for academic analysis and summarization.
    
    Returns:
        PrecontexAgent: The compiled research reader agent
    """
    reader_agent = research_reader_agent_executor()
    reader_agent.name = "research_reader"
    
    return reader_agent


reader_agent = create_reader_agent()

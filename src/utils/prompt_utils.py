"""
Utility functions for prompt management in ACADEMIC READER API

This module provides simple convenience functions to get system prompts
for each agent type in the ACADEMIC READER system.
"""

from src.prompts import ResearchReaderPrompts


def get_research_reader_prompt(**kwargs) -> str:
    """
    Get the research reader system prompt.
    
    Args:
        **kwargs: Optional parameters like user_prompt
        
    Returns:
        str: The research reader system prompt
    """
    return ResearchReaderPrompts().get_system_prompt(**kwargs)

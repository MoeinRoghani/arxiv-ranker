"""
ACADEMIC READER API Prompts Module

This module exports all prompt classes used throughout the ACADEMIC READER system.
"""

from .base import BaseAgentPrompts, AgentPrompts
from .research_reader_prompt import ResearchReaderPrompts

__all__ = [
    'BaseAgentPrompts',
    'AgentPrompts',
    'ResearchReaderPrompts',
]

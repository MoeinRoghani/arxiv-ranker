"""
Utility functions for the ACADEMIC READER API

This module contains utility functions for the ACADEMIC READER API.
"""

from .prompt_utils import get_research_reader_prompt
from .get_openai_model import get_openai_model

__all__ = [
    'get_research_reader_prompt',
    'get_openai_model',
]

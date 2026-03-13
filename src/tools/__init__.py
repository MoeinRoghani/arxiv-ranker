"""
Tools package for Academic Reader API.

Defines the OpenAI built-in tools used by the research reader agent.
Tools are passed directly to the OpenAI Responses API.
"""

WEB_SEARCH_TOOL = {"type": "web_search"}

READER_TOOLS = [WEB_SEARCH_TOOL]

__all__ = [
    'WEB_SEARCH_TOOL',
    'READER_TOOLS',
]

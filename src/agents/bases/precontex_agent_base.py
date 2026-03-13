"""
Precontex Agent Base for ACADEMIC READER API

This module provides the base agent class that injects context before calling
the OpenAI Responses API directly. No LangChain or LangGraph needed.

The agent supports:
- Context injection via a user-provided function
- Built-in OpenAI tools (e.g., web_search)
- Multi-turn conversation via previous_response_id
- Both sync and async invocation
"""

import os
from dataclasses import dataclass
from typing import Any, Callable, Optional, Sequence

from openai import OpenAI, AsyncOpenAI


@dataclass
class AgentMessage:
    """Simple message container matching the interface used by routes."""
    content: str
    name: Optional[str] = None


class PrecontexAgent:
    """Agent that injects context before calling the OpenAI Responses API.
    
    Graph flow (conceptual):
        context_function -> build instructions -> OpenAI Responses API -> extract output

    Attributes:
        model: The OpenAI model name (e.g., "gpt-4o", "gpt-5").
        context_function: Callable that generates context from user input.
        tools: List of OpenAI tool configs (e.g., [{"type": "web_search"}]).
        prompt: System prompt / instructions for the agent.
        name: Agent name used for identification in responses.
    """

    def __init__(
        self,
        model_config: dict,
        context_function: Callable,
        tools: Optional[Sequence[dict]] = None,
        prompt: Optional[str] = None,
        name: Optional[str] = None,
    ):
        self.model = model_config["model"]
        self.temperature = model_config.get("temperature", 0.7)
        self.top_p = model_config.get("top_p", 1.0)
        self.max_output_tokens = model_config.get("max_tokens", 4096)

        api_key = model_config.get("api_key") or os.getenv("OPENAI_API_KEY")

        self.context_function = context_function
        self.tools = list(tools) if tools else []
        self.prompt = prompt or ""
        self.name = name

        if not hasattr(context_function, "name"):
            context_function.name = context_function.__name__
        if not hasattr(context_function, "description"):
            context_function.description = context_function.__doc__ or ""

        self._client = OpenAI(api_key=api_key)
        self._async_client = AsyncOpenAI(api_key=api_key)

        # thread_id -> previous_response_id for multi-turn conversations
        self._conversations: dict[str, str] = {}

    # -------------------- public interface --------------------

    def invoke(self, input_data: dict, config: dict | None = None) -> dict:
        """Synchronous invocation matching the original agent interface.
        
        Args:
            input_data: Dict with "messages" key containing message objects with .content
            config: Optional dict with "configurable" sub-dict (thread_id, session_id, etc.)
            
        Returns:
            Dict with "messages" key containing a list of AgentMessage objects.
        """
        user_message = self._extract_user_message(input_data)
        configurable = (config or {}).get("configurable", {})
        thread_id = configurable.get("thread_id")

        instructions = self._build_instructions(user_message, config)
        kwargs = self._build_api_kwargs(user_message, instructions, thread_id)

        response = self._client.responses.create(**kwargs)

        if thread_id:
            self._conversations[thread_id] = response.id

        text = self._extract_text(response)
        return {"messages": [AgentMessage(content=text, name=self.name)]}

    async def ainvoke(self, input_data: dict, config: dict | None = None) -> dict:
        """Asynchronous invocation matching the original agent interface.
        
        Args:
            input_data: Dict with "messages" key containing message objects with .content
            config: Optional dict with "configurable" sub-dict (thread_id, session_id, etc.)
            
        Returns:
            Dict with "messages" key containing a list of AgentMessage objects.
        """
        user_message = self._extract_user_message(input_data)
        configurable = (config or {}).get("configurable", {})
        thread_id = configurable.get("thread_id")

        instructions = self._build_instructions(user_message, config)
        kwargs = self._build_api_kwargs(user_message, instructions, thread_id)

        response = await self._async_client.responses.create(**kwargs)

        if thread_id:
            self._conversations[thread_id] = response.id

        text = self._extract_text(response)
        return {"messages": [AgentMessage(content=text, name=self.name)]}

    # -------------------- internals --------------------

    def _extract_user_message(self, input_data: dict) -> str:
        messages = input_data.get("messages", [])
        if not messages:
            return ""
        last = messages[-1]
        return last.content if hasattr(last, "content") else str(last)

    def _build_instructions(self, user_message: str, config: dict | None) -> str:
        """Combine the system prompt with the context function output."""
        try:
            context = self.context_function(user_message, config=config or {})
        except Exception as e:
            print(f"Error in context function {self.context_function.name}: {e}")
            context = ""

        if context:
            return f"{self.prompt}\n\n{context}"
        return self.prompt

    def _build_api_kwargs(self, user_message: str, instructions: str, thread_id: str | None) -> dict:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "input": user_message,
            "instructions": instructions,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "max_output_tokens": self.max_output_tokens,
        }

        if self.tools:
            kwargs["tools"] = self.tools

        previous_response_id = self._conversations.get(thread_id) if thread_id else None
        if previous_response_id:
            kwargs["previous_response_id"] = previous_response_id

        return kwargs

    @staticmethod
    def _extract_text(response) -> str:
        """Pull plain text out of the Responses API output items."""
        parts: list[str] = []
        for item in response.output:
            if item.type == "message":
                for block in item.content:
                    if block.type == "output_text":
                        parts.append(block.text)
        return "\n".join(parts) if parts else ""


def precontex_agent_base(
    model_config: dict,
    *,
    context_function: Callable,
    tools: Optional[Sequence[dict]] = None,
    prompt: Optional[str] = None,
    name: Optional[str] = None,
) -> PrecontexAgent:
    """Factory function that creates a PrecontexAgent.
    
    Mirrors the original precontex_agent_base() factory pattern but returns
    a lightweight agent backed by the OpenAI Responses API instead of LangGraph.
    
    Args:
        model_config: Dict returned by get_openai_model() with model name, api_key, etc.
        context_function: Callable that receives (user_message, config=) and returns context string.
        tools: List of OpenAI tool dicts (e.g., [{"type": "web_search"}]).
        prompt: System prompt string.
        name: Agent name.
        
    Returns:
        A PrecontexAgent instance with invoke() / ainvoke() methods.
    """
    if not callable(context_function):
        raise ValueError("context_function must be callable")

    return PrecontexAgent(
        model_config=model_config,
        context_function=context_function,
        tools=tools,
        prompt=prompt,
        name=name,
    )

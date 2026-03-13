import os
from typing import Optional
from pydantic import BaseModel, field_validator


class ChatModelConfig(BaseModel):
    """
    Configuration for the chat model.
    
    Attributes:
    ------------
        provider: The provider of the chat model (e.g., 'openai', 'anthropic').
        model_name: The name of the chat model.
        api_key: The API key for the chat model provider.
        streaming: Whether to stream the chat model responses.
        max_tokens: The maximum number of tokens to generate.
        timeout: The timeout for the chat model in seconds.
        max_retries: The maximum number of retries for the chat model.
        temperature: The temperature for the chat model (0.0-2.0).
        top_p: The top_p sampling for the chat model.
    """

    provider: str = "openai"
    model_name: str = "gpt-4o-mini"
    api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    streaming: bool = False
    max_tokens: int = 4096
    timeout: int = 30
    max_retries: int = 3
    temperature: float = 0.7
    top_p: float = 1.0

    @field_validator('api_key')
    @classmethod
    def validate_api_key(cls, v):
        if not v:
            raise ValueError("API key not provided. Set OPENAI_API_KEY environment variable.")
        return v

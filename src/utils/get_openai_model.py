"""
Utility function to build an OpenAI model configuration dict.

The returned dict is consumed by precontex_agent_base() to configure
the OpenAI Responses API client.

Args:
    model_name: The name of the model to use.
    temperature: The temperature of the model.
    top_p: The top_p of the model.

Returns:
    A configuration dict with model, api_key, temperature, top_p, max_tokens, timeout.
"""

from src.config import ChatModelConfig


def get_openai_model(model_name: str = None, temperature: float = None, top_p: float = None) -> dict:

    if temperature is not None and not (0 <= temperature <= 2):
        raise ValueError(f"Invalid value for temperature: {temperature}. It must be between 0 and 2.")
    if top_p is not None and not (0 <= top_p <= 1):
        raise ValueError(f"Invalid value for top_p: {top_p}. It must be between 0 and 1.")
    
    config = ChatModelConfig()

    return {
        "model": model_name or config.model_name,
        "temperature": temperature if temperature is not None else config.temperature,
        "top_p": top_p if top_p is not None else config.top_p,
        "api_key": config.api_key,
        "max_tokens": config.max_tokens,
        "timeout": config.timeout,
    }

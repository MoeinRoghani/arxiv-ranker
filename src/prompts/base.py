"""
Base agent prompts for ACADEMIC READER API

This module contains the base class for agent prompts in ACADEMIC READER API.

The base class is used to:
- Provide a common interface for all agent prompts
- Provide a common implementation for all agent prompts
- Ensure consistency across all agent prompt configurations
"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseAgentPrompts(ABC):
    """
    Abstract base class for all agent prompts in ACADEMIC READER API.
    
    All prompt classes should inherit from this base and implement
    the required methods to ensure consistency across the system.
    """
    
    @abstractmethod
    def get_system_prompt(self, user_prompt: Optional[str] = None, **kwargs) -> str:
        """
        Get the system prompt for the agent.
        
        Args:
            user_prompt: Optional user-specific instructions to append
            **kwargs: Additional context-specific parameters
            
        Returns:
            str: The complete system prompt for the agent
        """
        pass
    
    def append_user_instructions(self, base_prompt: str, user_prompt: Optional[str]) -> str:
        """
        Append user-specific instructions to the base prompt.
        
        Args:
            base_prompt: The base system prompt
            user_prompt: Optional user instructions
            
        Returns:
            str: Base prompt with user instructions appended if provided
        """
        if user_prompt:
            return base_prompt + f"\n\n## Additional Instructions:\n\n{user_prompt}"
        return base_prompt


class AgentPrompts(BaseAgentPrompts):
    """
    General-purpose prompts for basic agent functionality.
    
    This class provides default implementations for agents that don't
    require specialized prompt configurations.
    """
    
    def get_system_prompt(self, user_prompt: Optional[str] = None, 
                          agent_description: str = "", 
                          agent_instructions: str = "", 
                          **kwargs) -> str:
        """
        Get the base system prompt for a general agent.
        
        Args:
            user_prompt: Optional user-specific instructions
            agent_description: Description of the agent's purpose
            agent_instructions: Specific instructions for the agent
            **kwargs: Additional parameters (reserved for future use)
            
        Returns:
            str: The complete system prompt
        """
        base_prompt = f"""
You are an AI agent in the ACADEMIC READER system.

## Your Role:
{agent_description if agent_description else "A general-purpose assistant agent"}

## Your Responsibilities:
{agent_instructions if agent_instructions else "Follow user instructions and provide helpful, accurate responses"}

## Guidelines:
- Be clear, concise, and helpful in your responses
- Stay focused on your designated role and responsibilities
- If a task is outside your scope, clearly communicate that
- Maintain consistency with the ACADEMIC READER framework
"""
        
        return self.append_user_instructions(base_prompt, user_prompt)

import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, executeTool } from './tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

export const config = {
  runtime: 'nodejs',
  maxDuration: 120
};

const SYSTEM_PROMPT = `You are OmniScribe Assistant, a helpful AI that helps users manage and understand their voice notes.

You have access to tools that let you:
- List and filter notes by date
- Read full note content including transcripts and summaries  
- Semantic search across all notes to find relevant content
- List action items and to-dos from parsed notes
- Get statistics about the notes collection

When users ask about their notes:
1. Use search_notes first to find relevant content
2. Use get_note to read the full content of specific notes
3. Synthesize information from multiple notes when needed
4. Be specific and cite which notes you're referencing

Be concise, helpful, and action-oriented. If asked to create reminders or summaries, format them clearly.

Important: Always search for relevant notes before answering questions about the user's notes or activities.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'messages are required' }, { status: 400 });
    }

    // Convert to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Agent loop - keep calling until we get a final response
    let currentMessages = [...anthropicMessages];
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema
        })),
        messages: currentMessages
      });

      // Check if the model wants to use a tool
      if (response.stop_reason === 'tool_use') {
        const toolUseBlock = response.content.find(
          (block) => block.type === 'tool_use'
        ) as Anthropic.ToolUseBlock | undefined;

        if (toolUseBlock) {
          console.log(`[Agent] Calling tool: ${toolUseBlock.name}`, toolUseBlock.input);

          try {
            const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input as Record<string, unknown>);
            
            // Add assistant message with tool use
            currentMessages.push({
              role: 'assistant',
              content: response.content
            });

            // Add tool result
            currentMessages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult)
              }]
            });
          } catch (toolError) {
            // Add tool error result
            currentMessages.push({
              role: 'assistant',
              content: response.content
            });
            currentMessages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: `Error: ${toolError instanceof Error ? toolError.message : 'Tool execution failed'}`,
                is_error: true
              }]
            });
          }
          continue;
        }
      }

      // Final response - extract text and return
      const textBlock = response.content.find(
        (block) => block.type === 'text'
      ) as Anthropic.TextBlock | undefined;

      const responseText = textBlock?.text || 'I apologize, but I was unable to generate a response.';

      return Response.json({
        message: responseText,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens
        }
      });
    }

    return Response.json({ 
      error: 'Agent reached maximum iterations without completing',
      message: 'I apologize, but I was unable to complete your request. Please try again with a simpler question.'
    }, { status: 500 });

  } catch (error) {
    console.error('POST /api/assistant/session error:', error);
    return Response.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

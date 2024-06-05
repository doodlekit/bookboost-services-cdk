import { RequiredActionFunctionToolCall } from 'openai/resources/beta/threads/runs/runs'
import { AssistantTool } from 'openai/resources/beta/assistants'

async function executeTool(toolCall: RequiredActionFunctionToolCall, context: any) {
  console.log('Executing tool:', toolCall)
  // Not implemented yet
}

const functions: AssistantTool[] = [
  {
    type: 'function',
    function: {
      name: 'getPodcastFeeds',
      description: 'Gets a list of podcast feeds from the database.'
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPodcastEpisodes',
      description: 'Gets a list of podcast episodes base on the id.',
      parameters: {
        type: 'object',
        properties: {
          feed_id: {
            type: 'string',
            description:
              "The id of the podcast feed. Comes from the get_podcast_feeds function as 'id'."
          }
        },
        required: ['feed_id']
      }
    }
  }
]

export { executeTool, functions }

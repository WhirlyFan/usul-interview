# Conference Speaker Assistant - Chat Interface

A chat interface that uses OpenAI's embeddings and GPT-4 to help users decide if they should attend a conference based on the available speakers.

## Features

- **Vector Store**: Creates embeddings for all speakers using OpenAI's `text-embedding-3-small` model
- **Semantic Search**: Finds relevant speakers based on user queries using cosine similarity
- **AI-Powered Recommendations**: Uses GPT-4 to provide personalized conference attendance recommendations
- **Modern UI**: Built with shadcn/ui components (Card, Input, ScrollArea, Button)

## How It Works

1. **Initialization**: On app load, the system:

   - Reads all speaker data from `speakers.json`
   - Creates embeddings for each speaker (name, title, company, bio)
   - Stores these embeddings in a vector store

2. **Chat Interaction**: When a user asks a question:

   - The query is converted to an embedding
   - Top 5 most relevant speakers are found using cosine similarity
   - GPT-4 generates a personalized recommendation based on relevant speakers

3. **Real-time Responses**: The chat interface provides conversational recommendations

## Setup

1. Make sure your `.env` file contains your OpenAI API key:

   ```
   VITE_OPENAI_API_KEY=your_api_key_here
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

## Example Questions

- "I'm interested in career transition and employee engagement"
- "Are there any speakers focused on special operations or defense?"
- "I work in technology and innovation, would this conference be valuable?"
- "I'm looking for leadership and management expertise"
- "Who can speak about visual multimedia and content creation?"

## Components

- **ChatInterface**: Main chat UI component
- **vectorStore**: Core logic for embeddings, similarity search, and AI responses
- **shadcn/ui**: Card, Input, ScrollArea, Button components

## Technical Stack

- React 19 + TypeScript
- Vite
- OpenAI API (Embeddings + GPT-4)
- shadcn/ui + Tailwind CSS
- Lucide React (icons)

## Notes

⚠️ **Security Warning**: This implementation uses `dangerouslyAllowBrowser: true` for the OpenAI client. In a production environment, you should:

- Create a backend API proxy to handle OpenAI requests
- Never expose your API key in the browser
- Implement proper authentication and rate limiting

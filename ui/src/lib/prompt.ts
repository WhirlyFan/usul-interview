import OpenAI from 'openai';
import speakersData from '../speakers.json';

interface Speaker {
  name: string;
  title: string;
  company: string;
  bio: string;
}

// Debug mode - set to true to use test responses instead of API calls
export const DEBUG_MODE = false;

let openaiClient: OpenAI | null = null;
let speakersContext: string = '';

export function initializeOpenAI(apiKey: string) {
  openaiClient = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
  });
}

export function initializeSpeakersContext() {
  const speakers = speakersData as Speaker[];

  // Create a formatted string with all speakers information
  speakersContext = speakers
    .map((speaker, idx) => {
      const bio = speaker.bio ? speaker.bio.substring(0, 500) : 'No bio available';
      return `${idx + 1}. ${speaker.name} - ${speaker.title} at ${speaker.company}\n   Bio: ${bio}${speaker.bio.length > 500 ? '...' : ''}`;
    })
    .join('\n\n');

  return speakersContext;
}

export async function getChatResponse(userMessage: string): Promise<string> {
  // Return test response in debug mode
  if (DEBUG_MODE) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`**Test Response** (Debug Mode)\n\nYou asked: "${userMessage}"\n\nBased on your interests, I'd absolutely recommend attending this conference! Here's why:\n\n🎯 **Highly Relevant Speakers:**\n\n1. **Mr. Matt Stevens** - Chief Executive Officer at The Honor Foundation\n   - Perfect for career transition insights and leadership development\n   - 26 years as a Navy SEAL with extensive command experience\n\n2. **Mr. Jeff Pottinger** - Co-Founder at ReLAUNCH Advisors\n   - Specializes in career transitions and employee engagement\n   - Certified WHY.os Activator and Gallup Strengths Coach\n\n3. **Ms. Leslie Babich** - Director at SOFWERX\n   - Innovation and technology focus\n   - 20+ years in special operations with extensive leadership roles\n\nThis conference offers incredible networking opportunities and insights from leaders who've successfully navigated major career transitions. I highly recommend attending!\n\n*(Set DEBUG_MODE to false in vectorStore.ts to use real API)*`);
      }, 1000); // Simulate API delay
    });
  }

  if (!openaiClient) {
    throw new Error('OpenAI client not initialized.');
  }

  if (!speakersContext) {
    throw new Error('Speakers context not initialized. Call initializeSpeakersContext first.');
  }

  // Create the system prompt with all speakers
  const systemPrompt = `You are a helpful assistant for a conference. Based on the user's question and interests, you should recommend whether they should attend the conference by analyzing the speakers present.

Here are ALL the speakers at the conference:

${speakersContext}

Your task:
1. Analyze the user's interests and questions
2. Identify which speakers are most relevant to their interests
3. Provide a helpful, enthusiastic recommendation about attending the conference
4. Be specific about which speakers they should check out and why
5. If their interests don't align well with the speakers, be honest but helpful

Keep your response conversational and friendly.`;

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 800,
  });

  return completion.choices[0].message.content || 'I apologize, but I could not generate a response.';
}

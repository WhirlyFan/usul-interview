import { useEffect, useState } from "react";
import { ChatInterface } from "./components/ChatInterface";
import { initializeOpenAI, initializeSpeakersContext } from "./lib/prompt";
import { Loader2 } from "lucide-react";

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Get API key from environment variable
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

        if (!apiKey) {
          throw new Error(
            "OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your .env file."
          );
        }

        // Initialize OpenAI client
        initializeOpenAI(apiKey);

        // Initialize speakers context (no API calls needed)
        initializeSpeakersContext();

        setIsInitializing(false);
      } catch (err) {
        console.error("Initialization error:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  if (isInitializing) {
    return (
      <div className='container mx-auto p-8 flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin mx-auto mb-4' />
          <h2 className='text-xl font-semibold mb-2'>
            Initializing Conference Assistant
          </h2>
          <p className='text-gray-600'>Loading speaker information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='container mx-auto p-8'>
        <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
          <h2 className='text-xl font-semibold text-red-900 mb-2'>
            Initialization Error
          </h2>
          <p className='text-red-700'>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto p-8'>
      <div className='mb-8 text-center'>
        <h1 className='text-4xl font-bold mb-2'>
          Conference Speaker Assistant
        </h1>
        <p className='text-gray-600'>
          Get personalized recommendations about attending based on our speakers
        </p>
      </div>
      <ChatInterface />
    </div>
  );
}

export default App;

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { getChatResponse } from "../lib/prompt";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm here to help you decide if you should attend the conference. Ask me about specific topics, industries, or expertise you're interested in, and I'll recommend speakers who might be relevant to you!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollViewportRef.current) {
      const scrollElement = scrollViewportRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await getChatResponse(input);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error getting chat response:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card
      className='w-full max-w-4xl mx-auto flex flex-col'
      style={{ height: "700px" }}
    >
      <CardHeader className='shrink-0'>
        <CardTitle>Conference Assistant</CardTitle>
        <CardDescription>
          Ask me about topics or expertise you're interested in, and I'll help
          you decide if this conference is right for you!
        </CardDescription>
      </CardHeader>
      <CardContent className='flex-1 flex flex-col gap-4 min-h-0'>
        <div className='flex-1 overflow-hidden'>
          <ScrollArea className='h-full pr-4' ref={scrollViewportRef}>
            <div className='space-y-4 pb-4'>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className='text-sm whitespace-pre-wrap'>
                      {message.content}
                    </p>
                    <p className='text-xs opacity-50 mt-1'>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className='flex justify-start'>
                  <div className='bg-muted rounded-lg px-4 py-2 flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    <p className='text-sm'>Thinking...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className='flex gap-2 shrink-0'>
          <Input
            placeholder='Ask about specific topics or expertise...'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className='flex-1'
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

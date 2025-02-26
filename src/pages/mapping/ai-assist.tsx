import React, { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';

interface AIAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssist: React.FC = () => {
  const [messages, setMessages] = useState<AIAssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // TODO: Implement Bedrock API call
      const assistantMessage = {
        role: 'assistant' as const,
        content: 'This is a placeholder response. Bedrock integration coming soon!',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Bedrock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="px-4 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI Mapping Assistant</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Context Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Context</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected API Documentation
                </label>
                <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-500">
                  No API documentation selected
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Mapping
                </label>
                <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-500">
                  No mapping selected
                </div>
              </div>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col h-[600px]">
            {/* Messages */}
            <div className="flex-1 p-6 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p className="text-lg font-medium mb-2">Welcome to the AI Mapping Assistant!</p>
                  <p className="text-sm">
                    I can help you create and refine your API mappings. Try asking me:
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-600">
                    <li>"How do I map this customer API to the TM Forum standard?"</li>
                    <li>"What's the best way to transform this response format?"</li>
                    <li>"Can you suggest a mapping for this endpoint?"</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === 'assistant' ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'assistant'
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex space-x-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me about API mapping..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Thinking...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AIAssist; 
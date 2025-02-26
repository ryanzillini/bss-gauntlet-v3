# Component Structure

This document outlines the structure and organization of React components for the TMFEndpointList refactoring.

## Component Hierarchy

After refactoring, the component hierarchy will be:

```
TMFEndpointList
├── SearchBar
├── FilterBar
└── EndpointList
    └── EndpointCard
        ├── FieldList
        │   └── FieldItem
        │       └── SubFieldList
        ├── MappingActions
        │   ├── MapButton
        │   └── MappingIndicator
        ├── MappingEditor
        │   ├── AddMappingForm
        │   └── EditMappingForm
        └── EndpointDetails
```

## Component Files

### TMFEndpointList

**Location**: `/components/TMFEndpointList/index.tsx`

**Purpose**: Main container component that orchestrates the endpoint listing, searching, and filtering.

```typescript
import React, { useState, useEffect } from 'react';
import { tmfService } from '../../services/TMFService';
import { SearchBar } from '../SearchBar';
import { FilterBar } from '../FilterBar';
import { EndpointList } from '../EndpointList';
import { MappingProvider } from '../../contexts/MappingContext';
import { SearchMetadata } from '../../types/ui/search';
import { TMFEndpoint } from '../../types/endpoints/tmf';

export const TMFEndpointList: React.FC = () => {
  const [endpoints, setEndpoints] = useState<TMFEndpoint[]>([]);
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    filters: {
      methods: [],
      apis: []
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Fetch endpoints and handle search/filter logic
  
  return (
    <MappingProvider>
      <div className="tmf-endpoint-container">
        <SearchBar 
          onSearch={handleSearch} 
          selectedDocId={selectedDocId}
          onDocumentSelect={setSelectedDocId}
        />
        <FilterBar 
          filters={searchMetadata.filters} 
          onFilterChange={handleFilterChange} 
        />
        <EndpointList 
          endpoints={endpoints} 
          isLoading={isLoading}
          docId={selectedDocId}
        />
      </div>
    </MappingProvider>
  );
};
```

### EndpointCard

**Location**: `/components/EndpointCard/index.tsx`

**Purpose**: Displays a single endpoint with its fields and mapping functionality.

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useEndpointMapping } from './hooks';
import { useMappingContext } from '../../contexts/MappingContext';
import { FieldList } from '../FieldList';
import { MappingActions } from '../MappingActions';
import { MappingEditor } from '../MappingEditor';
import { EndpointDetails } from '../EndpointDetails';
import { EndpointCardProps, EndpointCardState } from './types';
import { tmfService } from '../../services/TMFService';

export const EndpointCard: React.FC<EndpointCardProps> = ({ endpoint, docId }) => {
  // Component state
  const [state, setState] = useState<EndpointCardState>({
    isExpanded: false,
    isMapping: false,
    mappingError: null,
    mappingResult: null,
    showMappingModal: false,
    showAIChat: false,
    mappingStages: [],
    mappingProgress: { mapped: 0, total: endpoint.specification.fields.length },
    editingMapping: null,
    isAddingMapping: false,
    showAddFieldMapping: false,
    newMapping: { source: '', target: '', transform: '' },
    expandedFields: {},
    loadingFields: new Set()
  });

  // Use custom hook for mapping logic
  const { isMapping, mappingError, handleMapEndpoint } = useEndpointMapping(endpoint, docId);
  
  // Use mapping context for shared state
  const { mappingResults } = useMappingContext();
  
  // Load existing mapping when component mounts
  useEffect(() => {
    // Implementation
  }, [endpoint.id, docId]);
  
  // Handle card expansion
  const handleCardExpand = useCallback(() => {
    // Implementation
  }, []);
  
  // Handle field expansion
  const handleFieldExpand = useCallback(async (field, fieldPath) => {
    // Implementation
  }, []);
  
  return (
    <div className="endpoint-card">
      <EndpointDetails 
        endpoint={endpoint} 
        isExpanded={state.isExpanded}
        onExpand={handleCardExpand}
      />
      
      {state.isExpanded && (
        <>
          <FieldList 
            fields={endpoint.specification.fields}
            expandedFields={state.expandedFields}
            loadingFields={state.loadingFields}
            onFieldExpand={handleFieldExpand}
          />
          
          <MappingActions 
            mappingProgress={state.mappingProgress}
            isMapping={state.isMapping}
            onMapEndpoint={handleMapEndpoint}
          />
          
          {state.mappingResult && (
            <MappingEditor 
              mappingResult={state.mappingResult}
              editingMapping={state.editingMapping}
              isAddingMapping={state.isAddingMapping}
              newMapping={state.newMapping}
              onEditMapping={/* handler */}
              onSaveEdit={/* handler */}
              onDeleteMapping={/* handler */}
              onAddMapping={/* handler */}
            />
          )}
        </>
      )}
    </div>
  );
};
```

### MappingProgressModal

**Location**: `/components/MappingProgressModal/index.tsx`

**Purpose**: Displays the progress of mapping operations.

```typescript
import React from 'react';
import { MappingStage } from '../../types/mapping/stages';

interface MappingProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: MappingStage[];
}

export const MappingProgressModal: React.FC<MappingProgressModalProps> = ({
  isOpen,
  onClose,
  stages
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Mapping Progress</h2>
        
        <div className="mapping-stages">
          {stages.map(stage => (
            <div 
              key={stage.id} 
              className={`mapping-stage mapping-stage--${stage.status}`}
            >
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
              <div className="status-indicator">{stage.status}</div>
            </div>
          ))}
        </div>
        
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

### AIChatModal

**Location**: `/components/AIChatModal/index.tsx`

**Purpose**: Provides an AI chat interface for assistance with mappings.

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Message, AIChatModalProps } from './types';

export const AIChatModal: React.FC<AIChatModalProps> = ({ 
  isOpen, 
  onClose,
  endpointId,
  docId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Send message to AI
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: input
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Create abort controller for fetch
      abortControllerRef.current = new AbortController();
      
      // Send message to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          endpointId,
          docId
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Add AI response
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: data.message }
      ]);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        // Add error message
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, there was an error processing your request.' }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="ai-chat-modal">
      <div className="chat-header">
        <h2>AI Assistant</h2>
        <button onClick={onClose}>Close</button>
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message message-${message.role}`}>
            {message.content}
          </div>
        ))}
        
        {isLoading && (
          <div className="message message-assistant loading">
            <span className="typing-indicator">...</span>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>
      
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask a question..."
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          Send
        </button>
        {isLoading && (
          <button 
            onClick={() => abortControllerRef.current?.abort()}
            className="cancel-button"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
```

## Performance Considerations

### Memoization

Use React.memo for performance-critical components:

```typescript
export const FieldItem = React.memo<FieldItemProps>(({ field, onExpand }) => {
  // Component implementation
});
```

### Callback Memoization

Use useCallback for event handlers:

```typescript
const handleMapEndpoint = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation();
  // Mapping logic
}, [endpoint, docId]);
```

### Value Memoization

Use useMemo for expensive calculations:

```typescript
const mappedPercentage = useMemo(() => {
  if (!mappingProgress.total) return 0;
  return Math.round((mappingProgress.mapped / mappingProgress.total) * 100);
}, [mappingProgress.mapped, mappingProgress.total]);
```

## Styling Strategy

1. **Component-Specific Styles**: Each component has its own styles file
2. **CSS Modules**: Use CSS modules to avoid style conflicts
3. **Theme Variables**: Use CSS variables for consistent theming
4. **Responsive Design**: Use media queries for responsive layouts

Example styling file:

```typescript
// /components/EndpointCard/styles.ts
import { createStyles } from '@material-ui/core/styles';

export const useStyles = createStyles((theme) => ({
  endpointCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: theme.shadows[2]
    }
  },
  // Other styles
}));
``` 
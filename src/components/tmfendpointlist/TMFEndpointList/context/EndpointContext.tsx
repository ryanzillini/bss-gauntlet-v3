import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Endpoint } from '../types';

interface EndpointContextType {
  activeEndpoint: string | null;
  setActiveEndpoint: (id: string | null) => void;
  endpoints: Record<string, EndpointState>;
  updateEndpointState: (id: string, state: Partial<EndpointState>) => void;
}

interface EndpointState {
  isExpanded: boolean;
  activeTab: number;
  requestData?: any;
  responseData?: any;
  isLoading: boolean;
  error?: any;
}

const EndpointContext = createContext<EndpointContextType | undefined>(undefined);

export const EndpointProvider: React.FC<{ 
  children: ReactNode;
  initialEndpoints: Endpoint[];
}> = ({ children, initialEndpoints }) => {
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  
  // Initialize endpoint state for each endpoint
  const initialState: Record<string, EndpointState> = {};
  initialEndpoints.forEach(endpoint => {
    initialState[endpoint.id] = {
      isExpanded: false,
      activeTab: 0,
      isLoading: false,
    };
  });
  
  const [endpoints, setEndpoints] = useState<Record<string, EndpointState>>(initialState);
  
  const updateEndpointState = (id: string, state: Partial<EndpointState>) => {
    setEndpoints(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...state,
      }
    }));
  };
  
  return (
    <EndpointContext.Provider value={{
      activeEndpoint,
      setActiveEndpoint,
      endpoints,
      updateEndpointState,
    }}>
      {children}
    </EndpointContext.Provider>
  );
};

export const useEndpointContext = () => {
  const context = useContext(EndpointContext);
  if (!context) {
    throw new Error('useEndpointContext must be used within an EndpointProvider');
  }
  return context;
}; 
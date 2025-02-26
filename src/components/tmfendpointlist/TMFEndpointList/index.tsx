import React from 'react';
import { Box } from '@mui/material';
import { TMFEndpointListProps } from './types';
import EndpointList from './components/EndpointList';
import { EndpointProvider } from './context/EndpointContext';
import TMFThemeProvider from './context/ThemeProvider';

/**
 * TMFEndpointList component - Main entry point that maintains the same API
 * as the original TMFEndpointList.tsx file
 */
const TMFEndpointList: React.FC<TMFEndpointListProps> = (props) => {
  return (
    <TMFThemeProvider>
      <Box sx={{ width: '100%' }}>
        <EndpointProvider initialEndpoints={props.endpoints}>
          <EndpointList {...props} />
        </EndpointProvider>
      </Box>
    </TMFThemeProvider>
  );
};

export default TMFEndpointList; 
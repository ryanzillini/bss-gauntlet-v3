import React from 'react';
import { Box, Paper, useTheme } from '@mui/material';

interface CodeDisplayProps {
  code: string;
  language?: string;
  maxHeight?: number | string;
  isError?: boolean;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({
  code,
  language = 'json',
  maxHeight = 300,
  isError = false,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={1}
      sx={{
        bgcolor: isError 
          ? theme.palette.mode === 'dark' 
            ? 'rgba(255, 0, 0, 0.1)' 
            : 'rgba(255, 0, 0, 0.05)'
          : theme.palette.mode === 'dark' 
            ? 'rgba(0, 0, 0, 0.2)' 
            : 'rgba(0, 0, 0, 0.03)',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          maxHeight,
          overflowX: 'auto',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
      >
        <Box
          component="code"
          sx={{
            display: 'block',
            whiteSpace: 'pre',
          }}
        >
          {code}
        </Box>
      </Box>
    </Paper>
  );
};

export default CodeDisplay; 
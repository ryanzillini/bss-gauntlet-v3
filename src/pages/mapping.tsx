import React, { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import TMFEndpointList from '../components/TMFEndpointList';
import { supabase } from '../utils/supabase-client';
import { toast } from 'react-hot-toast';

interface TMFStatus {
  lastUpdated: string;
  total: number;
  apis: string[];
}

const MappingPage = () => {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  // Get the active API documentation
  useEffect(() => {
    const fetchActiveDoc = async () => {
      try {
        const { data, error } = await supabase
          .from('bss_mappings')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;
        if (data) {
          setActiveDocId(data.id);
        }
      } catch (error) {
        console.error('Error fetching active documentation:', error);
        toast.error('Failed to fetch active documentation');
      }
    };

    fetchActiveDoc();
  }, []);

  if (!activeDocId) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-pure-white mb-8">
            TMF API Mapping
          </h1>
          <div className="text-gray-800 dark:text-pure-white">
            Please upload and activate API documentation first to start mapping.
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-pure-white mb-8">
          TMF API Mapping
        </h1>
        <TMFEndpointList docId={activeDocId} />
      </div>
    </MainLayout>
  );
};

export default MappingPage; 
import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Table } from '../models';

interface TableSelectionModalProps {
    tables: Table[];
    onSelectTable: (table: Table) => void;
    onClose: () => void;
    targetDatabaseName?: string;
}

const TableSelectionModal: React.FC<TableSelectionModalProps> = ({
    tables,
    onSelectTable,
    onClose,
    targetDatabaseName,
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTables = tables.filter(table =>
        table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.columns.some(col => col.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">
                        Select Target Table {targetDatabaseName ? `from ${targetDatabaseName}` : ''}
                    </h3>
                    <button
                        className="text-gray-400 hover:text-white"
                        onClick={onClose}
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Search tables..."
                        className="w-full p-2 pl-8 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white placeholder-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {filteredTables.map((table) => (
                        <div
                            key={table.name}
                            className="p-3 border border-gray-700 rounded mb-2 hover:bg-gray-700 cursor-pointer"
                            onClick={() => onSelectTable(table)}
                        >
                            <span className="text-white font-medium">{table.name}</span>
                            <span className="text-gray-400 text-sm ml-2">({table.columns.length} columns)</span>
                        </div>
                    ))}

                    {filteredTables.length === 0 && (
                        <p className="text-gray-400 text-center py-4">No tables match your search</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TableSelectionModal; 
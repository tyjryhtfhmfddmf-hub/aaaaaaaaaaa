
import React from 'react';

interface StatusBarProps {
    status: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
    return (
        <div className="px-4 py-1 bg-gray-800 text-xs text-gray-400">
            Status: {status}
        </div>
    );
};
   
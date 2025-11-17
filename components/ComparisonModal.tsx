
import React from 'react';
import type { Song } from '../types';
import { RemoveIcon } from './Icons';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    comparisonData: {
        localUser: string;
        remoteUser: string;
        commonSongs: Song[];
        localOnlySongs: Song[];
        remoteOnlySongs: Song[];
        localPercentage: number;
        remotePercentage: number;
    } | null;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, comparisonData }) => {
    if (!isOpen || !comparisonData) return null;

    const {
        localUser,
        remoteUser,
        commonSongs,
        localOnlySongs,
        remoteOnlySongs,
        localPercentage,
        remotePercentage,
    } = comparisonData;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div style={{ backgroundColor: 'var(--custom-color-bg-secondary)' }} className="rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col text-custom-text-primary">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-indigo-400">Library Comparison</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <RemoveIcon />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-center border-b border-gray-700">
                    <div>
                        <h3 className="text-xl font-semibold">{localUser} (You)</h3>
                        <p className="text-4xl font-bold text-green-400 mt-2">{localPercentage}%</p>
                        <p className="text-sm text-gray-400">of your library is in common.</p>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">{remoteUser}</h3>
                        <p className="text-4xl font-bold text-blue-400 mt-2">{remotePercentage}%</p>
                        <p className="text-sm text-gray-400">of their library is in common.</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Common Songs */}
                    <div className="style={{ backgroundColor: 'var(--custom-color-bg-primary-t-50)' }} rounded-lg p-4 flex flex-col">
                        <h3 className="text-lg font-semibold mb-3 text-center border-b border-gray-700 pb-2">
                            Common Songs ({commonSongs.length})
                        </h3>
                        <ul className="space-y-2 overflow-y-auto flex-1 pr-2">
                            {commonSongs.map(song => (
                                <li key={song.id} className="p-2 rounded-md style={{ backgroundColor: 'var(--custom-color-bg-secondary-t-60)' }}">
                                    <p className="font-medium truncate text-sm">{song.title}</p>
                                    <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Your Unique Songs */}
                    <div className="style={{ backgroundColor: 'var(--custom-color-bg-primary-t-50)' }} rounded-lg p-4 flex flex-col">
                        <h3 className="text-lg font-semibold mb-3 text-center border-b border-gray-700 pb-2">
                            Only You Have ({localOnlySongs.length})
                        </h3>
                        <ul className="space-y-2 overflow-y-auto flex-1 pr-2">
                            {localOnlySongs.map(song => (
                                <li key={song.id} className="p-2 rounded-md style={{ backgroundColor: 'var(--custom-color-bg-secondary-t-60)' }}">
                                    <p className="font-medium truncate text-sm">{song.title}</p>
                                    <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Their Unique Songs */}
                    <div className="style={{ backgroundColor: 'var(--custom-color-bg-primary-t-50)' }} rounded-lg p-4 flex flex-col">
                        <h3 className="text-lg font-semibold mb-3 text-center border-b border-gray-700 pb-2">
                            Only They Have ({remoteOnlySongs.length})
                        </h3>
                        <ul className="space-y-2 overflow-y-auto flex-1 pr-2">
                            {remoteOnlySongs.map(song => (
                                <li key={song.id} className="p-2 rounded-md style={{ backgroundColor: 'var(--custom-color-bg-secondary-t-60)' }}">
                                    <p className="font-medium truncate text-sm">{song.title}</p>
                                    <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                 <div className="p-4 border-t border-gray-700 text-center">
                    <button
                        onClick={onClose}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

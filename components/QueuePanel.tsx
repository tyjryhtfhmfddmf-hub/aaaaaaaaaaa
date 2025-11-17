
import React, { useState } from 'react';
import type { Song } from '../types';
import { PlayIcon, PauseIcon, RemoveIcon, SaveIcon, ClearIcon } from './Icons';

interface QueuePanelProps {
    queue: Song[];
    currentSongId: string | undefined;
    onSongSelect: (index: number) => void;
    onRemove: (songId: string) => void;
    onReorder: (startIndex: number, endIndex: number) => void;
    onSavePlaylist: () => void;
    onClearQueue: () => void;
    onAddSongById: (songId: string) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ queue, currentSongId, onSongSelect, onRemove, onReorder, onSavePlaylist, onClearQueue, onAddSongById }) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [isDragOver, setIsDragOver] = useState<boolean>(false);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        
        onReorder(draggedIndex, index);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handlePanelDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const songId = e.dataTransfer.getData('song-id');
        if (songId) {
            onAddSongById(songId);
        }
    };

    const handlePanelDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('song-id')) {
            e.dataTransfer.dropEffect = 'copy';
            if (!isDragOver) setIsDragOver(true);
        }
    };

    const handlePanelDragLeave = () => {
        setIsDragOver(false);
    };


    return (
        <div 
            className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${isDragOver ? 'bg-indigo-900/30 border-2 border-dashed border-indigo-400' : 'border-2 border-transparent'}`}
            onDrop={handlePanelDrop}
            onDragOver={handlePanelDragOver}
            onDragLeave={handlePanelDragLeave}
        >
            <div className="p-4 flex justify-between items-center border-b border-gray-700/50">
                <h2 className="text-xl font-bold text-gray-100">Up Next</h2>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={onSavePlaylist} 
                        disabled={queue.length === 0}
                        className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm">
                        <SaveIcon />
                        <span>Save Playlist</span>
                    </button>
                    <button 
                        onClick={onClearQueue}
                        disabled={queue.length === 0}
                        title="Clear Queue"
                        className="flex items-center justify-center space-x-2 bg-gray-700 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm">
                        <ClearIcon />
                        <span>Clear</span>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4 pr-2">
                {queue.length > 0 ? (
                    <ul className="space-y-2">
                        {queue.map((song, index) => (
                            <li
                                key={song.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onSongSelect(index)}
                                className={`group flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                                    currentSongId === song.id 
                                        ? 'bg-indigo-600/50' 
                                        : 'bg-gray-700/50 hover:bg-gray-600/50'
                                } ${draggedIndex === index ? 'opacity-50' : ''}`}
                            >
                                <span className="text-gray-400 w-8">{index + 1}.</span>
                                <div className="flex-1 flex flex-col mx-3">
                                    <p className={`font-medium ${currentSongId === song.id ? 'text-white' : 'text-custom-text-primary'}`}>
                                        {song.title}
                                    </p>
                                    <p className="text-sm text-gray-400">{song.artist}</p>
                                </div>
                                <span className="text-sm text-gray-400 mr-4">
                                    {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(song.id);
                                    }}
                                    className="p-2 rounded-full text-gray-400 hover:bg-red-500/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <RemoveIcon />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                        <p className="text-center">Your queue is empty.</p>
                        <p className="text-sm text-center">Add songs from your library, or drag them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

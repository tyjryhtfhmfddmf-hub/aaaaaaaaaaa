
import React, { useState } from 'react';
import type { Playlist, Song } from '../types';
import { RemoveIcon, BackIcon, AddIcon, EditIcon, CheckIcon } from './Icons';

interface PlaylistsPanelProps {
    library: Song[];
    playlists: Playlist[];
    loadPlaylist: (playlist: Playlist) => void;
    deletePlaylist: (playlistId: string) => void;
    updatePlaylistName: (playlistId: string, newName: string) => void;
    addToQueue: (song: Song) => void;
}

const SmallPlayIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
);

export const PlaylistsPanel: React.FC<PlaylistsPanelProps> = ({ library, playlists, loadPlaylist, deletePlaylist, updatePlaylistName, addToQueue }) => {
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState("");

    const handleStartEditing = () => {
        if (selectedPlaylist) {
            setIsEditingName(true);
            setEditedName(selectedPlaylist.name);
        }
    };

    const handleCancelEditing = () => {
        setIsEditingName(false);
        setEditedName("");
    };

    const handleSaveName = () => {
        if (selectedPlaylist && editedName.trim()) {
            updatePlaylistName(selectedPlaylist.id, editedName.trim());
            setSelectedPlaylist(prev => prev ? { ...prev, name: editedName.trim() } : null);
            setIsEditingName(false);
        }
    };


    if (selectedPlaylist) {
        const songs = selectedPlaylist.songIds
            .map(id => library.find(s => s.id === id))
            .filter((s): s is Song => !!s);

        return (
            <div className="p-4 space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 flex-grow">
                        <button
                            onClick={() => {
                                setSelectedPlaylist(null);
                                setIsEditingName(false); // Reset on back
                            }}
                            className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-300"
                            title="Back to playlists"
                        >
                            <BackIcon />
                        </button>
                        {isEditingName ? (
                            <div className="flex items-center space-x-2 flex-grow">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') handleCancelEditing();
                                    }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-lg text-white"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="p-2 rounded-full text-green-400 hover:bg-green-600 hover:text-white" title="Save">
                                    <CheckIcon />
                                </button>
                                <button onClick={handleCancelEditing} className="p-2 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white" title="Cancel">
                                    <RemoveIcon />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2 min-w-0">
                                <div className="truncate">
                                    <h3 className="text-lg font-bold text-gray-300 truncate">{selectedPlaylist.name}</h3>
                                    <p className="text-sm text-gray-400">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button 
                                    onClick={handleStartEditing} 
                                    className="p-2 rounded-full text-gray-400 hover:bg-indigo-600/50 hover:text-white"
                                    title="Edit name"
                                >
                                    <EditIcon />
                                </button>
                            </div>
                        )}
                    </div>
                    {!isEditingName && (
                        <button
                            onClick={() => loadPlaylist(selectedPlaylist)}
                            className="ml-4 flex-shrink-0 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm"
                        >
                            <SmallPlayIcon />
                            <span>Play All</span>
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                    {songs.length > 0 ? (
                        <ul className="space-y-1">
                            {songs.map(song => (
                                <li
                                    key={song.id}
                                    onDoubleClick={() => addToQueue(song)}
                                    className="group flex items-center p-2 rounded-md hover:bg-gray-700 cursor-pointer transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-200">{song.title}</p>
                                        <p className="text-sm text-gray-400">{song.artist}</p>
                                    </div>
                                    <span className="text-sm text-gray-500 mr-4">
                                        {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addToQueue(song);
                                        }}
                                        title="Add to queue"
                                        className="p-2 rounded-full text-gray-400 hover:bg-indigo-600/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <AddIcon />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                            <p>This playlist is empty.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-300">Saved Playlists</h3>
            <div className="flex-1 overflow-y-auto pr-2">
                {playlists.length > 0 ? (
                    <ul className="space-y-2">
                        {playlists.map(playlist => (
                            <li
                                key={playlist.id}
                                className="group flex items-center p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
                            >
                                <div
                                    className="flex-1 cursor-pointer"
                                    onClick={() => setSelectedPlaylist(playlist)}
                                    onDoubleClick={() => loadPlaylist(playlist)}
                                >
                                    <p className="font-semibold text-gray-200">{playlist.name}</p>
                                    <p className="text-sm text-gray-400">{playlist.songIds.length} song{playlist.songIds.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button
                                    onClick={() => deletePlaylist(playlist.id)}
                                    className="p-2 rounded-full text-gray-400 hover:bg-red-500/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <RemoveIcon />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        <p>No playlists saved.</p>
                        <p className="text-sm">Save your "Up Next" queue to create one.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

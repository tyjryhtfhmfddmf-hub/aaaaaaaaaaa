
import React, { useState } from 'react';
import type { Playlist } from '../types';

interface NetworkPanelProps {
    status: 'offline' | 'connecting' | 'connected' | 'error';
    isHost: boolean;
    roomCode: string;
    onHost: () => void;
    onJoin: (code: string) => void;
    onLeave: () => void;
    onShareQueue: () => void;
    onSharePlaylist: (playlistId: string) => void;
    onSyncCommon: () => void;
    onCompareLibraries: () => void;
    playlists: Playlist[];
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({
    status,
    isHost,
    roomCode,
    onHost,
    onJoin,
    onLeave,
    onShareQueue,
    onSharePlaylist,
    onSyncCommon,
    onCompareLibraries,
    playlists,
}) => {
    const [joinCode, setJoinCode] = useState('');
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
    const [showPlaylistDropdown, setShowPlaylistDropdown] = useState<boolean>(false);

    const handleSharePlaylistClick = () => {
        if (selectedPlaylistId) {
            onSharePlaylist(selectedPlaylistId);
            setShowPlaylistDropdown(false); // Close dropdown after sharing
        } else {
            alert('Please select a playlist to share.');
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'connecting':
                return (
                    <div className="text-center p-4">
                        <p className="text-lg font-semibold animate-pulse">Connecting...</p>
                        <p className="text-sm text-gray-400">Please wait. The service may take up to 30 seconds to start if it's been inactive.</p>
                    </div>
                );

            case 'connected':
                return (
                    <div className="space-y-3">
                        <p>
                            <span className="font-semibold">{isHost ? 'Hosting Room:' : 'Joined Room:'}</span>
                            <span className="ml-2 px-3 py-1 bg-indigo-500 text-white rounded-md font-mono tracking-widest">{roomCode}</span>
                        </p>
                        <button
                            onClick={onLeave}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Leave Session
                        </button>
                         <div className="text-xs text-center text-gray-400 border-t border-gray-700 pt-3">
                            <p>Automatic library sync is <span className="text-green-400 font-semibold">ACTIVE</span>.</p>
                            <p>New songs from others will appear in your library.</p>
                        </div>
                         <div className="grid grid-cols-2 gap-2 pt-2">
                            <button onClick={onShareQueue} className="bg-indigo-600 hover:bg-indigo-500 text-sm py-2 px-3 rounded">Share Queue</button>
                            <button onClick={() => setShowPlaylistDropdown(prev => !prev)} className="bg-indigo-600 hover:bg-indigo-500 text-sm py-2 px-3 rounded">
                                {showPlaylistDropdown ? 'Cancel Share Playlist' : 'Share Playlist'}
                            </button>
                            {showPlaylistDropdown && (
                                <div className="col-span-2 flex flex-col space-y-1">
                                    <select
                                        value={selectedPlaylistId}
                                        onChange={(e) => setSelectedPlaylistId(e.target.value)}
                                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Playlist</option>
                                        {playlists.map(playlist => (
                                            <option key={playlist.id} value={playlist.id}>
                                                {playlist.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSharePlaylistClick}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-sm py-2 px-3 rounded"
                                        disabled={!selectedPlaylistId}
                                    >
                                        Share Selected Playlist
                                    </button>
                                </div>
                            )}
                            <button onClick={onSyncCommon} className="bg-indigo-600 hover:bg-indigo-500 text-sm py-2 px-3 rounded">Sync Common</button>
                            <button onClick={onCompareLibraries} className="bg-indigo-600 hover:bg-indigo-500 text-sm py-2 px-3 rounded">Compare Libraries</button>
                        </div>
                    </div>
                );
            
            case 'error':
                 return (
                    <div className="text-center space-y-3">
                        <p className="text-red-400 font-semibold">Connection Failed</p>
                        <p className="text-sm text-gray-400">Could not connect to the sync service.</p>
                        <button
                            onClick={onLeave} // onLeave resets state to offline
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Go Offline
                        </button>
                    </div>
                );

            case 'offline':
            default:
                return (
                    <div className="space-y-3">
                         <p className="text-sm text-gray-400">
                            Host or join a session to sync music with friends in real-time.
                            <br />
                            <span className="font-semibold">Note:</span> This requires a backend service running on Render.com.
                        </p>
                        <button
                            onClick={onHost}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Host Session
                        </button>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="Enter Room Code"
                                maxLength={6}
                                className="flex-grow bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
                            />
                            <button
                                onClick={() => onJoin(joinCode)}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-500"
                                disabled={!joinCode.trim()}
                            >
                                Join
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-4 border-t border-gray-800 bg-gray-800/20">
            <h2 className="text-lg font-bold text-indigo-400 mb-2">Network Sync</h2>
            {renderContent()}
        </div>
    );
};
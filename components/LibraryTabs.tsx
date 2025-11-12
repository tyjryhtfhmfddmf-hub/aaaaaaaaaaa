
import React, { useState } from 'react';
import type { Song, Playlist } from '../types';
import { LibraryPanel } from './LibraryPanel';
import { PlaylistsPanel } from './PlaylistsPanel';
import { ArtistsPanel } from './ArtistsPanel';
import { SettingsIcon } from './Icons';

interface LibraryTabsProps {
    library: Song[];
    onSongsAdded: (songs: any[]) => void;
    playlists: Playlist[];
    addToQueue: (song: Song) => void;
    loadPlaylist: (playlist: Playlist) => void;
    deletePlaylist: (playlistId: string) => void;
    updatePlaylistName: (playlistId: string, newName: string) => void;
    onOpenSettings: () => void;
    onUpdateSong: (songId: string, newMetadata: { title: string; artist: string; album: string }) => void;
}

enum Tab {
    Library = 'Library',
    Playlists = 'Playlists',
    Artists = 'Artists'
}

export const LibraryTabs: React.FC<LibraryTabsProps> = (props) => {
    const { onOpenSettings, onUpdateSong, ...panelProps } = props;
    const [activeTab, setActiveTab] = useState<Tab>(Tab.Library);

    const getTabClass = (tab: Tab) => {
        return activeTab === tab
            ? 'border-indigo-400 text-indigo-300'
            : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500';
    };

    const libraryPanelProps = {
        library: props.library,
        onSongsAdded: props.onSongsAdded,
        addToQueue: props.addToQueue,
        onUpdateSong: onUpdateSong,
    };
    
    const playlistsPanelProps = {
        library: props.library,
        playlists: props.playlists,
        loadPlaylist: props.loadPlaylist,
        deletePlaylist: props.deletePlaylist,
        updatePlaylistName: props.updatePlaylistName,
        addToQueue: props.addToQueue,
    };


    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-gray-800 px-4 flex justify-between items-center">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab(Tab.Library)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass(Tab.Library)}`}
                    >
                        📚 Library
                    </button>
                    <button
                        onClick={() => setActiveTab(Tab.Playlists)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass(Tab.Playlists)}`}
                    >
                        🎶 Playlists
                    </button>
                    <button
                        onClick={() => setActiveTab(Tab.Artists)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${getTabClass(Tab.Artists)}`}
                    >
                        🎤 Artists
                    </button>
                </nav>
                <button
                    onClick={onOpenSettings}
                    title="Settings"
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                    <SettingsIcon />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {activeTab === Tab.Library ? (
                    <LibraryPanel {...libraryPanelProps} />
                ) : activeTab === Tab.Playlists ? (
                    <PlaylistsPanel {...playlistsPanelProps} />
                ) : (
                    <ArtistsPanel library={panelProps.library} addToQueue={panelProps.addToQueue} />
                )}
            </div>
        </div>
    );
};

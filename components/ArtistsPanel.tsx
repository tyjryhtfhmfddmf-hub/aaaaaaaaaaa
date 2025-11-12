import React, { useState, useMemo } from 'react';
import type { Song } from '../types';
import { BackIcon } from './Icons';

interface ArtistsPanelProps {
    library: Song[];
    addToQueue: (song: Song) => void;
}

export const ArtistsPanel: React.FC<ArtistsPanelProps> = ({ library, addToQueue }) => {
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

    const artists = useMemo(() => {
        const artistsMap = new Map<string, Song[]>();
        library.forEach(song => {
            if (!song.artist) return;
            const artistSongs = artistsMap.get(song.artist) || [];
            artistSongs.push(song);
            artistsMap.set(song.artist, artistSongs);
        });
        return new Map([...artistsMap.entries()].sort());
    }, [library]);

    if (selectedArtist) {
        const songs = artists.get(selectedArtist) || [];
        return (
            <div className="p-4 space-y-4 h-full flex flex-col">
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setSelectedArtist(null)}
                        className="p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-300"
                        title="Back to artists"
                    >
                        <BackIcon />
                    </button>
                    <h3 className="text-lg font-bold text-gray-300">{selectedArtist}</h3>
                </div>
                <div className="flex-1 overflow-y-auto pr-2">
                    <ul className="space-y-1">
                        {songs.map(song => (
                            <li
                                key={song.id}
                                onDoubleClick={() => addToQueue(song)}
                                className="group flex items-center p-2 rounded-md hover:bg-gray-700 cursor-pointer transition-colors"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-gray-200">{song.title}</p>
                                    <p className="text-sm text-gray-400">{song.album}</p>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-300">All Artists</h3>
            <div className="flex-1 overflow-y-auto pr-2">
                {artists.size > 0 ? (
                    <ul className="space-y-2">
                        {Array.from(artists.entries()).map(([artist, songs]) => (
                            <li
                                key={artist}
                                onClick={() => setSelectedArtist(artist)}
                                className="group flex items-center p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors cursor-pointer"
                            >
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-200">{artist}</p>
                                    <p className="text-sm text-gray-400">{songs.length} song{songs.length !== 1 ? 's' : ''}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                     <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <p>No artists found in library.</p>
                        <p className="text-sm">Add songs to see artists here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
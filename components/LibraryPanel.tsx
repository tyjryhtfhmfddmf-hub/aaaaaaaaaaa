import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Song } from '../types';
import { AddIcon, FolderAddIcon, ChevronDownIcon, EditIcon, CheckIcon, RemoveIcon, TrashIcon, DownloadIcon } from './Icons';

interface LibraryPanelProps {
    library: Song[];
    onSongsAdded: (songs: any[]) => void;
    addToQueue: (song: Song) => void;
    onUpdateSong: (songId: string, newMetadata: { title: string; artist: string; album: string }) => void;
    onRemoveSong: (songId: string) => void;
    onDownloadSong: (songId: string) => void;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({ library, onSongsAdded, addToQueue, onUpdateSong, onRemoveSong, onDownloadSong }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [editingSongId, setEditingSongId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState({ title: '', artist: '', album: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setIsAddMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const processFiles = async (files: File[]) => {
        if (!files || files.length === 0) return;
        console.log(`Processing ${files.length} file(s)...`);

        const newSongs = [];
        const jsmediatags = (window as any).jsmediatags;

        for (const file of files) {
            if (library.some(song => song.file?.name === file.name && song.file?.size === file.size)) {
                continue; // Skip duplicates
            }
            
            if (!file.type.startsWith('audio/')) {
                continue;
            }

            try {
                const tags: any = await new Promise((resolve, reject) => {
                    jsmediatags.read(file, { onSuccess: resolve, onError: reject });
                });

                let albumArtBlob: Blob | undefined = undefined;
                const { picture } = tags.tags;
                if (picture) {
                    albumArtBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
                }

                const audio = new Audio(URL.createObjectURL(file));
                const duration: number = await new Promise(resolve => {
                    audio.addEventListener('loadedmetadata', () => {
                        resolve(audio.duration);
                        URL.revokeObjectURL(audio.src);
                    });
                     audio.addEventListener('error', () => {
                        resolve(0); // Resolve with 0 if there's an error
                        URL.revokeObjectURL(audio.src);
                    });
                });
                
                const newSong = {
                    id: `${file.name}-${file.size}-${Date.now()}`,
                    title: tags.tags.title || file.name.replace(/\.[^/.]+$/, ""),
                    artist: tags.tags.artist || 'Unknown Artist',
                    album: tags.tags.album || 'Unknown Album',
                    duration,
                    file: file,
                    albumArt: albumArtBlob,
                };
                newSongs.push(newSong);

            } catch (error) {
                console.error('Error reading tags for', file.name, error);
                 const duration: number = await new Promise(resolve => {
                    const audio = new Audio(URL.createObjectURL(file));
                    audio.addEventListener('loadedmetadata', () => {
                        resolve(audio.duration);
                        URL.revokeObjectURL(audio.src);
                    });
                     audio.addEventListener('error', () => {
                        resolve(0);
                        URL.revokeObjectURL(audio.src);
                    });
                });
                const fallbackSong = {
                    id: `${file.name}-${file.size}-${Date.now()}`,
                    title: file.name.replace(/\.[^/.]+$/, ""),
                    artist: 'Unknown Artist',
                    album: 'Unknown Album',
                    duration: duration || 0,
                    file: file,
                };
                newSongs.push(fallbackSong);
            }
        }
        
        onSongsAdded(newSongs);

        console.log(`Added ${newSongs.length} new song(s) to the library.`);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            await processFiles(Array.from(files));
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleAddFolderClick = async () => {
        setIsAddMenuOpen(false);
        // Use the new Electron API exposed on the window object
        const filesFromMain = await window.electronAPI.openFolderDialog();
        if (filesFromMain) {
            const fileObjects = filesFromMain.map(
                (f) => new File([f.buffer], f.name, { type: f.type })
            );
            await processFiles(fileObjects);
        }
    };

    const handleEditClick = (song: Song) => {
        setEditingSongId(song.id);
        setEditFormData({
            title: song.title,
            artist: song.artist,
            album: song.album,
        });
    };

    const handleCancelEdit = () => {
        setEditingSongId(null);
    };

    const handleSaveEdit = () => {
        if (!editingSongId) return;
        onUpdateSong(editingSongId, editFormData);
        setEditingSongId(null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const filteredLibrary = useMemo(() => {
        if (!searchTerm) return library;
        return library.filter(song => 
            song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [library, searchTerm]);

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            <div className="flex space-x-2">
                 <input
                    type="text"
                    placeholder="Search library..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-grow bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                />
                <div className="relative" ref={addMenuRef}>
                    <button
                        onClick={() => setIsAddMenuOpen(prev => !prev)}
                        className="flex items-center justify-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <span>Add</span>
                        <ChevronDownIcon />
                    </button>
                    {isAddMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-20 border border-gray-600">
                            <ul className="py-1">
                                <li>
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click();
                                            setIsAddMenuOpen(false);
                                        }}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600/50"
                                    >
                                        <AddIcon />
                                        <span className="ml-3">Add Songs</span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={handleAddFolderClick}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600/50"
                                    >
                                        <FolderAddIcon />
                                        <span className="ml-3">Add Folder</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                {library.length > 0 ? (
                    <ul className="space-y-1">
                        {filteredLibrary.map(song => (
                            editingSongId === song.id ? (
                                <li key={song.id} className="flex flex-col p-2 rounded-md bg-gray-700 space-y-2">
                                    <input
                                        type="text"
                                        name="title"
                                        value={editFormData.title}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <input
                                        type="text"
                                        name="artist"
                                        value={editFormData.artist}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                     <input
                                        type="text"
                                        name="album"
                                        value={editFormData.album}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <div className="flex justify-end space-x-2">
                                        <button onClick={handleCancelEdit} className="p-2 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white" title="Cancel">
                                            <RemoveIcon />
                                        </button>
                                        <button onClick={handleSaveEdit} className="p-2 rounded-full text-green-400 hover:bg-green-600 hover:text-white" title="Save">
                                            <CheckIcon />
                                        </button>
                                    </div>
                                </li>
                            ) : (
                                <li
                                    key={song.id}
                                    onDoubleClick={!song.isRemote ? () => addToQueue(song) : undefined}
                                    draggable={!song.isRemote}
                                    onDragStart={!song.isRemote ? (e) => {
                                        e.dataTransfer.setData('song-id', song.id);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    } : undefined}
                                    className={`group flex items-center p-2 rounded-md transition-colors ${song.isRemote ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-700 cursor-pointer'}`}
                                >
                                    {song.albumArt ? (
                                        <img src={song.albumArt} alt={song.album} className="w-10 h-10 rounded-md mr-3 object-cover flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-md bg-gray-800 flex items-center justify-center mr-3 flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${song.isRemote ? 'text-gray-500' : 'text-gray-200'}`}>{song.title}</p>
                                        <p className={`text-sm truncate ${song.isRemote ? 'text-gray-600' : 'text-gray-400'}`}>{song.artist}</p>
                                    </div>
                                    <div className="flex items-center ml-2 flex-shrink-0">
                                        <span className="text-sm text-gray-500 group-hover:hidden">
                                            {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60)).toString().padStart(2, '0')}
                                        </span>
                                        <div className="hidden group-hover:flex items-center">
                                            {song.isRemote && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDownloadSong(song.id);
                                                    }}
                                                    title="Download song"
                                                    className="p-2 rounded-full text-gray-400 hover:bg-green-600/50 hover:text-white"
                                                >
                                                    <DownloadIcon />
                                                </button>
                                            )}
                                            {!song.isRemote && (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditClick(song);
                                                        }}
                                                        title="Edit metadata"
                                                        className="p-2 rounded-full text-gray-400 hover:bg-indigo-600/50 hover:text-white"
                                                    >
                                                        <EditIcon />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToQueue(song);
                                                        }}
                                                        title="Add to queue"
                                                        className="p-2 rounded-full text-gray-400 hover:bg-indigo-600/50 hover:text-white"
                                                    >
                                                        <AddIcon />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveSong(song.id);
                                                }}
                                                title="Remove from library"
                                                className="p-2 rounded-full text-gray-400 hover:bg-red-600/50 hover:text-white"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            )
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
                        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        <p>Your library is empty.</p>
                        <p className="text-sm">Click "Add" to begin.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
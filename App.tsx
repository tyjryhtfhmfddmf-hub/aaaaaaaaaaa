
import React, { useState, useRef, useCallback, useEffect } from 'react';

import { PlayerControls } from './components/PlayerControls';
import { NetworkPanel } from './components/NetworkPanel';
import { QueuePanel } from './components/QueuePanel';
import { LibraryTabs } from './components/LibraryTabs';
import { SavePlaylistModal } from './components/SavePlaylistModal';
import { SettingsModal } from './components/SettingsModal';
import { StatusBar } from './components/StatusBar';
import { ComparisonModal } from './components/ComparisonModal';
import { compareLibraries, getSongKey } from './lib/utils';
import type { Song, Playlist, CustomPalette, ComparisonData } from './types';

// --- IndexedDB Helpers ---
const DB_NAME = 'MusicSyncDB';
const DB_VERSION = 1;
const SONG_STORE = 'songs';

interface PlayerStatePayload {
    queueIds: string[];
    currentSongIndex: number;
    isPlaying: boolean;
    currentTime: number;
    shuffle: boolean;
    loop: boolean;
}

// --- Network Config ---
// This is a placeholder for your backend service on Render.
// You need to deploy a WebSocket server and replace this URL.
const WEBSOCKET_URL = 'wss://music-sync-relay-1.onrender.com/ws';
type NetworkStatus = 'offline' | 'connecting' | 'connected' | 'error';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SONG_STORE)) {
                db.createObjectStore(SONG_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const addSongsToDB = (songs: any[]): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction(SONG_STORE, 'readwrite');
        const store = transaction.objectStore(SONG_STORE);
        songs.forEach(song => store.put(song));
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
};

const getSongsFromDB = (): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction(SONG_STORE, 'readonly');
        const store = transaction.objectStore(SONG_STORE);
        const getAllRequest = store.getAll();
        transaction.oncomplete = () => {
            db.close();
            resolve(getAllRequest.result);
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error)
        };
    });
};

const removeSongFromDB = (songId: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction(SONG_STORE, 'readwrite');
        const store = transaction.objectStore(SONG_STORE);
        const request = store.delete(songId);
        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
};

const updateSongInDB = (songId: string, updatedData: Partial<Song>): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const db = await initDB();
        const transaction = db.transaction(SONG_STORE, 'readwrite');
        const store = transaction.objectStore(SONG_STORE);
        
        const getRequest = store.get(songId);

        getRequest.onsuccess = () => {
            const song = getRequest.result;
            if (song) {
                // Merge the updates, preserving the original file object
                const updatedSong = { ...song, ...updatedData };
                const putRequest = store.put(updatedSong);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error(`Song with id ${songId} not found in DB.`));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
};


const App: React.FC = () => {
    const [library, setLibrary] = useState<Song[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [queue, setQueue] = useState<Song[]>([]);
    const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(0.7);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [loop, setLoop] = useState<boolean>(false);
    const [shuffle, setShuffle] = useState<boolean>(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
    const [isStatusBarVisible, setIsStatusBarVisible] = useState<boolean>(false);
    const [rememberQueue, setRememberQueue] = useState<boolean>(true);
    const [theme, setTheme] = useState<string>('default');
    const [uiScale, setUiScale] = useState(1);
    const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false);
    const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
    const [remoteLibrary, setRemoteLibrary] = useState<Song[]>([]);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, { received: number, total: number }>>({});
    const [isNetworkPanelCollapsed, setIsNetworkPanelCollapsed] = useState<boolean>(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [activeCustomColors, setActiveCustomColors] = useState<CustomPalette['colors']>({
        primary: '#4F46E5',
        accent: '#34D399',
        text: '#E5E7EB',
        backgroundPrimary: '#111827',
        backgroundSecondary: '#1F2937',
        backgroundTertiary: '#374151',
        backgroundPlayer: '#111827',
        textPrimary: '#E5E7EB',
    });

    // --- Network State ---
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('offline');
    const [roomCode, setRoomCode] = useState<string>('');
    const [isHost, setIsHost] = useState<boolean>(false);
    const [clientId, setClientId] = useState<number | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const [outgoingFileChunks, setOutgoingFileChunks] = useState<Record<string, ArrayBuffer[]>>({});
    const downloadTimers = useRef<Record<string, number>>({});
    const peerConnections = useRef<Record<number, RTCPeerConnection>>({});
    const dataChannels = useRef<Record<number, RTCDataChannel>>({});
    // FIX: The return type of `setInterval` in a browser environment is a `number`, not `NodeJS.Timeout`.
    const syncIntervalRef = useRef<number | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const originalQueueBeforeShuffle = useRef<Song[]>([]);
    const [activeUrl, setActiveUrl] = useState<string | null>(null);
    const footerRef = useRef<HTMLElement>(null);
    const libraryRef = useRef<Song[]>(library);
    const chunkData = useRef<Record<string, any[]>>({});
    const playerStateRef = useRef({ queue, currentSongIndex, isPlaying, shuffle, loop });

    useEffect(() => {
        libraryRef.current = library;
    }, [library]);

    useEffect(() => {
        playerStateRef.current = { queue, currentSongIndex, isPlaying, shuffle, loop };
    }, [queue, currentSongIndex, isPlaying, shuffle, loop]);

    const handleDataChannelMessage = useCallback((event: MessageEvent) => {
        const message = JSON.parse(event.data);

        if (message.type === 'songFileChunk') {
            const { songKey, chunk, chunkIndex, totalChunks } = message.payload;

            if (!chunkData.current[songKey]) {
                chunkData.current[songKey] = [];
            }

            // Store chunk data in ref, and update progress state
            if (!chunkData.current[songKey][chunkIndex]) {
                chunkData.current[songKey][chunkIndex] = chunk;

                setDownloadProgress(prev => {
                    const newProgress = { ...prev };
                    if (!newProgress[songKey]) {
                        newProgress[songKey] = { received: 0, total: totalChunks };
                    }
                    newProgress[songKey].received++;
                    console.log(`Download progress for ${songKey}: ${newProgress[songKey].received}/${newProgress[songKey].total}`);
                    return newProgress;
                });
            }
        } else if (message.type === 'requestMissingFileChunks') {
             const { songKey: missingSongKey, missingIndices } = message.payload;
             const cachedChunks = outgoingFileChunks[missingSongKey];
             const dc = Object.values(dataChannels.current).find(d => d.readyState === 'open');
             if (cachedChunks && dc) {
                 console.log(`Resending ${missingIndices.length} missing chunks for ${missingSongKey} via WebRTC`);
                 missingIndices.forEach((index: number) => {
                     const chunk = cachedChunks[index];
                     if (chunk) {
                         dc.send(JSON.stringify({
                             type: 'songFileChunk',
                             payload: {
                                 songKey: missingSongKey,
                                 chunk: Array.from(new Uint8Array(chunk)),
                                 chunkIndex: index,
                                 totalChunks: cachedChunks.length,
                             }
                         }));
                     }
                 });
             }
        }
    }, [outgoingFileChunks]);

    const getPeerConnection = useCallback((peerId: number, senderId: number) => {
        if (peerConnections.current[peerId]) {
            console.log(`Closing existing peer connection for peer ${peerId} in state ${peerConnections.current[peerId].signalingState}`);
            peerConnections.current[peerId].close();
        }

        console.log(`Creating new peer connection for peer ${peerId}`);
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onconnectionstatechange = (event) => {
            console.log(`Peer connection state for peer ${peerId} changed to: ${pc.connectionState}`);
        };

        pc.onsignalingstatechange = (event) => {
            console.log(`Signaling state for peer ${peerId} changed to: ${pc.signalingState}`);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && websocketRef.current?.readyState === WebSocket.OPEN) {
                websocketRef.current.send(JSON.stringify({
                    type: 'iceCandidate',
                    payload: {
                        target: peerId,
                        candidate: event.candidate,
                    }
                }));
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;
            console.log(`Received data channel from ${peerId}`);
            dataChannels.current[peerId] = channel;
            channel.onmessage = handleDataChannelMessage;
            channel.onclose = () => console.log(`Data channel from peer ${peerId} closed.`);
            channel.onerror = (error) => console.error(`Data channel error from peer ${peerId}:`, error);
        };
        
        peerConnections.current[peerId] = pc;
        return pc;
    }, [handleDataChannelMessage]);

    const processDownloadedFile = useCallback(async (songKey: string) => {
        const chunks = chunkData.current[songKey];
        if (!chunks) {
            console.error(`Could not find chunk data for completed download: ${songKey}`);
            return;
        }

        const receivedSong = library.find(s => getSongKey(s) === songKey);

        if (!receivedSong) {
            console.error(`Downloaded song with key "${songKey}" not found in the library.`);
            alert(`Error: Could not find song for downloaded file "${songKey}". The download cannot be completed.`);
        } else {
            try {
                const fileBlob = new Blob(chunks.map(c => new Uint8Array(c)), { type: 'audio/mpeg' });
                const newFile = new File([fileBlob], `${receivedSong.title}.mp3`, { type: fileBlob.type });

                const jsmediatags = (window as any).jsmediatags;
                let albumArt = receivedSong.albumArt;
                try {
                    const tags: any = await new Promise((resolve, reject) => {
                        jsmediatags.read(newFile, { onSuccess: resolve, onError: reject });
                    });
                    const { picture } = tags.tags;
                    if (picture) {
                        const artBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
                        albumArt = await blobToDataURL(artBlob);
                    }
                } catch (error) {
                    console.error("Error reading tags from downloaded file, preserving old album art.", error);
                }

                const updatedSong = {
                    ...receivedSong,
                    file: newFile,
                    isRemote: false,
                    albumArt: albumArt
                };

                await updateSongInDB(receivedSong.id, { file: newFile, isRemote: false, albumArt: albumArt ? new Blob([await fetch(albumArt).then(r => r.arrayBuffer())]) : undefined });

                setLibrary(prevLib => prevLib.map(s => s.id === receivedSong.id ? updatedSong : s));
                setQueue(prevQueue => prevQueue.map(s => s.id === receivedSong.id ? updatedSong : s));

                alert(`${receivedSong.title} has been downloaded!`);

            } catch (error) {
                console.error("Failed to process or save downloaded song:", error);
                alert(`An error occurred while finalizing the download for "${receivedSong.title}". Please try again.`);
            }
        }

        // Clean up the completed download from the state and refs
        delete chunkData.current[songKey];
        setDownloadProgress(prev => {
            const newState = { ...prev };
            delete newState[songKey];
            return newState;
        });
    }, [library]);

    useEffect(() => {
        for (const songKey in downloadProgress) {
            const download = downloadProgress[songKey];
            if (download) {
                // Clear any existing timer for this download
                if (downloadTimers.current[songKey]) {
                    clearTimeout(downloadTimers.current[songKey]);
                }

                if (download.received === download.total) {
                    // All chunks are here. Process the file.
                    console.log(`Download complete for ${songKey}. Processing file...`);
                    processDownloadedFile(songKey);
                } else {
                    // Download is incomplete, set a timer to check for missing chunks
                    downloadTimers.current[songKey] = window.setTimeout(() => {
                        const currentChunks = chunkData.current[songKey] || [];
                        const missingIndices: number[] = [];
                        for (let i = 0; i < download.total; i++) {
                            if (!currentChunks[i]) {
                                missingIndices.push(i);
                            }
                        }

                        if (missingIndices.length > 0) {
                            console.log(`Requesting ${missingIndices.length} missing chunks for ${songKey} after timeout.`);
                            // Find an open data channel to send the request
                            const dc = Object.values(dataChannels.current).find(d => d.readyState === 'open');
                            if (dc) {
                                dc.send(JSON.stringify({
                                    type: 'requestMissingFileChunks',
                                    payload: { songKey, missingIndices }
                                }));
                            }
                        }
                    }, 5000); // 5-second timeout
                }
            }
        }
    }, [downloadProgress, processDownloadedFile]);

    const blobToDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleDownloadSong = useCallback((songId: string) => {
        const songToDownload = libraryRef.current.find(s => s.id === songId);
        if (songToDownload && songToDownload.isRemote) {
            if (websocketRef.current?.readyState === WebSocket.OPEN) {
                websocketRef.current.send(JSON.stringify({
                    type: 'requestSongFile',
                    payload: { songKey: getSongKey(songToDownload) }
                }));
                alert(`Requesting "${songToDownload.title}"...`);
            } else {
                alert('Not connected to a session. Cannot download songs.');
            }
        }
    }, []);

    useEffect(() => {
        const songToPlay = queue[currentSongIndex];
        if (songToPlay) {
            if (songToPlay.isRemote && !songToPlay.file) {
                handleDownloadSong(songToPlay.id);
            } else if (!songToPlay.isRemote && songToPlay.file) {
                const url = URL.createObjectURL(songToPlay.file as File);
                setActiveUrl(url);
                if (audioRef.current) {
                    audioRef.current.src = url;
                    audioRef.current.play().catch(e => console.error("Error playing audio:", e));
                    if (networkStatus !== 'connected') {
                         setIsPlaying(true);
                    }
                }
            }
        }
    }, [queue, currentSongIndex, handleDownloadSong, networkStatus]);

    useEffect(() => {
        const loadInitialData = async () => {
            const dbSongs = await getSongsFromDB();
            const processedSongs = await Promise.all(
                dbSongs.map(async (song) => ({
                    ...song,
                    albumArt: song.albumArt instanceof Blob ? await blobToDataURL(song.albumArt) : song.albumArt,
                }))
            );
            setLibrary(processedSongs);

            const savedPlaylists = localStorage.getItem('music_playlists');
            if (savedPlaylists) setPlaylists(JSON.parse(savedPlaylists));
            
            const savedRememberQueue = localStorage.getItem('music_rememberQueue');
            const shouldRemember = savedRememberQueue ? JSON.parse(savedRememberQueue) : true;
            setRememberQueue(shouldRemember);

            if (shouldRemember) {
                const savedQueueIds = localStorage.getItem('music_queue');
                const savedIndexStr = localStorage.getItem('music_queue_index');
                if (savedQueueIds && savedIndexStr) {
                    const queueIds = JSON.parse(savedQueueIds);
                    const reconstructedQueue = queueIds
                        .map((id: string) => processedSongs.find(s => s.id === id))
                        .filter((s): s is Song => !!s);
                    
                    if (reconstructedQueue.length > 0) {
                        const savedIndex = parseInt(savedIndexStr, 10);
                        setQueue(reconstructedQueue);
                        setCurrentSongIndex(savedIndex);

                        const songToLoad = reconstructedQueue[savedIndex];
                        const url = URL.createObjectURL(songToLoad.file as File);
                        setActiveUrl(url);
                        if (audioRef.current) audioRef.current.src = url;
                    }
                }
            }
        };

        loadInitialData();
        
        const savedStatusBarPref = localStorage.getItem('music_statusBarVisible');
        if (savedStatusBarPref) setIsStatusBarVisible(JSON.parse(savedStatusBarPref));

        const savedTheme = localStorage.getItem('music_theme') || 'default';
        setTheme(savedTheme);

        const savedUiScale = localStorage.getItem('music_ui_scale');
        if (savedUiScale) {
            setUiScale(parseFloat(savedUiScale));
        }

        const savedPalettes = localStorage.getItem('music_custom_palettes');
        if (savedPalettes) {
            const parsedPalettes = JSON.parse(savedPalettes);
            setCustomPalettes(parsedPalettes);
            if (savedTheme === 'custom') {
                const activePalette = parsedPalettes.find((p: CustomPalette) => p.id === localStorage.getItem('music_active_palette_id'));
                 if (activePalette) setActiveCustomColors(activePalette.colors);
            }
        }

        if (window.electronAPI) {
            window.electronAPI.onUpdateStatus((status) => {
                setUpdateStatus(status);
            });
        }
    }, []);

    useEffect(() => {
        document.documentElement.style.fontSize = `${uiScale * 16}px`;
        localStorage.setItem('music_ui_scale', uiScale.toString());
    }, [uiScale]);
    
    const applyCustomColors = useCallback((colors: CustomPalette['colors']) => {
        const root = document.documentElement;

        const lighten = (hex: string, percent: number) => {
            try {
                hex = hex.replace(/^#/, '');
                let r = parseInt(hex.substring(0, 2), 16);
                let g = parseInt(hex.substring(2, 4), 16);
                let b = parseInt(hex.substring(4, 6), 16);

                r = Math.min(255, Math.floor(r + (255 - r) * (percent/100)));
                g = Math.min(255, Math.floor(g + (255 - g) * (percent/100)));
                b = Math.min(255, Math.floor(b + (255 - b) * (percent/100)));

                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            } catch (e) {
                return hex;
            }
        };

        const hexToRgba = (hex: string, alpha: number) => {
            try {
                 const hexValue = hex.replace(/^#/, '');
                 const r = parseInt(hexValue.substring(0, 2), 16);
                 const g = parseInt(hexValue.substring(2, 4), 16);
                 const b = parseInt(hexValue.substring(4, 6), 16);
                 return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            } catch (e) {
                return `rgba(79, 70, 229, ${alpha})`; // Fallback
            }
        };

        root.style.setProperty('--custom-color-primary', colors.primary);
        root.style.setProperty('--custom-color-primary-hover', lighten(colors.primary, 15));
        root.style.setProperty('--custom-color-accent', colors.accent);
        root.style.setProperty('--custom-color-text', colors.text);
        root.style.setProperty('--custom-color-primary-t-50', hexToRgba(colors.primary, 0.5));
        root.style.setProperty('--custom-color-bg-primary', colors.backgroundPrimary);
        root.style.setProperty('--custom-color-bg-secondary', colors.backgroundSecondary);
        root.style.setProperty('--custom-color-bg-secondary-t-50', hexToRgba(colors.backgroundSecondary, 0.5));
        root.style.setProperty('--custom-color-bg-secondary-t-60', hexToRgba(colors.backgroundSecondary, 0.6));
        root.style.setProperty('--custom-color-bg-primary-t-50', hexToRgba(colors.backgroundPrimary, 0.5));
        root.style.setProperty('--custom-color-bg-tertiary', colors.backgroundTertiary);
        root.style.setProperty('--custom-color-bg-tertiary-t-50', hexToRgba(colors.backgroundTertiary, 0.5));
        root.style.setProperty('--custom-color-bg-player', colors.backgroundPlayer);
        root.style.setProperty('--custom-color-text-primary', colors.textPrimary);
    }, []);

    useEffect(() => {
        const themeClasses = Array.from(document.body.classList).filter(c => c.startsWith('theme-'));
        document.body.classList.remove(...themeClasses);

        if (theme === 'custom') {
            document.body.classList.add('theme-custom');
            applyCustomColors(activeCustomColors);
        } else {
            document.body.classList.add(`theme-${theme}`);
        }
        localStorage.setItem('music_theme', theme);
    }, [theme, activeCustomColors, applyCustomColors]);

    useEffect(() => {
        localStorage.setItem('music_statusBarVisible', JSON.stringify(isStatusBarVisible));
    }, [isStatusBarVisible]);

    useEffect(() => {
        localStorage.setItem('music_rememberQueue', JSON.stringify(rememberQueue));
        if (!rememberQueue) {
            localStorage.removeItem('music_queue');
            localStorage.removeItem('music_queue_index');
        }
    }, [rememberQueue]);

    const handleThemeChange = (newTheme: string) => {
        if (newTheme.startsWith('custom-palette-')) {
            const paletteId = newTheme;
            const palette = customPalettes.find(p => p.id === paletteId);
            if (palette) {
                setActiveCustomColors(palette.colors);
                setTheme('custom');
                localStorage.setItem('music_active_palette_id', palette.id);
            }
        } else {
            setTheme(newTheme);
            localStorage.removeItem('music_active_palette_id');
        }
    };

    const handleCustomColorChange = (newColors: typeof activeCustomColors) => {
        setActiveCustomColors(newColors);
        setTheme('custom');
        localStorage.removeItem('music_active_palette_id');
    };

    const saveCustomPalette = (name: string) => {
        const newPalette: CustomPalette = {
            id: `custom-palette-${Date.now()}`,
            name,
            colors: activeCustomColors,
        };
        const updatedPalettes = [...customPalettes, newPalette];
        setCustomPalettes(updatedPalettes);
        localStorage.setItem('music_custom_palettes', JSON.stringify(updatedPalettes));
    };

    const deleteCustomPalette = (id: string) => {
        const updatedPalettes = customPalettes.filter(p => p.id !== id);
        setCustomPalettes(updatedPalettes);
        localStorage.setItem('music_custom_palettes', JSON.stringify(updatedPalettes));
    };

    const updateCustomPalette = (id: string, newName: string) => {
        if (!newName.trim()) return;
        const updatedPalettes = customPalettes.map(p =>
            p.id === id ? { ...p, name: newName.trim() } : p
        );
        setCustomPalettes(updatedPalettes);
        localStorage.setItem('music_custom_palettes', JSON.stringify(updatedPalettes));
    };

    const handleSongsAdded = async (songsFromPanel: any[]) => {
        await addSongsToDB(songsFromPanel);
        const processedSongs = await Promise.all(
            songsFromPanel.map(async (song) => ({
                ...song,
                albumArt: song.albumArt ? await blobToDataURL(song.albumArt) : undefined,
            }))
        );
        setLibrary(prev => [...prev, ...processedSongs]);
    };

    const handleRemoveSongFromLibrary = async (songId: string) => {
        // Remove from library state
        setLibrary(prevLibrary => prevLibrary.filter(song => song.id !== songId));

        // Remove from any playlists
        const newPlaylists = playlists.map(playlist => ({
            ...playlist,
            songIds: playlist.songIds.filter(id => id !== songId),
        }));
        setPlaylists(newPlaylists);
        localStorage.setItem('music_playlists', JSON.stringify(newPlaylists));

        // Also remove from queue if it exists there
        removeFromQueue(songId);

        // Remove from DB
        try {
            await removeSongFromDB(songId);
        } catch (error) {
            console.error(`Failed to remove song ${songId} from DB:`, error);
            // Consider adding user-facing error feedback here
        }
    };

    const handleUpdateSongMetadata = async (songId: string, newMetadata: { title: string; artist: string; album: string }) => {
        setLibrary(prevLibrary => 
            prevLibrary.map(song => 
                song.id === songId ? { ...song, ...newMetadata } : song
            )
        );
        try {
            await updateSongInDB(songId, newMetadata);
        } catch (error) {
            console.error(`Failed to update metadata for song ${songId} in DB:`, error);
            // Consider adding user-facing error feedback here
        }
    };

    const lastSeekSync = useRef<number | null>(null);

    const sendPlayerState = useCallback((newState: {
        queue: Song[],
        currentSongIndex: number,
        isPlaying: boolean,
        currentTime: number,
        shuffle: boolean,
        loop: boolean,
    }) => {
        if (isApplyingNetworkState.current) return;
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const payload: PlayerStatePayload = {
                queueIds: newState.queue.map(s => s.id),
                currentSongIndex: newState.currentSongIndex,
                isPlaying: newState.isPlaying,
                currentTime: newState.currentTime,
                shuffle: newState.shuffle,
                loop: newState.loop,
            };
            websocketRef.current.send(JSON.stringify({ type: 'fullSync', payload }));
        }
    }, []);

    const saveQueueState = useCallback(() => {
        if (!rememberQueue) return;
        localStorage.setItem('music_queue', JSON.stringify(queue.map(s => s.id)));
        localStorage.setItem('music_queue_index', currentSongIndex.toString());
    }, [queue, currentSongIndex, rememberQueue]);
    
    const playSong = (index: number) => {
        setCurrentSongIndex(index);
    };

    const handlePlayPause = useCallback(() => {
        const newIsPlaying = !isPlaying;
        if (newIsPlaying) {
            if (currentSongIndex === -1 && queue.length > 0) {
                setCurrentSongIndex(0);
            } else {
                audioRef.current?.play().catch(e => console.error("Error resuming audio:", e));
            }
        } else {
            audioRef.current?.pause();
        }
        setIsPlaying(newIsPlaying);
        sendPlayerState({ queue, currentSongIndex, isPlaying: newIsPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle, loop });
    }, [isPlaying, currentSongIndex, queue, shuffle, loop, sendPlayerState]);

    const handleNext = useCallback(() => {
        if (queue.length === 0) return;
        const nextIndex = (currentSongIndex + 1) % queue.length;
        setCurrentSongIndex(nextIndex);
        sendPlayerState({ queue, currentSongIndex: nextIndex, isPlaying, currentTime: 0, shuffle, loop });
    }, [currentSongIndex, queue, isPlaying, shuffle, loop, sendPlayerState]);

    const handlePrev = useCallback(() => {
        if (queue.length === 0) return;
        const prevIndex = (currentSongIndex - 1 + queue.length) % queue.length;
        setCurrentSongIndex(prevIndex);
        sendPlayerState({ queue, currentSongIndex: prevIndex, isPlaying, currentTime: 0, shuffle, loop });
    }, [currentSongIndex, queue, isPlaying, shuffle, loop, sendPlayerState]);
    
    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
            const now = Date.now();
            if (now - (lastSeekSync.current || 0) > 250) {
                sendPlayerState({ queue, currentSongIndex, isPlaying, currentTime: time, shuffle, loop });
                lastSeekSync.current = now;
            }
        }
    };

    const handleVolumeChange = (newVolume: number) => {
        if (audioRef.current) audioRef.current.volume = newVolume;
        setVolume(newVolume);
        if (newVolume > 0 && isMuted) setIsMuted(false);
    };
    
    const handleToggleMute = () => {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        if (audioRef.current) audioRef.current.muted = newMutedState;
    };
    
    const handleToggleShuffle = useCallback(() => {
        const newShuffleState = !shuffle;
        let newQueue = queue;
        let newIndex = currentSongIndex;

        if (newShuffleState) {
            originalQueueBeforeShuffle.current = [...queue];
            const currentSong = queue[currentSongIndex];
            const restOfQueue = queue.filter((_, i) => i !== currentSongIndex);
            for (let i = restOfQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [restOfQueue[i], restOfQueue[j]] = [restOfQueue[j], restOfQueue[i]];
            }
            newQueue = currentSong ? [currentSong, ...restOfQueue] : restOfQueue;
            newIndex = 0;
        } else {
            const originalQueue = originalQueueBeforeShuffle.current;
            const currentSong = queue[currentSongIndex];
            newQueue = originalQueue;
            newIndex = currentSong ? originalQueue.findIndex(s => s.id === currentSong.id) : 0;
        }
        
        setShuffle(newShuffleState);
        setQueue(newQueue);
        setCurrentSongIndex(newIndex);
        sendPlayerState({ queue: newQueue, currentSongIndex: newIndex, isPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle: newShuffleState, loop });
    }, [shuffle, queue, currentSongIndex, isPlaying, loop, sendPlayerState]);

    const handleToggleLoop = useCallback(() => {
        const newLoopState = !loop;
        setLoop(newLoopState);
        sendPlayerState({ queue, currentSongIndex, isPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle, loop: newLoopState });
    }, [loop, queue, currentSongIndex, isPlaying, shuffle, sendPlayerState]);

    const addToQueue = (song: Song) => {
        if (!queue.some(s => s.id === song.id)) {
            const newQueue = [...queue, song];
            setQueue(newQueue);
            sendPlayerState({ queue: newQueue, currentSongIndex, isPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle, loop });
        } else {
            console.log(`"${song.title}" is already in the queue.`);
        }
    };

    const removeFromQueue = (songId: string) => {
        const songToRemove = queue.find(s => s.id === songId);
        if (!songToRemove) return;

        const removedIndex = queue.findIndex(s => s.id === songId);
        let newQueue = queue.filter(s => s.id !== songId);
        let newIndex = currentSongIndex;
        let newIsPlaying = isPlaying;

        if (removedIndex === currentSongIndex) {
            if (isPlaying) {
                audioRef.current?.pause();
                newIsPlaying = false;
            }
             if (newQueue.length > 0) {
                newIndex = removedIndex % newQueue.length;
             } else {
                newIndex = -1;
                if (activeUrl) URL.revokeObjectURL(activeUrl);
                setActiveUrl(null);
                if(audioRef.current) audioRef.current.src = '';
             }
        } else if (removedIndex < currentSongIndex) {
            newIndex = currentSongIndex - 1;
        }

        setQueue(newQueue);
        setCurrentSongIndex(newIndex);
        setIsPlaying(newIsPlaying);
        if (removedIndex === currentSongIndex && newQueue.length > 0) {
             playSong(newIndex);
        }
        sendPlayerState({ queue: newQueue, currentSongIndex: newIndex, isPlaying: newIsPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle, loop });
    };

    const addSongByIdToQueue = (songId: string) => {
        const songToAdd = library.find(s => s.id === songId);
        if (songToAdd) {
            addToQueue(songToAdd);
        } else {
            console.warn(`Song with id ${songId} not found in library.`);
        }
    };

    const reorderQueue = (startIndex: number, endIndex: number) => {
        const result = Array.from(queue);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);

        const currentSongId = queue[currentSongIndex]?.id;
        const newIndex = result.findIndex(s => s.id === currentSongId);
        
        setCurrentSongIndex(newIndex);
        setQueue(result);
        sendPlayerState({ queue: result, currentSongIndex: newIndex, isPlaying, currentTime: audioRef.current?.currentTime || 0, shuffle, loop });
    };

    const savePlaylist = (name: string) => {
        if (!name || queue.length === 0) {
            console.warn(queue.length === 0 ? "Cannot save an empty queue." : "Playlist name cannot be empty.");
            return;
        }
        const newPlaylist: Playlist = {
            id: `playlist-${Date.now()}`,
            name,
            songIds: queue.map(s => s.id),
        };
        const newPlaylists = [...playlists, newPlaylist];
        setPlaylists(newPlaylists);
        localStorage.setItem('music_playlists', JSON.stringify(newPlaylists));
        setIsSaveModalOpen(false);
    };

    const loadPlaylist = (playlist: Playlist) => {
        const songsFromIds = playlist.songIds
            .map(id => library.find(s => s.id === id))
            .filter((s): s is Song => !!s);
        
        let newIndex = -1;
        let newIsPlaying = false;
        if (songsFromIds.length > 0) {
            newIndex = 0;
            newIsPlaying = true;
        }
        
        setQueue(songsFromIds);
        setCurrentSongIndex(newIndex);
        setIsPlaying(newIsPlaying);
        if (songsFromIds.length > 0) {
            playSong(0);
        }
        sendPlayerState({ queue: songsFromIds, currentSongIndex: newIndex, isPlaying: newIsPlaying, currentTime: 0, shuffle, loop });
    };

    const deletePlaylist = (playlistId: string) => {
        const newPlaylists = playlists.filter(p => p.id !== playlistId);
        setPlaylists(newPlaylists);
        localStorage.setItem('music_playlists', JSON.stringify(newPlaylists));
    };

    const updatePlaylistName = (playlistId: string, newName: string) => {
        if (!newName.trim()) return;
        const newPlaylists = playlists.map(p => 
            p.id === playlistId ? { ...p, name: newName.trim() } : p
        );
        setPlaylists(newPlaylists);
        localStorage.setItem('music_playlists', JSON.stringify(newPlaylists));
    };

    const clearQueue = useCallback(() => {
        setQueue([]);
        setCurrentSongIndex(-1);
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        if (activeUrl) {
            URL.revokeObjectURL(activeUrl);
            setActiveUrl(null);
        }
        setCurrentTime(0);
        setDuration(0);
        sendPlayerState({ queue: [], currentSongIndex: -1, isPlaying: false, currentTime: 0, shuffle, loop });
    }, [activeUrl, shuffle, loop, sendPlayerState]);


    useEffect(() => {
        saveQueueState();
    }, [queue, currentSongIndex, saveQueueState]);
    
    // --- Network Handlers ---
    const shareFullLibrary = useCallback(() => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const serializableLibrary = library
                .filter(song => !song.isRemote)
                .map(song => {
                    const { file, ...rest } = song; // Exclude File object
                    return rest;
                });
            
            if (serializableLibrary.length > 0) {
                websocketRef.current.send(JSON.stringify({
                    type: 'shareLibrary',
                    payload: { library: serializableLibrary }
                }));
            }
        }
    }, [library]);

    useEffect(() => {
        if (networkStatus === 'connected') {
            shareFullLibrary(); // Initial share on connect
        }
    }, [networkStatus, shareFullLibrary]);

    const resetNetworkState = useCallback(() => {
        setNetworkStatus('offline');
        setIsHost(false);
        setRoomCode('');
        setRemoteLibrary([]);
        if (websocketRef.current) {
            // Remove handlers to prevent them from being called during manual cleanup
            websocketRef.current.onopen = null;
            websocketRef.current.onmessage = null;
            websocketRef.current.onerror = null;
            websocketRef.current.onclose = null;
            if (websocketRef.current.readyState === WebSocket.OPEN || websocketRef.current.readyState === WebSocket.CONNECTING) {
                websocketRef.current.close();
            }
            websocketRef.current = null;
        }

        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        dataChannels.current = {};
    }, []);

    const isApplyingNetworkState = useRef(false);

    const initWebSocket = useCallback((onOpenCallback: () => void) => {
        if (websocketRef.current && websocketRef.current.readyState < 2) {
            console.warn("WebSocket connection attempt ignored, one already exists.");
            return;
        }

        setNetworkStatus('connecting');
        const ws = new WebSocket(WEBSOCKET_URL);
        websocketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            setNetworkStatus('connected');
            onOpenCallback();
        };

        ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);

                isApplyingNetworkState.current = true;

                switch (message.type) {
                    case 'connected': {
                        setClientId(message.payload.id);
                        break;
                    }
                    case 'hosted': {
                        setIsHost(true);
                        setRoomCode(message.payload.roomCode);
                        break;
                    }
                    case 'joined': {
                        setIsHost(false);
                        setRoomCode(message.payload.roomCode);
                        break;
                    }
                    case 'libraryUpdate': {
                        const remoteLibraryUpdate = message.payload.library as Omit<Song, 'file'>[];
                        setRemoteLibrary(remoteLibraryUpdate.map(song => ({ ...song, isRemote: true })));
                        
                        const newSongs = remoteLibraryUpdate
                            .filter(remoteSong => !libraryRef.current.some(localSong => localSong.id === remoteSong.id))
                            .map(remoteSong => ({
                                ...remoteSong,
                                isRemote: true,
                            }));

                        if (newSongs.length > 0) {
                            console.log(`Merging ${newSongs.length} new songs from network.`);
                            addSongsToDB(newSongs).then(() => {
                                console.log('Successfully added remote songs to the database.');
                                setLibrary(prevLibrary => [...prevLibrary, ...newSongs]);
                            }).catch(error => {
                                console.error('Failed to add remote songs to the database:', error);
                            });
                        }
                        break;
                    }
                    case 'requestLibraryShare': {
                        shareFullLibrary();
                        break;
                    }
                    case 'playlistUpdate': {
                        const { playlist } = message.payload;
                        alert(`Playlist "${playlist.name}" has been shared by a user in room ${roomCode}.`);
                        break;
                    }
                    case 'requestSongFile': {
                        try {
                            console.log('Received requestSongFile, initiating WebRTC...');
                            const { songKey, requester } = message.payload;
                            const songToSend = library.find(song => getSongKey(song) === songKey);
                            if (songToSend && songToSend.file) {
                                const pc = getPeerConnection(requester, clientId!);
                                const dc = pc.createDataChannel(songKey);
                                console.log('Created data channel');
                                dataChannels.current[requester] = dc;
                                dc.onopen = () => {
                                    console.log('Data channel opened, preparing to send file...');
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        console.log('FileReader onload started.');
                                        const arrayBuffer = e.target.result as ArrayBuffer;
                                        const chunkSize = 16384;
                                        const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);
                                        const chunks: ArrayBuffer[] = [];
                                        for (let i = 0; i < totalChunks; i++) {
                                            chunks.push(arrayBuffer.slice(i * chunkSize, (i + 1) * chunkSize));
                                        }
                                        setOutgoingFileChunks(prev => ({ ...prev, [songKey]: chunks }));
                                        let i = 0;
                                        console.log('Starting to send chunks...');
                                        function sendChunk() {
                                            if (i >= chunks.length) return;
                                            if (dc.readyState === 'open') {
                                                console.log(`Sending chunk ${i} for ${songKey}`);
                                                dc.send(JSON.stringify({
                                                    type: 'songFileChunk',
                                                    payload: {
                                                        songKey,
                                                        chunk: Array.from(new Uint8Array(chunks[i])),
                                                        chunkIndex: i,
                                                        totalChunks,
                                                    }
                                                }));
                                                i++;
                                                setTimeout(sendChunk, 10);
                                            } else {
                                                console.warn(`Data channel not open, stopping send for ${songKey}`);
                                            }
                                        }
                                        sendChunk();
                                    };
                                    reader.readAsArrayBuffer(songToSend.file!);
                                };
                                dc.onclose = () => {
                                    console.log(`Data channel to ${requester} closed.`);
                                };
                                
                                console.log('Creating WebRTC offer...');
                                const offer = await pc.createOffer();
                                
                                console.log('Setting local description...');
                                await pc.setLocalDescription(offer);
                                
                                console.log('Sending WebRTC offer...');
                                websocketRef.current?.send(JSON.stringify({
                                    type: 'webrtcOffer',
                                    payload: { target: requester, offer }
                                }));
                            } else {
                                websocketRef.current?.send(JSON.stringify({
                                    type: 'songFileNotFound',
                                    payload: { songKey, target: requester }
                                }));
                            }
                        } catch (error) {
                            console.error('Error handling requestSongFile and creating offer:', error);
                            alert(`Error creating download offer: ${error}`);
                        }
                        break;
                    }
                    case 'songFileNotFound': {
                        const { songKey } = message.payload;
                        alert(`Could not start download for song. File not found by remote user for song: ${songKey}`);
                        setDownloadProgress(prev => {
                            const newState = { ...prev };
                            delete newState[songKey];
                            return newState;
                        });
                        break;
                    }
                    case 'webrtcOffer': {
                        try {
                            console.log('Received WebRTC offer...');
                            const { offer, sender: offererId } = message.payload;
                            const pcForOffer = getPeerConnection(offererId, clientId!);
                            
                            console.log('Setting remote description...');
                            await pcForOffer.setRemoteDescription(new RTCSessionDescription(offer));
                            
                            console.log('Creating answer...');
                            const answer = await pcForOffer.createAnswer();
                            
                            console.log('Setting local description...');
                            await pcForOffer.setLocalDescription(answer);
                            
                            console.log('Sending answer...');
                            websocketRef.current?.send(JSON.stringify({
                                type: 'webrtcAnswer',
                                payload: { target: offererId, answer }
                            }));
                        } catch (error) {
                            console.error("Error handling WebRTC offer:", error);
                            alert(`Error handling download offer: ${error}`);
                        }
                        break;
                    }
                    case 'webrtcAnswer': {
                        const { answer, sender: answererId } = message.payload;
                        const pcForAnswer = peerConnections.current[answererId];
                        if (pcForAnswer) {
                            await pcForAnswer.setRemoteDescription(new RTCSessionDescription(answer));
                        }
                        break;
                    }
                    case 'iceCandidate': {
                        const { candidate, sender: candidateSenderId } = message.payload;
                        const pcForCandidate = peerConnections.current[candidateSenderId];
                        if (pcForCandidate && candidate) {
                            await pcForCandidate.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                        break;
                    }
                    case 'left': {
                        ws.close();
                        break;
                    }
                    case 'error': {
                        const errorMessage = message.payload.message;
                        const alertMessage = typeof errorMessage === 'string'
                            ? errorMessage
                            : JSON.stringify(errorMessage, null, 2);
                        alert(`Network Error: ${alertMessage}`);
                        setNetworkStatus('error');
                        ws.close();
                        break;
                    }
                    case 'fullSync': {
                        const { payload } = message;

                        // A fullSync with an empty payload or missing queueIds is a request for the host's state.
                        if (!payload || typeof payload.queueIds === 'undefined') {
                            if (isHost) {
                                console.log('Received state request, sending full player state.');
                                const currentState = playerStateRef.current;
                                sendPlayerState({
                                    ...currentState,
                                    currentTime: audioRef.current?.currentTime || 0,
                                });
                            } else {
                                console.log('Received empty fullSync as non-host, ignoring.');
                            }
                            break;
                        }

                        const {
                            queueIds,
                            currentSongIndex: newIndex,
                            isPlaying: newIsPlaying,
                            currentTime: newCurrentTime,
                            shuffle: newShuffle,
                            loop: newLoop,
                        } = payload;

                        const newQueue = queueIds
                            .map((id: string) => libraryRef.current.find(s => s.id === id))
                            .filter((s): s is Song => !!s);

                        setQueue(newQueue);
                        setShuffle(newShuffle);
                        setLoop(newLoop);
                        setCurrentSongIndex(newIndex);
                        setIsPlaying(newIsPlaying);

                        if (audioRef.current) {
                            // To prevent jarring jumps, only seek if the time difference is significant
                            if (Math.abs(audioRef.current.currentTime - newCurrentTime) > 2) {
                                audioRef.current.currentTime = newCurrentTime;
                            }
                        }

                        if (newIsPlaying) {
                            audioRef.current?.play().catch(e => console.error("Error applying network play state:", e));
                        } else {
                            audioRef.current?.pause();
                        }
                        break;
                    }
                    default: {
                        console.warn('Unknown message type received:', message.type);
                    }
                }
            } catch (e) {
                console.error('Error parsing message from server:', e);
            } finally {
                isApplyingNetworkState.current = false;
            }
        };

        ws.onclose = (event: CloseEvent) => {
            console.log(`WebSocket disconnected. Code: ${event.code}, Reason: '${event.reason || 'No reason provided'}'`);
            resetNetworkState();
        };

        ws.onerror = (error) => {
            console.error('WebSocket error event:', error);
            alert('Failed to connect to the network service. The service may be starting up. Please try again in a moment.');
            setNetworkStatus('error');
        };
    }, [library, roomCode, getPeerConnection, resetNetworkState, shareFullLibrary, clientId, isHost, sendPlayerState, playerStateRef]);

    const handleHost = useCallback(() => {
        initWebSocket(() => {
            websocketRef.current?.send(JSON.stringify({ type: 'host' }));
        });
    }, [initWebSocket]);
    
    const handleJoin = useCallback((code: string) => {
        initWebSocket(() => {
            websocketRef.current?.send(JSON.stringify({ type: 'join', payload: { roomCode: code } }));
        });
    }, [initWebSocket]);

    const handleLeave = useCallback(() => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: 'leave' }));
        }
        resetNetworkState();
    }, [resetNetworkState]);

    const handleShareQueue = useCallback(() => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const queueIds = queue.map(s => s.id);
            console.log('Sharing queue with ids:', queueIds);
            websocketRef.current.send(JSON.stringify({
                type: 'shareQueue',
                payload: { queue: queueIds }
            }));
            alert('Queue shared with the room!');
        } else {
            alert('Not connected to a session.');
        }
    }, [queue]);

    const handleSharePlaylist = useCallback((playlistId: string) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const playlistToShare = playlists.find(p => p.id === playlistId);
            if (playlistToShare) {
                websocketRef.current.send(JSON.stringify({
                    type: 'sharePlaylist',
                    payload: { playlist: playlistToShare }
                }));
                alert(`Shared playlist: "${playlistToShare.name}"`);
            } else {
                alert('Playlist not found.');
            }
        } else {
            alert('Not connected to a session.');
        }
    }, [playlists]);

    const handleCompareLibraries = useCallback((remoteLibrary: Song[]) => {
        const localUser = 'You';
        const remoteUser = 'Them'; // Replace with actual remote user name if available
        const comparisonResult = compareLibraries(localUser, remoteUser, library.filter(s => !s.isRemote), remoteLibrary);
        setComparisonData(comparisonResult);
        setIsComparisonModalOpen(true);
    }, [library]);

    const handleSyncCommon = useCallback(() => {
        if (remoteLibrary.length > 0) {
            const comparison = compareLibraries("local", "remote", library, remoteLibrary);
            const commonSongs = comparison.commonSongs;

            if (commonSongs.length > 0) {
                // Assuming "play order" means adding to the current queue in the order they appear in the local library.
                // The compareLibraries function preserves the local library's order for common songs.
                let updatedQueue = [...queue];
                let addedCount = 0;
                commonSongs.forEach(song => {
                    if (!updatedQueue.some(s => s.id === song.id)) {
                        updatedQueue.push(song);
                        addedCount++;
                    }
                });
                setQueue(updatedQueue);
                alert(`${addedCount} common songs have been added to your queue.`);
            } else {
                alert('No common songs found to sync.');
            }
        } else {
            alert('No remote library to compare with. Is anyone else in the room?');
        }
    }, [library, remoteLibrary, queue]);

    const handleCompareLibrariesButtonClick = useCallback(() => {
        if (remoteLibrary.length > 0) {
            handleCompareLibraries(remoteLibrary);
        } else {
            alert('No remote library received yet. Wait for a user to connect.');
        }
    }, [remoteLibrary, handleCompareLibraries]);

    const handleDownloadAllMissing = useCallback(() => {
        const remoteSongs = libraryRef.current.filter(s => s.isRemote && !downloadProgress[getSongKey(s)]);
        if (remoteSongs.length === 0) {
            alert('No new remote songs to download.');
            return;
        }

        alert(`Starting download for ${remoteSongs.length} song(s).`);

        let i = 0;
        function downloadNext() {
            if (i >= remoteSongs.length) {
                console.log('Finished queueing all remote song downloads.');
                return;
            }
            
            const songToDownload = remoteSongs[i];
            console.log(`Queueing download for: ${songToDownload.title}`);
            handleDownloadSong(songToDownload.id);
            
            i++;
            setTimeout(downloadNext, 200); // 200ms delay between requests
        }

        downloadNext();
    }, [handleDownloadSong, downloadProgress]);

    const handleCheckForUpdates = () => {
        if (window.electronAPI) {
            window.electronAPI.checkForUpdates();
        }
    };

    useEffect(() => {
        return () => {
            websocketRef.current?.close();
        };
    }, []);
    
    const currentSong = currentSongIndex !== -1 ? queue[currentSongIndex] : null;

    useEffect(() => {
        const resetColor = () => {
            if (footerRef.current) {
                footerRef.current.style.removeProperty('--player-bg-color');
                footerRef.current.style.removeProperty('--player-text-color');
                footerRef.current.style.removeProperty('--player-text-secondary-color');
            }
        };

        const applyColor = async () => {
            if (footerRef.current && currentSong && currentSong.albumArt && window.FastAverageColor) {
                try {
                    const fac = new window.FastAverageColor();
                    const color = await fac.getColorAsync(currentSong.albumArt);
                    footerRef.current.style.setProperty('--player-bg-color', color.rgba);
                    footerRef.current.style.setProperty('--player-text-color', color.isDark ? '#FFF' : '#1F2937');
                    footerRef.current.style.setProperty('--player-text-secondary-color', color.isDark ? '#D1D5DB' : '#4B5563');
                } catch (e) {
                    console.error("Error getting album art color:", e);
                    resetColor();
                }
            } else {
                resetColor();
            }
        };

        applyColor();

    }, [currentSong]);

    return (
        <div className="h-screen w-screen flex flex-col font-sans overflow-hidden" style={{ minHeight: '480px', backgroundColor: 'var(--custom-color-bg-primary)', color: 'var(--custom-color-text-primary)' }}>
            <main className="relative flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="w-full lg:w-1/3 flex flex-col border-r border-gray-800 overflow-hidden min-w-0" style={{ backgroundColor: 'var(--custom-color-bg-primary)' }}>
                    <LibraryTabs 
                        library={library}
                        onSongsAdded={handleSongsAdded}
                        playlists={playlists}
                        addToQueue={addToQueue}
                        loadPlaylist={loadPlaylist}
                        deletePlaylist={deletePlaylist}
                        updatePlaylistName={updatePlaylistName}
                        onOpenSettings={() => setIsSettingsModalOpen(true)}
                        onUpdateSong={handleUpdateSongMetadata}
                        onRemoveSong={handleRemoveSongFromLibrary}
                        onDownloadSong={handleDownloadSong}
                        downloadProgress={downloadProgress}
                    />
                    <NetworkPanel
                        isCollapsed={isNetworkPanelCollapsed}
                        onToggleCollapse={() => setIsNetworkPanelCollapsed(prev => !prev)}
                        status={networkStatus}
                        isHost={isHost}
                        roomCode={roomCode}
                        onHost={handleHost}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onShareQueue={handleShareQueue}
                        onSharePlaylist={handleSharePlaylist}
                        onSyncCommon={handleSyncCommon}
                        onCompareLibraries={handleCompareLibrariesButtonClick}
                        onDownloadAll={handleDownloadAllMissing}
                        playlists={playlists}
                    />
                </div>
                <div className="w-full lg:w-2/3 flex flex-col min-w-0" style={{ backgroundColor: 'var(--custom-color-bg-secondary-t-50)'}}>
                    <QueuePanel 
                        queue={queue}
                        currentSongId={currentSong?.id}
                        onSongSelect={playSong}
                        onRemove={removeFromQueue}
                        onReorder={reorderQueue}
                        onSavePlaylist={() => setIsSaveModalOpen(true)}
                        onClearQueue={clearQueue}
                        onAddSongById={addSongByIdToQueue}
                    />
                </div>
            </main>

            <footer 
                id="player-footer"
                ref={footerRef}
                className="w-full border-t border-gray-800 shadow-lg z-10"
                style={{ backgroundColor: 'var(--player-bg-color, var(--custom-color-bg-player))' }}
            >
                {isStatusBarVisible && <StatusBar status="Ready" />}
                <PlayerControls
                    isPlaying={isPlaying}
                    onPlayPause={() => handlePlayPause()}
                    onNext={() => handleNext()}
                    onPrev={() => handlePrev()}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleSeek}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    loop={loop}
                    onToggleLoop={handleToggleLoop}
                    shuffle={shuffle}
                    onToggleShuffle={handleToggleShuffle}
                    currentSong={currentSong}
                />
            </footer>
            
            <audio
                ref={audioRef}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={loop ? () => audioRef.current?.play() : handleNext}
                loop={loop}
            />

            {isSaveModalOpen && (
                <SavePlaylistModal
                    onSave={savePlaylist}
                    onClose={() => setIsSaveModalOpen(false)}
                />
            )}
            
            {isSettingsModalOpen && (
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    isStatusBarVisible={isStatusBarVisible}
                    onToggleStatusBar={() => setIsStatusBarVisible(prev => !prev)}
                    rememberQueue={rememberQueue}
                    onToggleRememberQueue={() => setRememberQueue(prev => !prev)}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                    customPalettes={customPalettes}
                    onSaveCustomPalette={saveCustomPalette}
                    onDeleteCustomPalette={deleteCustomPalette}
                    onUpdateCustomPalette={updateCustomPalette}
                    activeCustomColors={activeCustomColors}
                    onCustomColorChange={handleCustomColorChange}
                    uiScale={uiScale}
                    onUiScaleChange={setUiScale}
                    onCheckForUpdates={handleCheckForUpdates}
                    updateStatus={updateStatus}
                />
            )}

            {isComparisonModalOpen && (
                <ComparisonModal
                    isOpen={isComparisonModalOpen}
                    onClose={() => setIsComparisonModalOpen(false)}
                    comparisonData={comparisonData}
                />
            )}
        </div>
    );
};

export default App;

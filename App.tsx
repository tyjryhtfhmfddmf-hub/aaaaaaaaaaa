

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
    const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false);
    const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
    const [remoteLibrary, setRemoteLibrary] = useState<Song[]>([]);
    const [fileChunks, setFileChunks] = useState<Record<string, { chunks: any[], received: number, total: number }>>({});
    const [activeCustomColors, setActiveCustomColors] = useState<CustomPalette['colors']>({
        primary: '#4F46E5',
        accent: '#34D399',
        text: '#E5E7EB',
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

    useEffect(() => {
        libraryRef.current = library;
    }, [library]);

    const handleDataChannelMessage = useCallback((event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (message.type === 'songFileChunk') {
            const { songKey: chunkSongKey, chunk, chunkIndex, totalChunks } = message.payload;

            if (downloadTimers.current[chunkSongKey]) {
                clearTimeout(downloadTimers.current[chunkSongKey]);
            }

            setFileChunks(prev => {
                const newChunksState = { ...prev };
                if (newChunksState[chunkSongKey]?.received === newChunksState[chunkSongKey]?.total) {
                    return prev;
                }
                if (!newChunksState[chunkSongKey]) {
                    newChunksState[chunkSongKey] = { chunks: [], received: 0, total: totalChunks };
                }
                if (!newChunksState[chunkSongKey].chunks[chunkIndex]) {
                    newChunksState[chunkSongKey].chunks[chunkIndex] = chunk;
                    newChunksState[chunkSongKey].received++;
                }
                const currentDownload = newChunksState[chunkSongKey];
                if (currentDownload.received < currentDownload.total) {
                    downloadTimers.current[chunkSongKey] = window.setTimeout(() => {
                        const missingIndices: number[] = [];
                        for (let i = 0; i < currentDownload.total; i++) {
                            if (!currentDownload.chunks[i]) {
                                missingIndices.push(i);
                            }
                        }
                        if (missingIndices.length > 0) {
                            const dc = Object.values(dataChannels.current).find(d => d.readyState === 'open');
                            if (dc) {
                                 dc.send(JSON.stringify({
                                    type: 'requestMissingFileChunks',
                                    payload: { songKey: chunkSongKey, missingIndices }
                                }));
                            }
                        }
                    }, 5000);
                }
                return newChunksState;
            });
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
        };
        
        peerConnections.current[peerId] = pc;
        return pc;
    }, [handleDataChannelMessage]);

    const processDownloadedFile = useCallback(async (songKey: string, chunks: any[]) => {
        const receivedSong = library.find(s => getSongKey(s) === songKey);

        if (!receivedSong) {
            console.error(`Downloaded song with key "${songKey}" not found in the library.`);
            alert(`Error: Could not find song for downloaded file "${songKey}". The download cannot be completed.`);
            setFileChunks(prev => {
                const newState = { ...prev };
                delete newState[songKey];
                return newState;
            });
            return;
        }

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
        } finally {
            // Clean up the completed download from the state
            setFileChunks(prev => {
                const newState = { ...prev };
                delete newState[songKey];
                return newState;
            });
        }
    }, [library]);

    useEffect(() => {
        for (const songKey in fileChunks) {
            const download = fileChunks[songKey];
            // Ensure chunks array is not sparse and has all data before processing
            if (download && download.received === download.total && download.chunks.length === download.total) {
                processDownloadedFile(songKey, download.chunks);
            }
        }
    }, [fileChunks, processDownloadedFile]);

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
                    setIsPlaying(true);
                }
            }
        }
    }, [queue, currentSongIndex, handleDownloadSong]);

    useEffect(() => {
        const loadInitialData = async () => {
            const dbSongs = await getSongsFromDB();
            const processedSongs = await Promise.all(
                dbSongs.map(async (song) => ({
                    ...song,
                    albumArt: song.albumArt ? await blobToDataURL(song.albumArt) : undefined,
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

        const savedPalettes = localStorage.getItem('music_custom_palettes');
        if (savedPalettes) {
            const parsedPalettes = JSON.parse(savedPalettes);
            setCustomPalettes(parsedPalettes);
            if (savedTheme === 'custom') {
                const activePalette = parsedPalettes.find((p: CustomPalette) => p.id === localStorage.getItem('music_active_palette_id'));
                 if (activePalette) setActiveCustomColors(activePalette.colors);
            }
        }
    }, []);
    
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

    const saveQueueState = useCallback(() => {
        if (!rememberQueue) return;
        localStorage.setItem('music_queue', JSON.stringify(queue.map(s => s.id)));
        localStorage.setItem('music_queue_index', currentSongIndex.toString());
    }, [queue, currentSongIndex, rememberQueue]);
    
    const playSong = (index: number) => {
        setCurrentSongIndex(index);
    };

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            if (currentSongIndex === -1 && queue.length > 0) {
                playSong(0);
            } else {
                audioRef.current?.play().catch(e => console.error("Error resuming audio:", e));
                setIsPlaying(true);
            }
        }
    }, [isPlaying, currentSongIndex, queue, playSong]);

    const handleNext = useCallback(() => {
        if (queue.length === 0) return;
        const nextIndex = (currentSongIndex + 1) % queue.length;
        playSong(nextIndex);
    }, [currentSongIndex, queue, playSong]);

    const handlePrev = useCallback(() => {
        if (queue.length === 0) return;
        const prevIndex = (currentSongIndex - 1 + queue.length) % queue.length;
        playSong(prevIndex);
    }, [currentSongIndex, queue.length, playSong]);
    
    const handleSeek = (time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
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
    
    const toggleShuffle = () => {
      const newShuffleState = !shuffle;
      setShuffle(newShuffleState);
  
      if (newShuffleState) {
          originalQueueBeforeShuffle.current = [...queue];
          const currentSong = queue[currentSongIndex];
          const restOfQueue = queue.filter((_, i) => i !== currentSongIndex);
          for (let i = restOfQueue.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [restOfQueue[i], restOfQueue[j]] = [restOfQueue[j], restOfQueue[i]];
          }
          const newQueue = currentSong ? [currentSong, ...restOfQueue] : restOfQueue;
          setQueue(newQueue);
          setCurrentSongIndex(0);
      } else {
          const originalQueue = originalQueueBeforeShuffle.current;
          const currentSong = queue[currentSongIndex];
          setQueue(originalQueue);
          const newIndex = currentSong ? originalQueue.findIndex(s => s.id === currentSong.id) : 0;
          setCurrentSongIndex(newIndex);
      }
  };

    const addToQueue = (song: Song) => {
        if (!queue.some(s => s.id === song.id)) {
            setQueue(prev => [...prev, song]);
        } else {
            console.log(`"${song.title}" is already in the queue.`);
        }
    };

    const removeFromQueue = (songId: string) => {
        const songToRemove = queue.find(s => s.id === songId);
        if (!songToRemove) return;

        const removedIndex = queue.findIndex(s => s.id === songId);
        const newQueue = queue.filter(s => s.id !== songId);

        if (removedIndex === currentSongIndex) {
            if (isPlaying) {
                audioRef.current?.pause();
                setIsPlaying(false);
            }
             if (newQueue.length > 0) {
                const nextIndex = removedIndex % newQueue.length;
                playSong(nextIndex);
             } else {
                setCurrentSongIndex(-1);
                if (activeUrl) URL.revokeObjectURL(activeUrl);
                setActiveUrl(null);
                if(audioRef.current) audioRef.current.src = '';
             }
        } else if (removedIndex < currentSongIndex) {
            setCurrentSongIndex(prev => prev - 1);
        }

        setQueue(newQueue);
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
        setQueue(songsFromIds);
        if (songsFromIds.length > 0) {
            playSong(0);
        } else {
            setCurrentSongIndex(-1);
            setIsPlaying(false);
        }
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
    }, [activeUrl]);


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
                    case 'queueUpdate': {
                        const receivedQueueKeys = message.payload.queue as string[];
                        const newQueue = receivedQueueKeys
                            .map(key => library.find(song => getSongKey(song) === key))
                            .filter((s): s is Song => !!s);
                        setQueue(newQueue);
                        alert(`Queue has been updated by a user in room ${roomCode}.`);
                        break;
                    }
                    case 'libraryUpdate': {
                        const remoteLibraryUpdate = message.payload.library as Omit<Song, 'file'>[];
                        setRemoteLibrary(remoteLibraryUpdate.map(song => ({ ...song, isRemote: true })));
                        setLibrary(prevLibrary => {
                            const currentLibraryIds = new Set(prevLibrary.map(s => s.id));
                            const newSongs = remoteLibraryUpdate
                                .filter(remoteSong => !currentLibraryIds.has(remoteSong.id))
                                .map(remoteSong => ({
                                    ...remoteSong,
                                    isRemote: true,
                                }));
                            
                            if (newSongs.length > 0) {
                                console.log(`Merging ${newSongs.length} new songs from network.`);
                                return [...prevLibrary, ...newSongs];
                            }
                            return prevLibrary;
                        });
                        break;
                    }
                    case 'requestLibraryShare': {
                        shareFullLibrary();
                        break;
                    }
                    case 'playlistUpdate': {
                        const { playlist } = message.payload;
                        alert(`Playlist "${playlist.name}" has been shared by a user in room ${roomCode}.`);
                        // Further implementation would involve adding this playlist to the client's playlists state
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
                                        const arrayBuffer = e.target.result as ArrayBuffer;
                                        const chunkSize = 16384;
                                        const totalChunks = Math.ceil(arrayBuffer.byteLength / chunkSize);
                                        const chunks: ArrayBuffer[] = [];
                                        for (let i = 0; i < totalChunks; i++) {
                                            chunks.push(arrayBuffer.slice(i * chunkSize, (i + 1) * chunkSize));
                                        }
                                        setOutgoingFileChunks(prev => ({ ...prev, [songKey]: chunks }));
                                        let i = 0;
                                        function sendChunk() {
                                            if (i >= chunks.length) return;
                                            if (dc.readyState === 'open') {
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
                            }
                        } catch (error) {
                            console.error('Error handling requestSongFile and creating offer:', error);
                            alert(`Error creating download offer: ${error}`);
                        }
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
                    case 'playCommand': {
                        if (!isPlaying) {
                            handlePlayPause();
                        }
                        break;
                    }
                    case 'pauseCommand': {
                        if (isPlaying) {
                            handlePlayPause();
                        }
                        break;
                    }
                    default: {
                        console.warn('Unknown message type received:', message.type);
                    }
                }
            } catch (e) {
                console.error('Error parsing message from server:', e);
            }
        };

        ws.onclose = (event: CloseEvent) => {
            console.log(`WebSocket disconnected. Code: ${event.code}, Reason: '${event.reason || 'No reason provided'}'`);
            if (networkStatus !== 'error') {
                 setNetworkStatus('offline');
            }
            setIsHost(false);
            setRoomCode('');
            websocketRef.current = null;
            // Clean up peer connections
            Object.values(peerConnections.current).forEach(pc => pc.close());
            peerConnections.current = {};
            dataChannels.current = {};
        };

        ws.onerror = (error) => {
            console.error('WebSocket error event:', error);
            alert('Failed to connect to the network service. The service may be starting up. Please try again in a moment.');
            setNetworkStatus('error');
        };
    }, [library, networkStatus, roomCode, isPlaying, handlePlayPause, getPeerConnection]);

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
        // The onclose handler will do the rest of the cleanup
    }, []);

    const handleShareQueue = useCallback(() => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const queueKeys = queue.map(getSongKey);
            console.log('Sharing queue with keys:', queueKeys);
            websocketRef.current.send(JSON.stringify({
                type: 'shareQueue',
                payload: { queue: queueKeys }
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
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: 'syncCommon' }));
            alert('Request to sync common songs has been sent.');
        } else {
            alert('Not connected to a session.');
        }
    }, []);

    const handleCompareLibrariesButtonClick = useCallback(() => {
        if (remoteLibrary.length > 0) {
            handleCompareLibraries(remoteLibrary);
        } else {
            alert('No remote library received yet. Wait for a user to connect.');
        }
    }, [remoteLibrary, handleCompareLibraries]);

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
        <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-200 font-sans overflow-hidden" style={{ minHeight: '480px' }}>
            <main className="relative flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className="w-full lg:w-1/3 flex flex-col border-r border-gray-800 bg-gray-900 overflow-hidden min-w-0">
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
                        fileChunks={fileChunks}
                    />
                    <NetworkPanel
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
                        playlists={playlists}
                    />
                </div>
                <div className="w-full lg:w-2/3 flex flex-col bg-gray-800/50 min-w-0">
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
                className="w-full bg-gray-900 border-t border-gray-800 shadow-lg z-10"
                style={{ backgroundColor: 'var(--player-bg-color)' }}
            >
                {isStatusBarVisible && <StatusBar status="Ready" />}
                <PlayerControls
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleSeek}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    loop={loop}
                    onToggleLoop={() => setLoop(!loop)}
                    shuffle={shuffle}
                    onToggleShuffle={toggleShuffle}
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
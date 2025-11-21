import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Song, ComparisonData } from '../types';
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getSongKey = (song: Song): string => {
  const title = song.title || 'Unknown Title';
  const artist = song.artist || 'Unknown Artist';
  return `${title.trim()}-${artist.trim()}`.toLowerCase();
};

export const compareLibraries = (
    localUser: string,
    remoteUser: string,
    localLibrary: Song[],
    remoteLibrary: Song[]
): ComparisonData => {
    const localSongMap = new Map(localLibrary.map(song => [getSongKey(song), song]));
    const remoteSongMap = new Map(remoteLibrary.map(song => [getSongKey(song), song]));

    const localKeys = new Set(localSongMap.keys());
    const remoteKeys = new Set(remoteSongMap.keys());

    const commonKeys = [...localKeys].filter(key => remoteKeys.has(key));
    const localOnlyKeys = [...localKeys].filter(key => !remoteKeys.has(key));
    const remoteOnlyKeys = [...remoteKeys].filter(key => !localKeys.has(key));

    const totalLocalSongs = localKeys.size;
    const totalRemoteSongs = remoteKeys.size;
    
    const localPercentage = totalLocalSongs > 0 ? Math.round((commonKeys.length / totalLocalSongs) * 100) : 0;
    const remotePercentage = totalRemoteSongs > 0 ? Math.round((commonKeys.length / totalRemoteSongs) * 100) : 0;

    const getSongFromKey = (key: string) => {
        return localSongMap.get(key) || remoteSongMap.get(key) as Song;
    };

    return {
        localUser,
        remoteUser,
        commonSongs: commonKeys.map(getSongFromKey),
        localOnlySongs: localOnlyKeys.map(getSongFromKey),
        remoteOnlySongs: remoteOnlyKeys.map(getSongFromKey),
        localPercentage,
        remotePercentage,
    };
};

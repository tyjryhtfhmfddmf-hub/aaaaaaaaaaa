
import type { Song } from '../types';

export const compareLibraries = (localUser: string, remoteUser: string, localLibrary: Song[], remoteLibrary: Song[]) => {
    const localSongIds = new Set(localLibrary.map(song => song.id));
    const remoteSongIds = new Set(remoteLibrary.map(song => song.id));

    const commonSongs = localLibrary.filter(song => remoteSongIds.has(song.id));
    const localOnlySongs = localLibrary.filter(song => !remoteSongIds.has(song.id));
    const remoteOnlySongs = remoteLibrary.filter(song => !localSongIds.has(song.id));

    const localPercentage = localLibrary.length > 0 ? (commonSongs.length / localLibrary.length) * 100 : 0;
    const remotePercentage = remoteLibrary.length > 0 ? (commonSongs.length / remoteLibrary.length) * 100 : 0;

    return {
        localUser,
        remoteUser,
        commonSongs,
        localOnlySongs,
        remoteOnlySongs,
        localPercentage: Math.round(localPercentage),
        remotePercentage: Math.round(remotePercentage),
    };
};

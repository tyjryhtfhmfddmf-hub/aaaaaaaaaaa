export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file?: File | { name: string; size: number };
  albumArt?: string;
  isRemote?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}

export interface CustomPalette {
  id: string;
  name: string;
  colors: {
    primary: string;
    accent: string;
    text: string;
  };
}

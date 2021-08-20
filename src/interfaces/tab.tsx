import { OpenGraphInfo } from '../utils/tab-view';

export interface TabPageTab {
  id: number;

  lastAccessTime: number;

  url: string;

  title: string;

  image: string;

  favicon: string;

  openGraphInfo: OpenGraphInfo | null;
}

export interface ITab {
  tab: TabPageTab;
  hover: boolean;
  selected: boolean;
  callback?: () => void;
}

export interface TabPageColumn {
  domain: string;

  tabs: TabPageTab[];
}

import { makeAutoObservable } from 'mobx';
import { ipcRenderer } from 'electron';
import TabObject from '../interfaces/tab';

export default class TabStore {
  static id = 0;

  tabs: TabObject[] = [];

  activeTabId = -1;

  constructor() {
    makeAutoObservable(this);

    ipcRenderer.on('new-tab-created', (_, id) => {
      this.pushTab('', id);
    });

    ipcRenderer.on('tab-removed', (_, id) => {
      this.popTab(id);
    });
  }

  setActiveTab(id: number) {
    const oldId = this.activeTabId;
    this.activeTabId = id;
    ipcRenderer.send('set-tab', [id, oldId]);
  }

  pushTab(url: string, id: number) {
    this.tabs.push({
      id,
      url,
      searchBar: '',
    });
  }

  popTab(id: number) {
    this.tabs = this.tabs.filter((tab) => tab.id !== id);
  }

  addTab() {
    ipcRenderer.send('create-new-tab', TabStore.id);
    this.setActiveTab(TabStore.id);
    TabStore.id += 1;
  }

  removeTab(id: number) {
    ipcRenderer.send('remove-tab', id);
    if (this.activeTabId === id) {
      this.setActiveTab(-1);
    }
  }

  getActiveTabSearchBar(): string {
    for (let i = 0; i < this.tabs.length; i += 1) {
      if (this.tabs[i].id === this.activeTabId) {
        return this.tabs[i].searchBar;
      }
    }
    return '';
  }

  setActiveTabSearchBar(text: string) {
    for (let i = 0; i < this.tabs.length; i += 1) {
      if (this.tabs[i].id === this.activeTabId) {
        this.tabs[i].searchBar = text;
      }
    }
  }

  setActiveTabUrl(text: string) {
    for (let i = 0; i < this.tabs.length; i += 1) {
      if (this.tabs[i].id === this.activeTabId) {
        this.tabs[i].url = text;
      }
    }
  }
}

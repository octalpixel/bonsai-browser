import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { ipcRenderer } from 'electron';
import '../tabPage.css';
import { useStore } from '../store/tab-page-store';
import {
  ClearHistory,
  History,
  HistoryButton,
  HistoryHeader,
  HistoryModal,
  HistoryModalBackground,
  HistoryModalParent,
  HistoryResults,
  HistorySearch,
} from '../components/History';
import { URLBox, URLBoxParent } from '../components/TabPageHeader';
import {
  Background,
  Footer,
  TabColumns,
  TabColumnsParent,
  Tab,
  FooterButton,
} from '../components/TabPageContent';
import Workspace from '../components/Workspace';

const HistoryModalLocal = observer(() => {
  const { tabPageStore } = useStore();

  const historyBoxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (historyBoxRef.current !== null) {
      tabPageStore.historyInput = historyBoxRef.current;
    }
  }, [historyBoxRef.current]);

  useEffect(() => {
    ipcRenderer.send(
      'history-modal-active-update',
      tabPageStore.historyModalActive
    );
    if (tabPageStore.historyModalActive) {
      ipcRenderer.send('history-search', tabPageStore.historyText);
    }
  }, [tabPageStore.historyModalActive, tabPageStore.historyText]);

  return (
    <HistoryModalParent active={tabPageStore.historyModalActive}>
      <HistoryModalBackground
        onClick={() => {
          runInAction(() => {
            tabPageStore.historyModalActive = false;
          });
        }}
      />
      <HistoryModal>
        <HistoryHeader>
          <HistorySearch
            ref={historyBoxRef}
            placeholder="search history"
            value={tabPageStore.historyText}
            onInput={(e) => {
              tabPageStore.setHistoryText(e.currentTarget.value);
            }}
          />
          <ClearHistory
            type="button"
            onClick={() => {
              ipcRenderer.send('clear-history');
            }}
          >
            Clear History
          </ClearHistory>
        </HistoryHeader>
        <HistoryResults>
          <History />
        </HistoryResults>
      </HistoryModal>
    </HistoryModalParent>
  );
});

const FuzzyTabs = observer(() => {
  const { tabPageStore } = useStore();
  return (
    <div style={{ color: 'white', flexGrow: 1 }}>
      <h1>Today</h1>
      {tabPageStore.filteredTabs.map((result) => {
        const { item } = result;
        return <Tab key={item.id} tab={item} hover />;
      })}
    </div>
  );
});

const MainContent = observer(() => {
  const { tabPageStore } = useStore();
  const tabs =
    tabPageStore.urlText.length === 0 ? (
      <TabColumnsParent>
        <TabColumns />
      </TabColumnsParent>
    ) : (
      <FuzzyTabs />
    );

  const workspace = <Workspace />;

  return tabPageStore.workspaceActive ? workspace : tabs;
});

const Tabs = observer(() => {
  const { tabPageStore } = useStore();
  const urlBoxRef = useRef<HTMLInputElement>(null);
  const [urlFocus, setUrlFocus] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      runInAction(() => {
        switch (e.key) {
          case 'Enter':
            break;
          case 'Escape':
            if (tabPageStore.historyModalActive) {
              tabPageStore.setHistoryActive(false);
            } else if (tabPageStore.workspaceActive) {
              tabPageStore.workspaceActive = false;
            } else if (tabPageStore.urlText.length > 0) {
              tabPageStore.setUrlText('');
            } else {
              ipcRenderer.send('toggle');
            }
            break;
          case 'Tab':
            tabPageStore.workspaceActive = !tabPageStore.workspaceActive;
            break;
          default:
            tabPageStore.setFocus();
            break;
        }
      });
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [hasRunOnce, setHasRunOnce] = useState(false);

  useEffect(() => {
    if (hasRunOnce) {
      return;
    }
    setHasRunOnce(true);
    ipcRenderer.on('focus-search', () => {
      tabPageStore.setFocus();
      tabPageStore.selectText();
    });
  }, [hasRunOnce]);

  useEffect(() => {
    if (urlBoxRef.current !== null) {
      tabPageStore.urlInput = urlBoxRef.current;
    }
  }, [urlBoxRef.current]);

  return (
    <>
      <Background>
        <URLBoxParent>
          <URLBox
            type="text"
            spellCheck={false}
            ref={urlBoxRef}
            placeholder="Search Google or type a URL"
            value={tabPageStore.urlText}
            onInput={(e) => {
              tabPageStore.setUrlText(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.code === 'Enter') {
                ipcRenderer.send('search-url', tabPageStore.urlText);
                tabPageStore.setUrlText('');
              }
            }}
            onClick={() => {
              if (urlBoxRef.current != null && !urlFocus) {
                setUrlFocus(true);
                urlBoxRef.current.select();
              }
            }}
            onBlur={() => {
              setUrlFocus(false);
              if (urlBoxRef.current != null) {
                urlBoxRef.current.blur();
                window.getSelection()?.removeAllRanges();
              }
            }}
          />
        </URLBoxParent>
        <MainContent />
        <Footer>
          <FooterButton
            onClick={() => {
              runInAction(() => {
                tabPageStore.workspaceActive = !tabPageStore.workspaceActive;
              });
            }}
          >
            Workspace
          </FooterButton>
          <HistoryButton
            type="button"
            onClick={() => {
              runInAction(() => {
                tabPageStore.setHistoryActive(true);
              });
            }}
          >
            History
          </HistoryButton>
        </Footer>
      </Background>
      <HistoryModalLocal />
    </>
  );
});

export default Tabs;

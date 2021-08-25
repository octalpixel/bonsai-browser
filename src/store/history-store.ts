import { getSnapshot, IAnyModelType, Instance, types } from 'mobx-state-tree';
import { ipcRenderer } from 'electron';
import { v4 as uuidv4 } from 'uuid';

const DEBUG = true;

function log(str: string) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(str);
  }
}

export const HistoryData = types.model({
  url: types.string,
  scroll: 0,
  date: types.string,
});

export type IHistoryData = Instance<typeof HistoryData>;

export const Node = types
  .model({
    id: types.identifier,
    data: HistoryData, // as an example
    parent: types.maybe(types.reference(types.late((): IAnyModelType => Node))),
    children: types.array(
      types.reference(types.late((): IAnyModelType => Node))
    ),
  })
  .actions((self) => ({
    setParent(a: Instance<typeof self> | null) {
      self.parent = a;
    },
    setData(a: IHistoryData) {
      self.data = a;
    },
    addChild(a: Instance<typeof self>) {
      self.children.push(a);
    },
    removeChild(a: Instance<typeof self>): boolean {
      return self.children.remove(a);
    },
  }));

export type INode = Instance<typeof Node>;

export const HistoryStore = types
  .model({
    nodes: types.map(Node), // Node Id => Node
    heads: types.map(types.reference(Node)), // WebView Id => Node
    active: types.string, // WebView Id
    roots: types.array(types.reference(Node)),
  })
  .actions((self) => ({
    setNode(node: INode) {
      self.nodes.set(node.id, node);
    },
    setHead(webViewId: string, node: INode) {
      log(`${webViewId} set head ${node.data.url}`);
      self.heads.set(webViewId, node);
    },
    removeHead(webViewId: string): boolean {
      return self.heads.delete(webViewId);
    },
    linkChild(parent: INode, child: INode) {
      log(`link (${parent.data.url}) to (${child.data.url})`);
      parent.addChild(child);
      child.setParent(parent);
    },
    removeNode(a: INode) {
      a.parent?.removeChild(a);
      a.children.forEach((child: INode) => {
        child.setParent(null);
      });
      self.nodes.delete(a.id);
    },
    setActive(webViewId: string) {
      log(`swap active webView from (${self.active}) to (${webViewId})`);
      self.active = webViewId;
    },
    addRoot(a: INode) {
      self.roots.push(a);
    },
  }));

export type IHistory = Instance<typeof HistoryStore>;

export function headsOnNode(root: IHistory, node: INode): [string, INode][] {
  const entries = Array.from(root.heads.entries());
  return entries.filter(([_, head]) => head.id === node.id);
}

function childLeaves(a: INode) {
  return a.children.filter((x) => x.children.length === 0);
}

function childParents(a: INode) {
  return a.children.filter((x) => x.children.length > 0);
}

function registerLeavesRecursive(a: INode, register: (arg: INode) => void) {
  childLeaves(a).forEach((child) => register(child));
  childParents(a).forEach((child) => registerLeavesRecursive(child, register));
}

export function allDescendentLeaves(a: INode): INode[] {
  const acc: INode[] = [];
  const register = (aLeaf: INode) => {
    acc.push(aLeaf);
  };
  registerLeavesRecursive(a, register);
  return acc;
}

function getDate(): string {
  return (Date.now() / 1000).toString();
}

function genNode(url: string) {
  const data = HistoryData.create({ url, scroll: 0, date: getDate() });
  return Node.create({ id: uuidv4(), data });
}

function headKeyWhereNode(
  history: IHistory,
  destinationNode: INode
): number | undefined {
  const match: number[] = [];
  history.heads.forEach((node, key) => {
    if (node.id === destinationNode.id) {
      match.push(parseInt(key, 10));
    }
  });
  if (match.length > 0) {
    return match[0];
  }
  return undefined;
}

function setTab(webViewId: number) {
  // log(`swap active head from ${history.active} to ${webViewId}`);
  ipcRenderer.send('set-tab', webViewId);
}

export function goBack(history: IHistory, node: INode) {
  log('=== go back ===');
  const key = headKeyWhereNode(history, node);
  if (key) {
    setTab(key);
  } else {
    log('dispatch go back to main');
    ipcRenderer.send('go-back', {
      senderId: history.active,
      backTo: getSnapshot(node),
    });
  }
}

export function goForward(history: IHistory, destinationNode: INode) {
  log('=== go forward ===');
  const key = headKeyWhereNode(history, destinationNode);
  if (key) {
    setTab(key);
  } else {
    log(`${history.active} dispatch go forward to ${destinationNode.id}`);
    ipcRenderer.send('go-forward', {
      senderId: history.active,
      forwardTo: getSnapshot(destinationNode),
    });
  }
}

function parentIsUrl(oldNode: INode | undefined, url: string) {
  return oldNode && oldNode.parent && oldNode.parent.data.url === url;
}

export function hookListeners(h: Instance<typeof HistoryStore>) {
  ipcRenderer.on('new-window', (_, data) => {
    const { senderId, receiverId, details } = data;
    const receiverNode = genNode(details.url);
    log('=== new window ===');
    log(`${senderId} spawn ${receiverId}`);
    h.setNode(receiverNode);
    const senderNode = h.heads.get(senderId);
    if (senderNode) {
      h.linkChild(senderNode, receiverNode);
    }
    h.setHead(receiverId, receiverNode);
  });
  ipcRenderer.on('did-navigate', (_, { id, url }) => {
    log(`${id} did navigate ${url}`);
    const rootNode = h.heads.get(id);
    if (!rootNode) {
      log(`${id} did create root for ${url}`);
      const node = genNode(url);
      h.setNode(node);
      h.setHead(id, node);
      h.addRoot(node);
    }
  });
  ipcRenderer.on('tab-was-set', (_, id) => {
    h.setActive(id.toString());
  });
  ipcRenderer.on('will-navigate', (_, { id, url }) => {
    log('=== will-navigate ===');
    log(`${id} will navigate ${url}`);
    const oldNode = h.heads.get(id);
    if (!(oldNode && oldNode.data.url === url)) {
      if (parentIsUrl(oldNode, url)) {
        log('nav to parent');
        h.setHead(id, oldNode?.parent);
      } else {
        log(`${id} did create node for ${url}`);
        const node = genNode(url);
        h.setNode(node);
        if (oldNode) {
          h.linkChild(oldNode, node);
        }
        h.setHead(id, node);
      }
    }
  });
  ipcRenderer.on('will-navigate-no-gesture', (_, { id, url }) => {
    log(`${id} will-navigate-no-gesture ${url}`);
    const node = h.heads.get(id);
    if (node) {
      const data = HistoryData.create({ url, scroll: 0, date: getDate() });
      node.setData(data);
    } else {
      log('FAIL');
    }
  });
  ipcRenderer.on('go-back', (_, { id }) => {
    log(`${id} did go back`);
    const oldNode = h.heads.get(id);
    if (oldNode && oldNode.parent) {
      h.setHead(id, oldNode.parent);
    }
  });
  ipcRenderer.on('go-forward', (_, { id, url }) => {
    log(`${id} did go forward to ${url}`);
    const oldNode = h.heads.get(id);
    if (oldNode) {
      const forwards = oldNode.children.filter(
        (child) => child.data.url === url
      );
      if (forwards.length > 0) {
        h.setHead(id, forwards[0]);
      }
    }
  });
  ipcRenderer.on('tab-removed', (_, id) => {
    log(`try remove head ${id}`);
    if (h.removeHead(id)) {
      log(`removed head ${id}`);
    }
  });
}

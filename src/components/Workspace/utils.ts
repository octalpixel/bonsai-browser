import { Instance } from 'mobx-state-tree';
import BezierEasing from 'bezier-easing';
import {
  InboxColumnWidth,
  Item as MobxItem,
  ItemGroup,
  itemHeight,
  itemWidth,
  WorkspaceStore,
} from '../../store/workspace-store';

export function overTrash(
  testPos: number[],
  workspaceStore: Instance<typeof WorkspaceStore>
): boolean {
  return (
    testPos[0] >= InboxColumnWidth &&
    testPos[0] <= InboxColumnWidth + 100 &&
    testPos[1] >= workspaceStore.height - 100 &&
    testPos[1] <= workspaceStore.height
  );
}

export function getGroupBelowItem(
  item: Instance<typeof MobxItem>,
  currentGroup: Instance<typeof ItemGroup>,
  containerPos: number[],
  mousePos: number[],
  workspaceStore: Instance<typeof WorkspaceStore>
): Instance<typeof ItemGroup> | null {
  let testPos;
  let overGroup;
  if (workspaceStore.inGroup(mousePos, workspaceStore.inboxGroup)) {
    testPos = mousePos;
    overGroup = workspaceStore.inboxGroup;
  } else {
    testPos = [
      containerPos[0] + (itemWidth / 2) * workspaceStore.scale,
      containerPos[1] + (itemHeight / 2) * workspaceStore.scale,
    ];
    overGroup = workspaceStore.getGroupAtPoint(testPos);
  }

  if (overGroup === null && currentGroup.id !== 'hidden') {
    workspaceStore.changeGroup(item, currentGroup, workspaceStore.hiddenGroup);
  }
  if (overGroup !== null) {
    if (overGroup.id !== currentGroup.id) {
      workspaceStore.changeGroup(item, currentGroup, overGroup);
      workspaceStore.moveToFront(overGroup);
    }
    workspaceStore.arrangeInGroup(item, testPos, overGroup);
  }

  return overGroup;
}

export const easeOut = BezierEasing(0, 0, 0.5, 1);

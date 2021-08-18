import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { Instance } from 'mobx-state-tree';
import React, { useEffect, useRef } from 'react';
import { runInAction } from 'mobx';
import { DraggableCore, DraggableData } from 'react-draggable';
import {
  groupPadding,
  groupTitleHeight,
  ItemGroup,
  widthPixelsToInt,
} from '../../store/workspace-store';
import { useStore } from '../../store/tab-page-store';
import { easeOut, overTrash } from './utils';
import { lerp } from '../../utils/utils';

const Group = styled.div`
  background-color: rgb(255, 170, 166);
  border-radius: 20px;
  color: rgb(250, 250, 250);
  position: absolute;
  border: 2px solid black;
`;
const GroupResize = styled.div`
  width: 20px;
  height: 100%;
  position: absolute;
  top: 0;
  right: -10px;

  :hover {
    cursor: col-resize;
  }
`;
const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  overflow: hidden;
  position: relative;
  outline: none;
`;
const HeaderText = styled.div`
  position: absolute;
  top: -2px;
  left: 0;
  width: 100%;
  padding-left: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 2rem;
  font-weight: bold;
  color: rgb(250, 250, 250);
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
`;
const HeaderInput = styled.input`
  position: absolute;
  top: -4px;
  left: 0;
  width: 100%;
  padding-left: 12px;
  font-size: 2rem;
  font-weight: bold;
  outline: none;
  border: none;
  background: none;
  color: rgb(250, 250, 250);
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
`;
const MainGroup = observer(
  ({ group }: { group: Instance<typeof ItemGroup> }) => {
    const { tabPageStore, workspaceStore } = useStore();

    const targetGroupSize = group.size();
    const lerpValue = easeOut(group.animationLerp);

    const groupTitleBoxRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (tabPageStore.editingGroupId === group.id) {
        setTimeout(() => {
          groupTitleBoxRef.current?.select();
        }, 10);
      }
    }, [tabPageStore.editingGroupId, group.id]);

    useEffect(() => {
      if (group.shouldEditTitle) {
        group.setShouldEditTitle(false);
        runInAction(() => {
          tabPageStore.activeGroupBoxRef = groupTitleBoxRef;
          tabPageStore.editingGroupId = group.id;
        });
        if (groupTitleBoxRef.current !== null) {
          groupTitleBoxRef.current.value = group.title;
        }
      }
    }, [group, group.shouldEditTitle, tabPageStore]);

    return (
      <DraggableCore
        onStart={(_, data) => {
          workspaceStore.moveToFront(group);
          group.setDragMouseStart(data.x, data.y);

          if (data.x > group.x + group.size()[0] - 10) {
            group.setTempResizeWidth(group.width);
            group.setResizing(true);
          } else if (data.y > group.y + groupTitleHeight + groupPadding + 1) {
            group.setBeingDragged(true);
            workspaceStore.setAnyDragging(true);
          }
        }}
        onDrag={(_, data: DraggableData) => {
          if (group.resizing) {
            group.setTempResizeWidth(widthPixelsToInt(data.x - group.x));
            workspaceStore.setGroupWidth(
              Math.floor(group.tempResizeWidth),
              group
            );
          } else {
            if (
              !group.beingDragged &&
              tabPageStore.editingGroupId !== group.id
            ) {
              const xDif = data.x - group.dragMouseStartX;
              const yDif = data.y - group.dragMouseStartY;
              const distSquared = xDif * xDif + yDif * yDif;
              if (distSquared > 5 * 5) {
                group.setBeingDragged(true);
                workspaceStore.setAnyDragging(true);
              }
            }

            if (group.beingDragged) {
              group.setOverTrash(overTrash([data.x, data.y], workspaceStore));
              workspaceStore.setAnyOverTrash(group.overTrash);
              group.move(data.deltaX, data.deltaY);
            }
          }
        }}
        onStop={(_, data) => {
          if (
            !group.beingDragged &&
            !group.resizing &&
            tabPageStore.editingGroupId !== group.id
          ) {
            runInAction(() => {
              tabPageStore.activeGroupBoxRef = groupTitleBoxRef;
              tabPageStore.editingGroupId = group.id;
            });
            if (groupTitleBoxRef.current !== null) {
              groupTitleBoxRef.current.value = group.title;
            }
          }

          if (group.resizing) {
            const roundFunc = group.height() === 1 ? Math.round : Math.floor;
            group.setTempResizeWidth(widthPixelsToInt(data.x - group.x));
            workspaceStore.setGroupWidth(
              roundFunc(group.tempResizeWidth),
              group,
              true
            );
            group.setResizing(false);
          }

          if (group.overTrash) {
            workspaceStore.deleteGroup(group);
            workspaceStore.setAnyDragging(false);
            workspaceStore.setAnyOverTrash(false);
            return;
          }

          group.setBeingDragged(false);
          group.setOverTrash(false);
          workspaceStore.setAnyDragging(false);
          workspaceStore.setAnyOverTrash(false);
        }}
      >
        <Group
          style={{
            width: lerp(
              group.animationStartWidth,
              targetGroupSize[0],
              lerpValue
            ),
            height: lerp(
              group.animationStartHeight,
              targetGroupSize[1],
              lerpValue
            ),
            left: group.x,
            top: group.y,
            zIndex: group.zIndex,
            display: group.id === 'hidden' ? 'none' : 'block',
            cursor: group.beingDragged ? 'grabbing' : 'auto',
          }}
          onMouseOver={() => {
            group.setHovering(true);
          }}
          onMouseLeave={() => {
            group.setHovering(false);
          }}
        >
          <GroupHeader
            style={{
              height: groupTitleHeight + groupPadding,
              cursor: group.beingDragged ? 'grabbing' : 'pointer',
            }}
          >
            <HeaderText
              style={{
                display:
                  tabPageStore.editingGroupId === group.id ? 'none' : 'block',
              }}
            >
              {group.title}
            </HeaderText>
            <HeaderInput
              ref={groupTitleBoxRef}
              type="text"
              spellCheck="false"
              style={{
                display:
                  tabPageStore.editingGroupId === group.id ? 'block' : 'none',
                height: groupTitleHeight + groupPadding,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  e.preventDefault();
                  if (groupTitleBoxRef.current !== null) {
                    groupTitleBoxRef.current.blur();
                  }
                }
              }}
              onBlur={(e) => {
                runInAction(() => {
                  tabPageStore.activeGroupBoxRef = null;
                  tabPageStore.editingGroupId = '';
                });
                if (e.currentTarget.value !== '') {
                  group.setTitle(e.currentTarget.value);
                }
              }}
            />
          </GroupHeader>
          <GroupResize />
        </Group>
      </DraggableCore>
    );
  }
);

export default MainGroup;

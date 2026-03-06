import React, { useCallback, useRef, useState } from 'react';
import styled from 'styled-components';

const FlexContentArea = styled.div`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  overflow: hidden;

  @media screen and (orientation: portrait) {
    padding-bottom: 48px;
  }
`;

const MainPane = styled.div`
  position: relative;
  flex-grow: 1;

  @media screen and (orientation: portrait) {
    display: ${(props) => (props.$mobileVisible ? 'block' : 'none')};
  }
`;

const DragHandle = styled.div`
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 10;

  &:hover,
  &.dragging {
    background: rgba(255, 255, 255, 0.15);
  }

  @media screen and (orientation: portrait) {
    display: none;
  }
`;

const SidebarPane = styled.div`
  display: flex;
  flex-direction: column;
  width: ${(props) => props.$width}px;
  min-width: 180px;
  max-width: 600px;
  overflow: hidden;
  flex-shrink: 0;

  @media screen and (orientation: portrait) {
    width: 100%;
    display: ${(props) => (props.$mobileVisible ? 'flex' : 'none')};
  }
`;

const MobileBottomMenu = styled.div`
  display: none;

  @media screen and (orientation: portrait) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #111;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    z-index: 100;
  }
`;

const MobileMenuButton = styled.button`
  flex: 1;
  padding: 12px;
  background: ${(props) =>
    props.$active ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
  border: none;
  color: white;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: rgba(255, 255, 255, 0.15);
  }

  ${(props) => props.$active && 'border-top: 2px solid white;'}
`;

function ResizableSplitView({
  main,
  sidebar,
  defaultSidebarWidth = 320,
  mainLabel = 'หน้าหลัก',
  sidebarLabel = 'รายละเอียด',
  minSidebarWidth = 180,
  maxSidebarWidth = 600,
}) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  const [mobileView, setMobileView] = useState('main');
  const dragHandleRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onDragMouseDown = useCallback(
    (e) => {
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = sidebarWidth;
      dragHandleRef.current?.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        if (!isDragging.current) return;
        const delta = dragStartX.current - moveEvent.clientX;
        const newWidth = Math.min(maxSidebarWidth, Math.max(minSidebarWidth, dragStartWidth.current + delta));
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        dragHandleRef.current?.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth],
  );

  return (
    <>
      <FlexContentArea>
        <MainPane $mobileVisible={mobileView === 'main'}>
          {main}
        </MainPane>
        <DragHandle ref={dragHandleRef} onMouseDown={onDragMouseDown} />
        <SidebarPane $mobileVisible={mobileView === 'sidebar'} $width={sidebarWidth}>
          {sidebar}
        </SidebarPane>
      </FlexContentArea>
      <MobileBottomMenu>
        <MobileMenuButton
          $active={mobileView === 'main'}
          onClick={() => setMobileView('main')}
        >
          {mainLabel}
        </MobileMenuButton>
        <MobileMenuButton
          $active={mobileView === 'sidebar'}
          onClick={() => setMobileView('sidebar')}
        >
          {sidebarLabel}
        </MobileMenuButton>
      </MobileBottomMenu>
    </>
  );
}

export default ResizableSplitView;

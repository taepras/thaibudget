import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const Toggle = styled.button`
  background: none;
  border: none;
  color: ${(props) => (props.isActive ? 'rgba(240, 220, 100, 1)' : 'inherit')};
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  // font-style: italic;
  transition: color 0.2s;
  text-decoration: underline;
  text-align: left;

  &:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  &::after {
    content: '▼';
    display: inline-block;
    // text-decoration: underline;
    margin-left: 4px;
    font-size: 0.75rem;
    font-weight: normal;
  }
`;

const Menu = styled.div`
  position: fixed;
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  padding: 8px 0;
  z-index: 9999;
  min-width: 180px;
  max-width: min(480px, 90vw);
  max-height: 50vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;

const MenuItem = styled.button`
  background: none;
  border: none;
  color: ${(props) => (props.isActive ? '#00ac00' : 'rgba(255, 255, 255, 0.7)')};
  padding: 8px 16px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-size: 0.75rem;
  white-space: normal;
  word-break: break-word;
  transition: all 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #00ac00;
  }

  &::before {
    content: '${(props) => (props.isActive ? '✓ ' : '  ')}';
    margin-right: 4px;
  }
`;

const Container = styled.div`
  position: relative;
  display: inline-block;
`;

function DropdownLink({
  label,
  options,
  value,
  onChange,
  isActive = false,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (showMenu && toggleRef.current && menuRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      const menuH = menuRef.current.offsetHeight;
      const menuW = menuRef.current.offsetWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const MARGIN = 8;

      // Prefer opening below; flip above if not enough room
      let top = rect.bottom;
      if (top + menuH > vh - MARGIN) {
        top = Math.max(MARGIN, rect.top - menuH);
      }

      // Keep left edge inside viewport
      let left = rect.left;
      if (left + menuW > vw - MARGIN) {
        left = Math.max(MARGIN, vw - menuW - MARGIN);
      }

      setMenuPosition({ top, left });
    }
  }, [showMenu]);

  // Close on click outside
  useEffect(() => {
    if (!showMenu) return undefined;
    const handler = (e) => {
      if (toggleRef.current && !toggleRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const menu = showMenu && ReactDOM.createPortal(
    <Menu ref={menuRef} style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
      {options.map((option) => (
        <MenuItem
          key={option.value}
          isActive={value === option.value}
          onClick={() => {
            onChange(option.value);
            setShowMenu(false);
          }}
        >
          {option.label}
        </MenuItem>
      ))}
    </Menu>,
    document.body,
  );

  // If there's only one (or zero) options, nothing to choose — render static text
  if (options.length <= 1) {
    return (
      <span>{label}</span>
    );
  }

  return (
    <Container>
      <Toggle ref={toggleRef} isActive={isActive} onClick={() => setShowMenu(!showMenu)}>
        {label}
      </Toggle>
      {menu}
    </Container>
  );
}

export default DropdownLink;

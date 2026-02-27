import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const Toggle = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  font-style: italic;
  transition: color 0.2s;
  text-decoration: underline;

  &:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  &::after {
    content: ' v';
    display: inline-block;
    margin-left: 4px;
    font-size: 11px;
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
  font-size: 12px;
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
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (showMenu && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      // position: fixed uses viewport coords — no scrollY/scrollX needed
      setMenuPosition({
        top: rect.bottom,
        left: rect.left,
      });
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
      <span style={{ fontStyle: 'italic' }}>{label}</span>
    );
  }

  return (
    <Container>
      <Toggle ref={toggleRef} onClick={() => setShowMenu(!showMenu)}>
        {label}
      </Toggle>
      {menu}
    </Container>
  );
}

export default DropdownLink;

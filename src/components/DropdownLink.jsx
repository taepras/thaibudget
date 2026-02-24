import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

const Toggle = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  font-style: italic;
  transition: color 0.2s;
  text-decoration: underline;

  &:hover {
    color: rgba(255, 255, 255, 0.9);
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
  z-index: 1000;
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

  useEffect(() => {
    if (showMenu && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, [showMenu]);

  return (
    <Container>
      <Toggle ref={toggleRef} onClick={() => setShowMenu(!showMenu)}>
        {label}
      </Toggle>
      {showMenu && (
        <Menu style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
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
        </Menu>
      )}
    </Container>
  );
}

export default DropdownLink;

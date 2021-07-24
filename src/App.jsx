import React from 'react';
import styled from 'styled-components';
import logo from './logo.svg';
import './App.css';
import Treemap from './components/Treemap';

const FullView = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
`;

function App() {
  return (
    <FullView>
      <div style={{
        position: 'relative',
        flexGrow: 1,
      }}
      >
        <Treemap />
      </div>
      <div
        style={{
          padding: 16,
          paddingTop: 8,
          fontSize: 12,
          opacity: '0.7',
        }}
      >
        **Work-In-Progress by
        {' '}
        <a href="https://taepras.com" style={{ color: 'white' }}>Thanawit Prasongpongchai</a>
        , &shy;Data Source:
        {' '}
        <a href="https://docs.google.com/spreadsheets/d/1yyWXSTbq3CD_gNxks-krcSBzbszv3c_2Nq54lckoQ24/edit#gid=343539850" style={{ color: 'white' }}>กลุ่มก้าว Geek</a>

      </div>
    </FullView>
  );
}

export default App;

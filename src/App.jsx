import React, { useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import logo from './logo.svg';
import './App.css';
import Treemap from './components/Treemap';
import FullView from './components/FullView';

const TOP_BAR_HEIGHT = 60;

const hierarchyBy = [
  'MINISTRY',
  'BUDGETARY_UNIT',
  'BUDGET_PLAN',
  // 'OUPUT',
  // 'PROJECT',
  'OUTPUT_PROJECT',
  'CATEGORY_LV1',
  'CATEGORY_LV2',
  'CATEGORY_LV3',
  'CATEGORY_LV4',
  'CATEGORY_LV5',
  'CATEGORY_LV6',
  'ITEM_DESCRIPTION',
];

function App() {
  const [data, setData] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(['all']);

  useEffect(() => {
    d3.csv(`${process.env.PUBLIC_URL}/data.csv`).then((d) => {
      setLoading(false);
      setData(d);
    });
  }, []);

  const filterDataByQuery = (datum, query) => {
    const searchLevels = [
      'MINISTRY',
      'BUDGETARY_UNIT',
      // 'BUDGET_PLAN',
      // 'OUPUT',
      // 'PROJECT',
      // 'OUTPUT_PROJECT',
      // 'CATEGORY_LV1',
      // 'CATEGORY_LV2',
      // 'CATEGORY_LV3',
      // 'CATEGORY_LV4',
      // 'CATEGORY_LV5',
      // 'CATEGORY_LV6',
      // 'ITEM_DESCRIPTION',
    ];
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in searchLevels) {
      if (datum[searchLevels[i]].includes(query)) { return true; }
    }
    return false;
  };

  const preprocessedData = useMemo(() => data
    .map((d) => ({
      ...d,
      AMOUNT: parseFloat(d.AMOUNT.replace(/,/g, '')),
      OUTPUT_PROJECT: d.OUTPUT + d.PROJECT,
      MINISTRY: d.MINISTRY.replace(/\([0-9]+\)$/, '').trim(),
    }))
    .filter((d) => +d.FISCAL_YEAR === 2022)
    .filter((d) => filterDataByQuery(d, searchQuery)),
  [data, searchQuery]);

  const location = useLocation();
  const history = useHistory();

  useEffect(() => {
    const f = location.pathname.split('/').slice(2);
    console.log('f', f, f.length > 0 && f[0] ? f : ['all']);
    setFilters(f.length > 0 && f[0] ? f : ['all']);
  }, [location]);

  const navigateTo = (x, i) => {
    console.log(x, i);
    const temp = [...filters];
    temp.splice(i + 1);
    // setFilters(temp);
    console.log('temp', temp);
    history.push(`${process.env.PUBLIC_URL}/${temp.join('/')}`);
  };

  return (
    <FullView>
      <div style={{
        height: TOP_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        overflowX: 'auto',
      }}
      >
        <div style={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
        }}
        >
          {/* <button type="button" onClick={() => setDisplayMode('treemap')}>treemap</button>
        <button type="button" onClick={() => setDisplayMode('bar')}>bar</button> */}

          {filters.map((x, i) => (
            <>
              <button
                type="button"
                onClick={() => navigateTo(x, i)}
                style={{
                  marginRight: 4,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                }}
              >
                <span style={{ opacity: '0.4' }}>{i > 0 && hierarchyBy[i - 1]}</span>
                {i > 0 && <br />}
                <span style={{ textDecoration: i < filters.length - 1 ? 'underline' : 'none' }}>
                  {i === 0
                    ? (
                      searchQuery === ''
                        ? 'หน่วยงานทั้งหมด'
                        : `หน่วยงานทั้งหมดที่ชื่อมีคำว่า "${searchQuery}"`
                    )
                    : x}
                </span>
              </button>
              {i < filters.length - 1
                && <span style={{ color: 'white', marginRight: 4 }}>&gt;</span>}
            </>
          ))}
          {/* {JSON.stringify(filters)} */}
        </div>
        <div>
          <label>Filter: </label>
          <input value={searchQuery} onInput={(e) => setSearchQuery(e.target.value)} placeholder="หน่วยรับงบหรือกระทรวง" />
        </div>
      </div>
      <div style={{
        position: 'relative',
        flexGrow: 1,
      }}
      >
        <Treemap
          data={preprocessedData}
          isLoading={isLoading}
          filters={filters}
          hierarchyBy={hierarchyBy}
          setFilters={setFilters}
        />
      </div>
      <div
        style={{
          padding: 16,
          paddingTop: 8,
          fontSize: 12,
          opacity: '0.7',
        }}
      >
        **Work-In-Progress** Visualization by
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

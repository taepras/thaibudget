import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import logo from './logo.svg';
import './App.css';
import DataView from './components/DataView';
import FullView from './components/FullView';

const HiddenMobile = styled.div`
  @media (max-width: 480px){
    display: none !important;
  }
`;

function App() {
  const [data, setData] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isCompareView, setCompareView] = useState(false);
  const [filters, setFilters] = useState(['all']);
  const [sumWindows, setSumWindows] = useState([0, 0]);

  useEffect(() => {
    d3.csv(`${process.env.PUBLIC_URL}/data.csv`).then((d) => {
      setLoading(false);
      setData(d);
    });
  }, []);

  const setSumWindowsIdx = (i, value) => {
    const temp = [...sumWindows];
    temp[i] = value;
    setSumWindows(temp);
  };

  const maxSumValue = useMemo(() => d3.max(sumWindows), [sumWindows]);

  const isMultipleMaxSum = useMemo(() => {
    const mx = d3.max(sumWindows);
    return sumWindows.filter((x) => mx === x).length > 1;
  }, [sumWindows]);

  const preprocessedData = useMemo(() => data
    .map((d) => ({
      ...d,
      AMOUNT: parseFloat(d.AMOUNT.replace(/,/g, '')),
      OUTPUT_PROJECT: (d.OUTPUT || d.PROJECT) ? (d.OUTPUT + d.PROJECT) : 'ไม่ระบุโครงการ/ผลผลิต',
      MINISTRY: d.MINISTRY.replace(/\([0-9]+\)$/, '').trim(),
      ITEM: [
        d.ITEM_DESCRIPTION,
        d.CATEGORY_LV2,
        d.CATEGORY_LV3,
        d.CATEGORY_LV4,
        d.CATEGORY_LV5,
        d.CATEGORY_LV6,
      ]
        .filter((x) => x)
        .join(' - '),
    }))
    .filter((d) => +d.FISCAL_YEAR === 2022),
  [data]);

  const location = useLocation();
  const history = useHistory();

  useEffect(() => {
    const f = location.pathname.split('/').slice(1);
    console.log('f', f, f.length > 0 && f[0] ? f : ['all']);
    setFilters(f.length > 0 && f[0] ? f : ['all']);
  }, [location]);

  const navigateTo = (x, i) => {
    console.log(x, i);
    const temp = [...filters];
    temp.splice(i + 1);
    // setFilters(temp);
    console.log('temp', temp);
    history.push(`/${temp.join('/')}`);
  };

  return (
    <FullView>
      <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1 }}>
        <div style={{
          position: 'relative',
          flexGrow: 1,
        }}
        >
          <DataView
            data={preprocessedData}
            isLoading={isLoading}
            fullValue={maxSumValue}
            setCurrentSum={(s) => {
              console.log('setCurrentSum 0', s);
              setSumWindowsIdx(0, s);
            }}
            isMultipleMaxSum={isMultipleMaxSum}
            sumWindows={sumWindows}
            index={0}
          />
        </div>
        {isCompareView && (
          <div style={{
            position: 'relative',
            flexGrow: 1,
          }}
          >
            <DataView
              data={preprocessedData}
              isLoading={isLoading}
              fullValue={maxSumValue}
              setCurrentSum={(s) => {
                console.log('setCurrentSum 1', s);
                setSumWindowsIdx(1, s);
              }}
              isMultipleMaxSum={isMultipleMaxSum}
              sumWindows={sumWindows}
              index={1}
            />
          </div>
        )}
        <HiddenMobile style={{
          position: 'relative',
          width: 80,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
        >
          <button
            type="button"
            onClick={() => {
              if (isCompareView) { setSumWindowsIdx(1, 0); }
              setCompareView(!isCompareView);
            }}
            style={{
              paddingTop: 16,
              paddingBottom: 16,
              backgroundColor: '#181818',
              border: 'none',
              color: '#888',
              borderRadius: 8,
            }}
          >
            <span style={{
              display: 'inline-flex',
              fontSize: 24,
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#333',
              color: 'white',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
            >
              {!isCompareView ? '+' : '×'}
            </span>
            <br />
            {!isCompareView ? 'Open\nCompare\nView' : 'Close\nCompare\nView'}
          </button>
        </HiddenMobile>
      </div>
      <div
        style={{
          padding: 16,
          paddingTop: 8,
          fontSize: 12,
          opacity: '0.7',
          display: 'flex',
        }}
      >
        <div
          style={{
            position: 'relative',
            flexGrow: 1,
          }}
        >
          **Work-In-Progress**
          <br />
          โครงสร้างงบประมาณปี 65
        </div>
        <div style={{ textAlign: 'right' }}>
          Visualization by
          {' '}
          <a href="https://taepras.com" style={{ color: 'white' }}>Thanawit Prasongpongchai</a>
          <br />
          Data Source:
          {' '}
          <a href="https://docs.google.com/spreadsheets/d/1yyWXSTbq3CD_gNxks-krcSBzbszv3c_2Nq54lckoQ24/edit#gid=343539850" style={{ color: 'white' }}>กลุ่มก้าว Geek</a>
        </div>
      </div>
      <ReactTooltip multiline />
    </FullView>
  );
}

export default App;

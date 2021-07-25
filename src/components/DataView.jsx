import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import Treemap from './Treemap';
import FullView from './FullView';

const TOP_BAR_HEIGHT = 60;

const hierarchyBy = [
  'MINISTRY',
  'BUDGETARY_UNIT',
  'BUDGET_PLAN',
  // 'OUPUT',
  // 'PROJECT',
  'OUTPUT_PROJECT',
  // 'CATEGORY_LV1',
  'ITEM',
  // 'CATEGORY_LV2',
  // 'CATEGORY_LV3',
  // 'CATEGORY_LV4',
  // 'CATEGORY_LV5',
  // 'CATEGORY_LV6',
  // 'ITEM_DESCRIPTION',
];

const THAI_NAME = {
  MINISTRY: 'กระทรวงหรือเทียบเท่า',
  BUDGETARY_UNIT: 'หน่วยรับงบฯ',
  BUDGET_PLAN: 'แผนงาน',
  OUTPUT_PROJECT: 'ผลผลิต/โครงการ',
  ITEM: 'รายการ',
};

function DataView({
  data,
  isLoading,
  setCurrentSum = (sum) => { },
  fullValue = -1,
  index = 0,
  isMultipleMaxSum = false,
  sumWindows = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(['all']);

  const filterDataByQuery = useCallback((datum, query) => {
    const searchLevels = [
      'MINISTRY',
      'BUDGETARY_UNIT',
    ];
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in searchLevels) {
      if (datum[searchLevels[i]].includes(query)) { return true; }
    }
    return false;
  }, []);

  const filteredData = useMemo(
    () => data.filter((d) => filterDataByQuery(d, searchQuery)),
    [data, filterDataByQuery, searchQuery],
  );

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
    setFilters(temp);
    // history.push(`/${temp.join('/')}`);
  };

  return (
    <FullView>
      {/*
      <button type="button" onClick={() => setCompareView(!isCompareView)}>
      toggle compare view
      </button>
       */}
      <div
        style={{
          height: TOP_BAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            overflowX: 'auto',
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
                  marginRight: 8,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                <small style={{ opacity: '0.4', whiteSpace: 'nowrap' }}>{i > 0 && THAI_NAME[hierarchyBy[i - 1]]}</small>
                {i > 0 && <br />}
                <span style={{ textDecoration: i < filters.length - 1 ? 'underline' : 'none', whiteSpace: 'nowrap' }}>
                  {i === 0
                    ? (
                      searchQuery === ''
                        ? 'หน่วยงานทั้งหมด'
                        : `หน่วยงานทั้งหมดที่ชื่อมีคำว่า "${searchQuery}"`
                    )
                    : x.length < 20 ? x : `${x.substr(0, 20)}...`}
                </span>
              </button>
              {i === filters.length - 1
                && (
                  <>
                    <small style={{ color: 'white', marginRight: 8, opacity: '0.4' }}>
                      :
                    </small>
                    <small style={{ color: 'white', marginRight: 8, opacity: '0.4' }}>
                      แบ่งตาม
                      {' '}
                      {THAI_NAME[hierarchyBy[i]]}
                    </small>
                  </>
                )}
              {i < filters.length - 1
                && <span style={{ color: 'white', marginRight: 8 }}>&gt;</span>}
            </>
          ))}
          {/* {JSON.stringify(filters)} */}
        </div>
        <div>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Filter</label>
          <br />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="หน่วยรับงบหรือกระทรวง"
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1 }}>
        <div style={{
          position: 'relative',
          flexGrow: 1,
        }}
        >
          <Treemap
            data={filteredData}
            isLoading={isLoading}
            filters={filters}
            hierarchyBy={hierarchyBy}
            setFilters={setFilters}
            setCurrentSum={(x) => {
              // console.log('!!setting sum', x, setCurrentSum);
              setCurrentSum(x);
            }}
            fullValue={fullValue}
            index={index}
            isMultipleMaxSum={isMultipleMaxSum}
            sumWindows={sumWindows}
          />
        </div>
      </div>
    </FullView>
  );
}

export default DataView;

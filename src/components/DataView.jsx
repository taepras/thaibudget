import React, {
  useCallback, useEffect, useMemo, useState, useRef,
} from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import Treemap from './Treemap';
import YearComparison from './YearComparison';
import PercentageChangeList from './PercentageChangeList';
import FullView from './FullView';
import DropdownLink from './DropdownLink';

const TOP_BAR_HEIGHT = 60;

const RightSidebar = styled.div`
  display: flex;
  flex-direction: column;
  width: 320px;
  // border-left: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;

  @media screen and (orientation: portrait) {
    display: none;
  }
`;

const ResponsiveImage = styled.img`
  width: 100%;
`;

const CreditLink = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: white;
  text-align: center;
  margin-left: 16px;
  height: 32px;
  opacity: 0.4;

  &:hover {
    opacity: 1;
  }

  small {
    margin-bottom: 4px;
    opacity: 0.4;
  }

  ${ResponsiveImage} {
    max-width: 64px;
  }
`;

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
  ministry: 'กระทรวงหรือเทียบเท่า',
  budgetary_unit: 'หน่วยรับงบฯ',
  budget_plan: 'แผนงาน',
  output_project: 'ผลผลิต/โครงการ',
  item: 'รายการ',
  category_lv1: 'ประเภทงบ',
  category_lv2: 'หมวดรายจ่าย',
  category_lv3: 'ประเภทรายจ่าย',
  category_lv4: 'รายการย่อย',
};

function DataView({
  data,
  isLoading,
  setCurrentSum = (sum) => { },
  fullValue = -1,
  index = 0,
  isMultipleMaxSum = false,
  sumWindows = [],
  navigation = [],
  navigateTo = (key, groupBy = null) => { },
  popNavigationToLevel = (n) => { },
  setGroupBy = (axis) => { },
  defaultHierarchy = [],
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(['all']);
  const [hoveredItemName, setHoveredItemName] = useState(null);
  // const [groupingAxis, setGroupingAxis] = useState('MINISTRY'); // 'MINISTRY' or 'BUDGET_PLAN'
  const treemapRef = useRef(null);

  // Calculate effective hierarchy based on grouping axis
  // const effectiveHierarchy = useMemo(() => {
  //   if (groupingAxis === 'BUDGET_PLAN') {
  //     return [
  //       'BUDGET_PLAN',
  //       'MINISTRY',
  //       'BUDGETARY_UNIT',
  //       'OUTPUT_PROJECT',
  //       'ITEM',
  //     ];
  //   }
  //   if (groupingAxis === 'CATEGORY_LV1') {
  //     return [
  //       'CATEGORY_LV1',
  //       'MINISTRY',
  //       'BUDGETARY_UNIT',
  //       'OUTPUT_PROJECT',
  //       'ITEM',
  //     ];
  //   }
  //   if (groupingAxis === 'CATEGORY_LV2') {
  //     return [
  //       'CATEGORY_LV2',
  //       'MINISTRY',
  //       'BUDGETARY_UNIT',
  //       'OUTPUT_PROJECT',
  //       'ITEM',
  //     ];
  //   }
  //   if (groupingAxis === 'CATEGORY_LV3') {
  //     return [
  //       'CATEGORY_LV3',
  //       'MINISTRY',
  //       'BUDGETARY_UNIT',
  //       'OUTPUT_PROJECT',
  //       'ITEM',
  //     ];
  //   }
  //   if (groupingAxis === 'CATEGORY_LV4') {
  //     return [
  //       'CATEGORY_LV4',
  //       'MINISTRY',
  //       'BUDGETARY_UNIT',
  //       'OUTPUT_PROJECT',
  //       'ITEM',
  //     ];
  //   }
  //   return hierarchyBy;
  // }, [groupingAxis]);

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

  // const filteredData = useMemo(
  //   () => data.filter((d) => filterDataByQuery(d, searchQuery)),
  //   [data, filterDataByQuery, searchQuery],
  // );

  const location = useLocation();
  const history = useHistory();

  // useEffect(() => {
  //   const f = location.pathname.split('/').slice(1);
  //   console.log('f', f, f.length > 0 && f[0] ? f : ['all']);
  //   setFilters(f.length > 0 && f[0] ? f : ['all']);
  // }, [location]);

  // const navigateTo = (x, i) => {
  //   console.log(x, i);
  //   const temp = [...filters];
  //   temp.splice(i + 1);
  //   // setFilters(temp);
  //   console.log('temp', temp);
  //   setFilters(temp);
  //   // history.push(`/${temp.join('/')}`);
  // };

  const handlePercentageListClick = useCallback((itemName) => {
    // Trigger the actual treemap click to get existing transitions
    treemapRef.current?.triggerItemClick(itemName);
  }, []);

  const availableGroupByOptions = useMemo(() => {
    const usedGroupBys = navigation.map((x) => x.groupBy);
    const remainingGroupBys = defaultHierarchy.filter((x) => !usedGroupBys.includes(x));
    console.log('availableGroupByOptions', navigation, usedGroupBys, remainingGroupBys);
    return remainingGroupBys.map((x) => ({ value: x, label: THAI_NAME[x] || x }));
  }, [navigation, defaultHierarchy]);

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
            fontSize: 14,
            // overflowX: 'auto',
          }}
        >
          {/* <button type="button" onClick={() => setDisplayMode('treemap')}>treemap</button>
        <button type="button" onClick={() => setDisplayMode('bar')}>bar</button> */}

          {navigation.map((x, i) => (
            <React.Fragment key={navigation.slice(0, i + 1).map((n) => n.key).join('/')}>
              <button
                type="button"
                onClick={() => {
                  popNavigationToLevel(i);
                }}
                style={{
                  marginRight: 8,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                <small style={{ opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {i > 0 && THAI_NAME[navigation[i - 1].groupBy]}
                </small>
                {i > 0 && <br />}
                <span style={{ fontFamily: 'inherit', textDecoration: i < navigation.length - 1 ? 'underline' : 'none', whiteSpace: 'nowrap' }}>
                  {i === 0
                    ? (
                      searchQuery === ''
                        ? 'หน่วยงานทั้งหมด'
                        : `หน่วยงานทั้งหมดที่ชื่อมีคำว่า "${searchQuery}"`
                    )
                    : x.displayName.length < 20 ? x.displayName : `${x.displayName.substr(0, 20)}...`}
                </span>
              </button>
              {i === navigation.length - 1
                && (
                  <>
                    <small style={{ color: 'white', marginRight: 8, opacity: 0.6 }}>
                      :
                    </small>
                    <div style={{ display: 'inline-block', opacity: 0.6 }}>
                      แบ่งตาม
                      {' '}
                      <DropdownLink
                        label={`${THAI_NAME[navigation[i].groupBy] || navigation[i].groupBy}`}
                        options={availableGroupByOptions}
                        value={navigation[i].groupBy}
                        onChange={setGroupBy}
                      />
                    </div>
                  </>
                )}
              {i < navigation.length - 1
                && <span style={{ color: 'white', marginRight: 8 }}>&gt;</span>}
            </React.Fragment>
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
        <CreditLink target="_blank" href="https://taepras.com">
          {/* <small>Visualized by</small> */}
          <ResponsiveImage
            src={`${process.env.PUBLIC_URL}/tp_logo_dark.svg`}
            alt="Thanawit Prasongpongchai taepras.com"
            title="Thanawit Prasongpongchai"
          />
        </CreditLink>
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        flexGrow: 1,
        overflow: 'hidden',
      }}
      >
        <div style={{
          position: 'relative',
          flexGrow: 1,
        }}
        >
          <Treemap
            ref={treemapRef}
            data={data}
            isLoading={isLoading}
            filters={filters}
            // hierarchyBy={effectiveHierarchy}
            setFilters={setFilters}
            // groupingAxis={groupingAxis}
            setCurrentSum={(x) => {
              // console.log('!!setting sum', x, setCurrentSum);
              setCurrentSum(x);
            }}
            fullValue={fullValue}
            index={index}
            isMultipleMaxSum={isMultipleMaxSum}
            sumWindows={sumWindows}
            hoveredItemName={hoveredItemName}
            navigateTo={navigateTo}
          />
        </div>
        {/* <RightSidebar>
          <YearComparison
            data={filteredData}
            filters={filters}
            hierarchyBy={effectiveHierarchy}
          />
          <PercentageChangeList
            data={filteredData}
            filters={filters}
            hierarchyBy={effectiveHierarchy}
            hoveredItemName={hoveredItemName}
            setHoveredItemName={setHoveredItemName}
            onItemClick={handlePercentageListClick}
          />
        </RightSidebar> */}
      </div>
    </FullView>
  );
}

export default DataView;

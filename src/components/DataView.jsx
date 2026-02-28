import React, {
  useCallback, useMemo, useState, useRef,
} from 'react';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import Treemap from './Treemap';
import YearComparison from './YearComparison';
import PercentageChangeList from './PercentageChangeList';
import FullView from './FullView';
import DropdownLink from './DropdownLink';

const TOP_BAR_HEIGHT = 60;

const BreadCrumbContainer = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  flex-wrap: wrap;
  gap: 8px;
  opacity: 0.6;
  // overflow-x: auto;

  button {
    background-color: transparent;
    border: none;
    color: white;
    padding: 0;
    text-align: left;
    font-family: inherit;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const BreadCrumbItem = styled.button`
  background-color: transparent;
  border: none;
  color: white;
  padding: 0;
  text-align: left;
  font-family: inherit;
  text-decoration: underline;
  white-space: nowrap;
`

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
  height: 48px;
  width: 48px;
  opacity: 0.6;

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

const GROUPABLE_KEYS = [
  'ministry',
  'budgetary_unit',
  'budget_plan',
  'project',
  'category',
  'item'
];


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
  output: 'ผลผลิต',
  project: 'โครงการ',
  category: 'ประเภทรายจ่าย',
  item: 'รายการ',
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
  currentYear=2569,
  compareYear=2568,
  setCurrentYear = () => {},
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(['all']);
  const [hoveredItemName, setHoveredItemName] = useState(null);
  const treemapRef = useRef(null);

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
    // Sequential axes (budgetary_unit, output, project, item) can only be reached
    // by drilling down via tile clicks — they are never user-selectable in the dropdown.
    // Only "root" axes the user can freely choose from the dropdown:
    const selectableOptions = ['ministry', 'budget_plan', 'category'];

    // Exclude any axis already locked in by a *parent* navigation level.
    // The current level's groupBy is still changeable, so we only filter out parent levels.
    const parentGroupBys = navigation.slice(0, -1).map((x) => x.groupBy);

    const options = selectableOptions.filter((x) => !parentGroupBys.includes(x));
    if (
      !navigation
        .map((x) => x.groupBy)
        .includes(navigation[navigation.length - 1].groupBy)
    ) {
      options.push(navigation[navigation.length - 1].groupBy);
    }
    console.log('availableGroupByOptions', navigation, parentGroupBys, options);
    return options.map((x) => ({ value: x, label: THAI_NAME[x] || x }));
  }, [navigation]);

  const growth = useMemo(() => {
    if (!data || !data.totals) return 0;
    const current = data.totals["" + currentYear] || 0;
    const previous = data.totals["" + compareYear] || 0;
    if (previous === 0) {
      return current > 0 ? 1 : 0;
    }
    return (current - previous) / previous;
  }, [data, currentYear, compareYear]);

  // Get isLeafLevel from API response
  // const isLeafLevel = data?.isLeafLevel ?? false;
  const isLeafLevel = useMemo(
    () => navigation[navigation.length - 1].groupBy === 'item' || data?.isLeafLevel, [navigation, data]
  );

  return (
    <FullView>
      {/*
      <button type="button" onClick={() => setCompareView(!isCompareView)}>
      toggle compare view
      </button>
       */}
      <div
        style={{
          // height: TOP_BAR_HEIGHT,
          padding: '16px',
          paddingBottom: 0,
        }}
      >
        <div style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'start',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, paddingBottom: '16px'}}>
            <BreadCrumbContainer>
              <BreadCrumbItem>
                <DropdownLink
                  label={`งบประมาณปี ${currentYear}`}
                  options={[
                    { value: 2569, label: 2569 },
                    { value: 2568, label: 2568 },
                    { value: 2567, label: 2567 },
                    { value: 2566, label: 2566 },
                    { value: 2565, label: 2565 },
                  ]}
                  value={currentYear}
                  onChange={setCurrentYear}
                />
              </BreadCrumbItem>
              {navigation
                .filter((x, i) => i < navigation.length - 1)
                .map((x, i) => (
                  <React.Fragment key={navigation.slice(0, i + 1).map((n) => n.key).join('/')}>
                    <span>&gt;</span>
                    <BreadCrumbItem
                      type="button"
                      onClick={() => { popNavigationToLevel(i); }}
                      title={x.displayName}
                    >
                      {x.displayName.length < 20 ? x.displayName : `${x.displayName.substr(0, 20)}...`}
                    </BreadCrumbItem>
                  </React.Fragment>
                ))
              }
            {/* </div> */}
            </BreadCrumbContainer>
            <h1
              style={{
                marginTop: '4px',
                marginBottom: '4px',
                fontSize: 24,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                minWidth: 0
              }}
              title={navigation[navigation.length - 1].displayName}
            >
              {
                navigation.length > 0
                ? navigation[navigation.length - 1].displayName
                : 'งบประมาณปี ' + currentYear
              }
            </h1>
            <div style={{ fontSize: 14, opacity: 0.6 }}>
              {data.totals?.["" + currentYear]?.toLocaleString() ?? 'N/A'} บาท {' '}
              {currentYear > 2565 && <span
                style={{
                  color: growth > 0 ? '#4f4' : growth < 0 ? '#f44' : 'inherit',
                }}
              >
                {'('}
                {(growth >= 0 ? '+' : '') + (growth * 100).toFixed(1)}
                {'% จากปีก่อนหน้า)'}
              </span>} — แบ่งตาม {' '}
              <DropdownLink
                label={`${THAI_NAME[navigation[navigation.length - 1].groupBy] || navigation[navigation.length - 1].groupBy}`}
                options={availableGroupByOptions}
                value={navigation[navigation.length - 1].groupBy}
                onChange={setGroupBy}
              />
            </div>
          </div>

          {/* <div>
            <label style={{ fontSize: 12, opacity: 0.6 }}>Filter</label>
            <br />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="หน่วยรับงบหรือกระทรวง"
            />
          </div> */}
          <CreditLink target="_blank" href="https://taepras.com">
            <ResponsiveImage
              src={`${process.env.PUBLIC_URL}/tp_logo_dark.svg`}
              alt="Thanawit Prasongpongchai taepras.com"
              title="Thanawit Prasongpongchai"
            />
          </CreditLink>
        </div>
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
            title={navigation[navigation.length - 1].displayName}
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
            isLeafLevel={isLeafLevel}
            primaryYear={currentYear}
            compareYear={compareYear}
          />
        </div>
        <RightSidebar>
          <div style={{ flexShrink: 0 }}>
            <YearComparison
              data={data}
              currentYear={currentYear}
              onYearClick={setCurrentYear}
            />
          </div>
          <PercentageChangeList
            data={data}
            hoveredItemName={hoveredItemName}
            setHoveredItemName={setHoveredItemName}
            onItemClick={handlePercentageListClick}
          />
        </RightSidebar>
      </div>
    </FullView>
  );
}

export default DataView;

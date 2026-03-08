import React, {
  useCallback, useMemo, useState, useRef,
  useEffect,
} from 'react';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import Treemap from './Treemap';
import YearComparison from './YearComparison';
import PercentageChangeList from './PercentageChangeList';
import FullView from './FullView';
import DropdownLink from './DropdownLink';
import MultiTierDropdownLink from './MultiTierDropdownLink';
import ResizableSplitView from './ResizableSplitView';
import Ui from './BasicUi';

const BreadCrumbContainer = styled.div`
  display: flex;
  align-items: center;
  font-size: 0.875rem;
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

const BreadCrumbText = styled.span`
  color: white;
  white-space: nowrap;
`



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
  opacity: 0.8;

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

const DataViewContainer = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: row;
  overflow: hidden;

  @media screen and (orientation: portrait) {
    flex-direction: column;
  }
`;

const SidebarFilter = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  // gap: 16px;
  font-size: 0.875rem;
  width: 180px;

  @media screen and (orientation: portrait) {
    flex-direction: row;
    width: 100%;
    overflow-x: auto;
  }
`;

const SidebarFilterGroupTitle = styled.h4`
  font-weight: bold;
  color: rgba(255, 255, 255, 0.6);  
  margin: 0;

  @media screen and (orientation: portrait) {
    white-space: nowrap;
    margin-right: 8px;
  }
`;

const SidebarFilterGroup = styled.div`
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  @media screen and (orientation: portrait) {
    flex-direction: row;
    margin-left: 16px;
    margin-bottom: 0px;

    * {
      white-space: nowrap;
    }
  }
`;

const THAI_NAME = {
  ministry: 'กระทรวงหรือเทียบเท่า',
  budgetary_unit: 'หน่วยรับงบฯ',
  budget_plan: 'แผนงาน',
  output_project: 'ผลผลิต/โครงการ',
  // kept for legacy data references
  // output: 'ผลผลิต',
  // project: 'โครงการ',
  category: 'ประเภทรายจ่าย',
  item: 'รายการ',
  obliged: 'ประเภทงบผูกพัน',
};

function DataView({
  data,
  isLoading,
  setCurrentSum = (sum) => { },
  fullValue = -1,
  index = 0,
  isMultipleMaxSum = false,
  sumWindows = [],
  groupBy = 'budgetary_unit',
  displayName = 'รวมทุกหน่วยงาน',
  canGoBack = false,
  goBack = () => {},
  navigateTo = (key, displayName, metadata) => { },
  setGroupBy = (axis) => { },
  currentYear=2569,
  compareYear=2568,
  setCurrentYear = () => {},
  filterableDimensions = {},
  filters = {},
  setFilters = () => {},
  resetAll = () => {},
}) {
  const [searchQuery, setSearchQuery] = useState('');
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
    const selectableOptions = ['budgetary_unit', 'budget_plan', 'category', 'obliged', 'output_project', 'item'];
    // Exclude dimensions already locked in by tile-click navigation (in filters)
    const lockedDims = new Set(Object.keys(filters));
    const options = selectableOptions.filter((x) => !lockedDims.has(x) || x === groupBy);
    return options.map((x) => ({ value: x, label: THAI_NAME[x] || x }));
  }, [filters, groupBy]);

  const growth = useMemo(() => {
    if (!data || !data.totals) return 0;
    const current = data.totals["" + currentYear] || 0;
    const previous = data.totals["" + compareYear] || 0;
    if (previous === 0) {
      return current > 0 ? 1 : 0;
    }
    return (current - previous) / previous;
  }, [data, currentYear, compareYear]);

  const isLeafLevel = useMemo(
    () => groupBy === 'item' || data?.isLeafLevel, [groupBy, data]
  );

  // filters is already the merged effective filter state from App.jsx
  const computedFilters = filters;

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
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1, paddingBottom: '16px'}}>
            <BreadCrumbContainer>
              {canGoBack ? (
                <BreadCrumbItem type="button" onClick={goBack}>
                  ← กลับ
                </BreadCrumbItem>
              ) : (
                <BreadCrumbText>
                  สำรวจงบประมาณประจำปี {currentYear}
                </BreadCrumbText>
              )}
            </BreadCrumbContainer>
            <h1
              style={{
                margin: '8px 0',
                fontSize: 24,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0
              }}
              title={displayName}
            >
              {displayName}
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
                {`% จากปี ${compareYear})`}
              </span>}
            </div>
          </div>
          <CreditLink target="_blank" href="https://taepras.com">
            <ResponsiveImage
              src={`${process.env.PUBLIC_URL}/tp_logo_dark.svg`}
              alt="Thanawit Prasongpongchai taepras.com"
              title="Thanawit Prasongpongchai"
            />
          </CreditLink>
        </div>
      </div>
      <DataViewContainer>
        <SidebarFilter>
          <Ui.Title style={{ marginBottom: 16, whiteSpace: 'nowrap' }}>กรอง/แบ่งกลุ่ม</Ui.Title>
          <SidebarFilterGroup>
            <SidebarFilterGroupTitle>แบ่งตาม</SidebarFilterGroupTitle>
            <DropdownLink
              label={`${THAI_NAME[groupBy] || groupBy}`}
              options={availableGroupByOptions}
              value={groupBy}
              onChange={setGroupBy}
            />
          </SidebarFilterGroup>
          <SidebarFilterGroup>
            <SidebarFilterGroupTitle>ปีงบประมาณ</SidebarFilterGroupTitle>
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
          </SidebarFilterGroup>
          <SidebarFilterGroup>
            <SidebarFilterGroupTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              กรอง
              {(Object.keys(filters).length > 0 || canGoBack) && (
                <button
                  type="button"
                  onClick={resetAll}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 4,
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '1px 6px',
                    lineHeight: '1.4',
                  }}
                >
                  รีเซ็ต
                </button>
              )}
            </SidebarFilterGroupTitle>
            {Object.keys(filterableDimensions ?? {}).map((key) => {
              const dimItems = filterableDimensions[key] ?? [];
              const isHierarchical = dimItems.some((k) => k.children?.length > 0);

              // On null (ทั้งหมด), delete the key entirely so nav-derived filters resume
              const handleChange = (value) => {
                if (value === null) {
                  setFilters((prev) => { const next = { ...prev }; delete next[key]; return next; });
                } else {
                  setFilters((prev) => ({ ...prev, [key]: value }));
                }
              };

              if (isHierarchical) {
                return (
                  <div key={`filter-control-${key}`}>
                    <MultiTierDropdownLink
                      label={THAI_NAME[key] || key}
                      options={dimItems}
                      value={computedFilters?.[key] ?? null}
                      onChange={handleChange}
                    />
                  </div>
                );
              }

              const options = [
                { value: null, label: 'ทั้งหมด' },
                ...dimItems.map((k) => ({ value: k.id, label: k.name })),
              ].sort((a, b) => {
                if (a?.value === null) return -1;
                if (b?.value === null) return 1;
                return a?.label?.localeCompare(b?.label);
              });

              return (
                <div key={`filter-control-${key}`}>
                  <DropdownLink
                    label={`${THAI_NAME[key] || key}: ${computedFilters?.[key] ? options.find((o) => o.value === computedFilters?.[key])?.label || computedFilters?.[key] : 'ทั้งหมด'}`}
                    options={options}
                    value={computedFilters?.[key]}
                    onChange={handleChange}
                  />
                </div>
              );
            })}
          </SidebarFilterGroup>
        </SidebarFilter>
        <ResizableSplitView
          mainLabel="โครงสร้างงบ"
          sidebarLabel="รายการย่อย"
          defaultSidebarWidth={360}
          minSidebarWidth={240}
          maxSidebarWidth={1000}
          main={
            <Treemap
              ref={treemapRef}
              title={displayName}
              data={data}
              isLoading={isLoading}
              filters={filters}
              setFilters={setFilters}
              setCurrentSum={(x) => { setCurrentSum(x); }}
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
          }
          sidebar={
            <>
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
                primaryYear={currentYear}
                compareYear={compareYear}
              />
            </>
          }
        />
      </DataViewContainer>
    </FullView>
  );
}

export default DataView;

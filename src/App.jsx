import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import * as d3 from 'd3';
import styled from 'styled-components';
import { useHistory, useLocation } from 'react-router-dom';
import ReactTooltip from 'react-tooltip';
import './App.css';
import DataView from './components/DataView';
import FullView from './components/FullView';

const PageContainer = styled.div`
 display: flex;
 flex-direction: row;
 flex-grow: 1;

  @media screen and (orientation:portrait) {
    flex-direction: column;
  }
`;

const DEFAULT_HIERARCHY = [
  'budgetary_unit',
  // 'budget_plan',
  'output_project',
  // 'category',
  'item'
];

// Returns the next groupBy dimension to show after drilling into `currentGroupBy`,
// skipping any dimensions that already have a filter applied.
const getNextInHierarchy = (currentGroupBy, navFilters) => {
  const currentIdx = DEFAULT_HIERARCHY.indexOf(currentGroupBy);
  for (let i = currentIdx + 1; i < DEFAULT_HIERARCHY.length; i++) {
    if (!(DEFAULT_HIERARCHY[i] in navFilters)) return DEFAULT_HIERARCHY[i];
  }
  return 'item';
};

function App() {
  const [data, setData] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isCompareView, setCompareView] = useState(false);
  const [sumWindows, setSumWindows] = useState([0, 0]);

  const [currentYear, setCurrentYear] = useState(2569);
  const [compareYear, setCompareYear] = useState(2568);

  const handleSetCurrentYear = useCallback((year) => {
    setCurrentYear(year);
    setCompareYear(Math.max(2565, year - 1));
  }, []);

  const [navGroupBy, setNavGroupBy] = useState('budgetary_unit');
  const [navDisplayName, setNavDisplayName] = useState('งบรวมทุกหน่วยงาน');
  const [filters, setFilters] = useState({});
  const [filterNames, setFilterNames] = useState({});
  // Undo history: each entry = { navGroupBy, navDisplayName, filters, filterNames }
  const [navHistory, setNavHistory] = useState([]);

  // Refs so callbacks can read current state without being re-created on every change,
  // and without nesting setState calls inside other setState updaters (which double-fires
  // in React Strict Mode and corrupts history).
  const navGroupByRef = useRef(navGroupBy);
  const navDisplayNameRef = useRef(navDisplayName);
  const filtersRef = useRef(filters);
  const filterNamesRef = useRef(filterNames);
  const navHistoryRef = useRef(navHistory);
  navGroupByRef.current = navGroupBy;
  navDisplayNameRef.current = navDisplayName;
  filtersRef.current = filters;
  filterNamesRef.current = filterNames;
  navHistoryRef.current = navHistory;

  const navigateTo = useCallback((key, clickedDisplayName, metadata = {}) => {
    const currentNavGroupBy = navGroupByRef.current;
    const currentNavDisplayName = navDisplayNameRef.current;
    const currentFilters = filtersRef.current;
    const currentFilterNames = filterNamesRef.current;
    const currentNavHistory = navHistoryRef.current;

    const newFilters = { ...currentFilters };
    let nextGroupBy;

    if (currentNavGroupBy === 'budgetary_unit') {
      const existing = currentFilters.budgetary_unit;
      newFilters.budgetary_unit = existing ? `${existing},${key}` : String(key);
      nextGroupBy = metadata.isTerminal
        ? getNextInHierarchy('budgetary_unit', newFilters)
        : 'budgetary_unit';
    } else if (currentNavGroupBy === 'category') {
      if (Number(key) !== -1) {
        const existing = currentFilters.category;
        newFilters.category = existing ? `${existing},${key}` : String(key);
      }
      nextGroupBy = metadata.isTerminal || Number(key) === -1 ? 'item' : 'category';
    } else {
      newFilters[currentNavGroupBy] = String(key);
      nextGroupBy = getNextInHierarchy(currentNavGroupBy, newFilters);
    }

    unstable_batchedUpdates(() => {
      setNavHistory([
        ...currentNavHistory,
        { navGroupBy: currentNavGroupBy, navDisplayName: currentNavDisplayName, filters: currentFilters, filterNames: currentFilterNames },
      ]);
      setFilters(newFilters);
      setNavGroupBy(nextGroupBy);
      setFilterNames({ ...currentFilterNames, [currentNavGroupBy]: clickedDisplayName ?? String(key) });
      setNavDisplayName(clickedDisplayName ?? String(key));
    });
  }, []);

  const onFilterChange = useCallback((key, value, name) => {
    const currentNavGroupBy = navGroupByRef.current;
    const currentNavDisplayName = navDisplayNameRef.current;
    const currentFilters = filtersRef.current;
    const currentFilterNames = filterNamesRef.current;
    const currentNavHistory = navHistoryRef.current;

    setNavHistory([
      ...currentNavHistory,
      { navGroupBy: currentNavGroupBy, navDisplayName: currentNavDisplayName, filters: currentFilters, filterNames: currentFilterNames },
    ]);

    const newFilterNames = { ...currentFilterNames };
    if (value === null) {
      delete newFilterNames[key];
    } else {
      newFilterNames[key] = name;
    }
    setFilterNames(newFilterNames);

    if (value === null) {
      const next = { ...currentFilters };
      delete next[key];
      setFilters(next);
    } else {
      setFilters({ ...currentFilters, [key]: value });
    }
  }, []);

  const calcDisplayName = useMemo(() => {
    console.log('names', filterNames);
    let displayName = '';
    displayName += filterNames.category ? `${filterNames.category} ` : '';
    if (filterNames.output_project) {
      displayName += filterNames.category ? 'ใน' : '';
      displayName += `${filterNames.output_project} `;
    }
    else if (filterNames.budget_plan) {
      displayName += filterNames.category ? 'ใน' : '';
      displayName += `${filterNames.budget_plan} `;
    }
    // displayName += filterNames.category || filterNames.budget_plan ? 'ของ' : '';
    displayName += filterNames.budgetary_unit ? `${filterNames.budgetary_unit}` : 'งบรวมทุกหน่วยงาน';
    return displayName;
  }, [filterNames]);

  const goBack = useCallback(() => {
    const currentHistory = navHistoryRef.current;
    if (currentHistory.length === 0) return;
    const newHistory = [...currentHistory];
    const prev = newHistory.pop();
    setNavHistory(newHistory);
    setNavGroupBy(prev.navGroupBy);
    setFilterNames(prev.filterNames);
    setNavDisplayName(prev.navDisplayName);
    setFilters(prev.filters);
  }, []);

  const setGroupBy = useCallback((groupBy) => {
    setNavGroupBy(groupBy);
  }, []);

  const jumpToSearchResult = useCallback((result, dimension) => {
    const currentNavGroupBy = navGroupByRef.current;
    const currentNavDisplayName = navDisplayNameRef.current;
    const currentFilters = filtersRef.current;
    const currentFilterNames = filterNamesRef.current;
    const currentNavHistory = navHistoryRef.current;

    setNavHistory([
      ...currentNavHistory,
      { navGroupBy: currentNavGroupBy, navDisplayName: currentNavDisplayName, filters: currentFilters, filterNames: currentFilterNames },
    ]);

    const newFilters = {};
    const newFilterNames = {};

    if (dimension === 'budgetary_unit') {
      const parentIds = result.parent_budgetary_unit_ids || [];
      const parentNames = result.parent_budgetary_unit_names || [];
      const buIds = [...parentIds, result.id];
      newFilters.budgetary_unit = buIds.join(',');
      newFilterNames.budgetary_unit = result.name;
      newFilterNames.budgetary_unit_parents = parentNames;
    } else {
      const buIds = result.budgetary_unit_ids || [];
      const buNames = result.budgetary_unit_names || [];
      if (buIds.length > 0) {
        newFilters.budgetary_unit = buIds.join(',');
        newFilterNames.budgetary_unit = buNames[buNames.length - 1] || '';
      }
      if (dimension !== 'item') {
        newFilters[dimension] = String(result.id);
        newFilterNames[dimension] = result.name;
      }
    }

    const nextGroupBy = dimension === 'item'
      ? 'item'
      : getNextInHierarchy(dimension, newFilters);
    setNavGroupBy(nextGroupBy);
    setNavDisplayName(result.name);
    setFilterNames(newFilterNames);
    setFilters(newFilters);
  }, []);

  const resetAll = useCallback(() => {
    setFilters({});
    setFilterNames({});
    setNavGroupBy('budgetary_unit');
    setNavDisplayName('งบรวมทุกหน่วยงาน');
    setNavHistory([]);
  }, []);

  const [dimensions, setDimensions] = useState({});

  // In-memory cache keyed by full URL string. Cached results are used immediately
  // so navigating back/forward feels instant.
  const breakdownCacheRef = useRef({});
  const dimensionsCacheRef = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      const url = new URL(`${process.env.REACT_APP_API_URL}/api/dimensions`);
      url.searchParams.set('year', currentYear);
      if (filters.budgetary_unit)  url.searchParams.set('filterBudgetaryUnitPath', filters.budgetary_unit);
      if (filters.budget_plan != null) url.searchParams.set('filterBudgetPlanId', filters.budget_plan);
      if (filters.output_project != null) url.searchParams.set('filterOutputProjectId', filters.output_project);
      if (filters.category)        url.searchParams.set('filterCategoryPath', filters.category);
      const cacheKey = url.href;
      if (dimensionsCacheRef.current[cacheKey]) {
        setDimensions(dimensionsCacheRef.current[cacheKey]);
        return;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('API error');
      const result = await response.json();
      dimensionsCacheRef.current[cacheKey] = result;
      console.log('✅ dimensions loaded', result);
      setDimensions(result);
    }
    fetchData();
  }, [currentYear, filters]);

  useEffect(() => {
    console.log('🗺️ view state updated', { navGroupBy, filters });
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const apiEndpoint = `${process.env.REACT_APP_API_URL}/api/breakdown`;
      const params = {
        year: [currentYear, ...[2569, 2568, 2567, 2566, 2565].filter(y => y !== currentYear)], // currentYear first so backend uses it for isTerminal
        group: navGroupBy,
      };

      // Build API filter parameters from effective filters
      for (const [filterName, filterValue] of Object.entries(filters)) {
        if (filterValue != null) {
          const filterNameCamelCase = filterName
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');

          // Use Path for budgetary_unit and category to include all descendants
          if (filterName === 'budgetary_unit') {
            params.filterBudgetaryUnitPath = filterValue;
          } else if (filterName === 'category') {
            // When showing items inside a nav-derived category, append -1 to signal direct items
            const path = (navGroupBy === 'item' && 'category' in filters)
              ? `${filterValue},-1`
              : filterValue;
            params.filterCategoryPath = path;
          } else {
            params[`filter${filterNameCamelCase}Id`] = filterValue;
          }
        }
      }

      const url = new URL(apiEndpoint);
      const searchParams = new URLSearchParams();
      params.year.forEach((y) => searchParams.append('year', y));
      Object.entries(params).forEach(([k, v]) => {
        if (k !== 'year') searchParams.append(k, v);
      });
      url.search = searchParams.toString();

      console.log('🔍 fetching data', url.href);

      const cacheKey = url.href;
      let result;
      if (breakdownCacheRef.current[cacheKey]) {
        console.log('⚡ cache hit', cacheKey);
        result = breakdownCacheRef.current[cacheKey];
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API error');
        result = await response.json();
        breakdownCacheRef.current[cacheKey] = result;
      }

      // Discard result if this effect was superseded by a newer navigation/year change
      if (cancelled) return;

      console.log('✅ api data loaded', result);

      // Handle empty rows: skip to next level in hierarchy
      if (result.rows && result.rows.length === 0 && !result.isLeafLevel) {
        if (navGroupBy === 'category') {
          setNavGroupBy('item');
        } else {
          const next = getNextInHierarchy(navGroupBy, filters);
          if (next && next !== navGroupBy) setNavGroupBy(next);
        }
        return; // re-run effect with new groupBy
      }

      // If backend switched category→item, sync groupBy
      if (navGroupBy === 'category' && result.group === 'item') {
        setNavGroupBy('item');
      }

      setData(result);
      setLoading(false);
    };
    fetchData();

    return () => { cancelled = true; };
  }, [currentYear, compareYear, navGroupBy, filters]);

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

  return (
    <FullView>
      <PageContainer>
        <div style={{
          position: 'relative',
          flexGrow: 1,
        }}
        >
          <DataView
            currentYear={currentYear}
            compareYear={compareYear}
            setCurrentYear={handleSetCurrentYear}
            data={data}
            isLoading={isLoading}
            fullValue={maxSumValue}
            setCurrentSum={(s) => {
              console.log('setCurrentSum 0', s);
              setSumWindowsIdx(0, s);
            }}
            isMultipleMaxSum={isMultipleMaxSum}
            sumWindows={sumWindows}
            index={0}
            groupBy={navGroupBy}
            displayName={calcDisplayName}
            canGoBack={navHistory.length > 0}
            goBack={goBack}
            navigateTo={navigateTo}
            setGroupBy={setGroupBy}
            filterableDimensions={dimensions}
            filters={filters}
            setFilters={setFilters}
            onFilterChange={onFilterChange}
            resetAll={resetAll}
            onSearchResultClick={jumpToSearchResult}
          />
        </div>
        {isCompareView && (
          <div style={{
            position: 'relative',
            flexGrow: 1,
          }}
          >
            <DataView
              data={data}
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
        {/* <Sidebar>
          <ActionButton
            type="button"
            onClick={() => {
              if (isCompareView) { setSumWindowsIdx(1, 0); }
              setCompareView(!isCompareView);
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
            {!isCompareView ? 'Open\nCompare\nView' : 'Close\nCompare\nView'}
          </ActionButton>
          <div style={{ flexGrow: 1 }} />

          <CreditLink target="_blank" href="https://taepras.com">
            <small>Visualized by</small>
            <ResponsiveImage
              src={`${process.env.PUBLIC_URL}/tp_logo_dark.svg`}
              alt="Thanawit Prasongpongchai taepras.com"
              title="Thanawit Prasongpongchai"
            />
          </CreditLink>
          <CreditLink target="_blank" href="https://docs.google.com/spreadsheets/d/1yyWXSTbq3CD_gNxks-krcSBzbszv3c_2Nq54lckoQ24/edit#gid=343539850">
            <small>Data Source</small>
            <ResponsiveImage
              src={`${process.env.PUBLIC_URL}/kaogeek_logo_dark.png`}
              alt="kaogeek logo"
              title="กลุ่มก้าว Geek"
            />
            <ResponsiveImage
              src={`${process.env.PUBLIC_URL}/wevis_logo_dark.png`}
              alt="WeVis logo"
              title="WeVis"
            />
          </CreditLink>
          <div style={{ opacity: 0.6, textAlign: 'center' }}>
            <small style={{ display: 'inline-block', lineHeight: 1.2 }}>
              ** This is a work-in-progress.
            </small>
          </div>
        </Sidebar> */}
      </PageContainer>
      {/* <div
        style={{
          padding: 16,
          paddingTop: 8,
          fontSize: 12,
          opacity: '0.7',
          display: 'flex',
        }}
      >

      </div> */}
      <ReactTooltip html className="app-tooltip" />
    </FullView>
  );
}

export default App;

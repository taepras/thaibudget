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

const PageContainer = styled.div`
 display: flex;
 flex-direction: row;
 flex-grow: 1;

  @media screen and (orientation:portrait) {
    flex-direction: column;
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

  &:hover {
    opacity: 0.6;
  }

  small {
    margin-bottom: 4px;
    opacity: 0.4;
  }

  ${ResponsiveImage} {
    max-width: 64px;
  }
`;

const Sidebar = styled.div`
  position: relative;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  @media screen and (orientation:landscape) {
    width: 80px;
    &>*:not(:last-child) {
      margin-bottom: 16px;
    }
  }

  @media screen and (orientation:portrait) {
    height: 64px;
    flex-direction: row;
    /* display: none !important; */

    &>*:not(:last-child) {
      margin-right: 16px;
    }

    ${CreditLink} ${ResponsiveImage} {
      max-width: 48px;
    }
  }
`;

const ActionButton = styled.button`
  padding: 8px;
  background-color: #181818;
  border: none;
  color: #888;
  border-radius: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const DEFAULT_HIERARCHY = [
  'ministry',
  'budgetary_unit',
  'budget_plan',
  'output',
  'project',
  'category',
  'item'
];

const getNextGroupBy = (navigation, navigatingTo) => {
  const currentGroupBy = navigation[navigation.length - 1]?.groupBy;

  console.log('🫥 getNextGroupBy');
  console.log('>> latest nav', navigation[navigation.length - 1]);
  console.log('>> currentGroupBy', currentGroupBy);
  if (currentGroupBy === 'category') {
    if (!navigatingTo?.metadata?.isTerminal)
      return 'category';
  } else if (currentGroupBy === 'ministry') {
    return 'budgetary_unit';
  } else if (currentGroupBy === 'budget_plan') {
    return 'output'
  }

  return DEFAULT_HIERARCHY.filter((x) => !navigation.map((n) => n.groupBy).includes(x))?.[0] ?? null;
}

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

  const [navigation, setNavigation] = useState([{ key: null, displayName: 'รวมทุกหน่วยงาน', groupBy: 'ministry' }]);

  const navigateTo = useCallback((key, displayName = null, metadata = {}) => {
    if (displayName === null) displayName = key;


    setNavigation((currentNav) => {
      console.log('😡 navigating...');
      console.log('>> old nav', currentNav);
      console.log('>> going to...', { key, displayName, metadata });
      const groupBy = getNextGroupBy(currentNav, { key, displayName, metadata });
      console.log('🫠 new groupBy >> ', groupBy);
      console.log('🫠 new navigation >> ', [...currentNav, { key, displayName, groupBy, metadata }]);
      return [...currentNav, { key, displayName, groupBy, metadata }];
    });

    // setNavigation((currentNav) => {
    //   // // Special case: if clicking on sentinel id -1 in category context,
    //   // // append -1 to the category path and switch to 'item' groupBy.
    //   // // This tells the backend "show items directly in this category, not subcategories"
    //   // if (key === -1 && groupBy === undefined) {
    //   //   const lastNode = currentNav[currentNav.length - 1];
    //   //   if (lastNode?.groupBy === 'category') {
    //   //     // Update current category node to groupBy='item' (which will trigger sending -1 in path)
    //   //     const newNav = [...currentNav];
    //   //     newNav[newNav.length - 1] = { ...newNav[newNav.length - 1], groupBy: 'item' };
    //   //     return newNav;
    //   //   }
    //   // }

    //   // if (groupBy === null) {
    //   const nextNav = [...currentNav, { key, groupBy, displayName, metadata }]
    //   groupBy = getNextGroupBy(nextNav);
    //   console.log('🫥getNextGroupBy >> ', groupBy);

    //     // // If drilling into a terminal category, treat category as "used" and get the next groupBy
    //     // if (currentNav[currentNav.length - 1]?.groupBy === 'category' && metadata.isTerminal) {
    //     //   // Create a temporary nav that includes this category click to simulate it being "used"
    //     //   const tempNav = [...currentNav, { key, groupBy: 'category', displayName }];
    //     //   groupBy = getNextGroupBy(tempNav);
    //     // }
    //   // }

    //   return nextNav;
    // });
  }, []);

  const popNavigationToLevel = useCallback((n) => {
    console.log('😡 pop navigation to level', n, navigation, navigation.slice(0, n + 1));
    setNavigation(navigation.slice(0, n + 1));
  }, [navigation, setNavigation]);

  const setGroupBy = useCallback((groupBy) => {
    console.log('😡 set groupBy', groupBy);
    setNavigation((nav) => {
      const newNav = [...nav];
      newNav[newNav.length - 1].groupBy = groupBy;
      return newNav;
    });
  }, []);

  useEffect(() => {
    console.log('🗺️ navigation updated', navigation);
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      const apiEndpoint = `${process.env.REACT_APP_API_URL}/api/breakdown`;
      const params = {
        year: [2569, 2568, 2567, 2566, 2565], // todo: dynamic years
        group: navigation[navigation.length - 1].groupBy,
      };

      // Build filter parameters from navigation trail
      const categoryKeyStartIndex = navigation.findIndex(node => node.groupBy === 'category');
      let hasCategoryInPath = false;

      for (let i = 0; i < navigation.length - 1; i++) {
        if (navigation[i].groupBy && navigation[i + 1].key) {
          const groupByCamelCase = navigation[i].groupBy
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');

          // For category grouping, collect all category IDs into a path array
          if (navigation[i].groupBy === 'category') {
            hasCategoryInPath = true;
            // Don't set filterCategoryId here; we'll handle it with filterCategoryPath below
          } else {
            params[`filter${groupByCamelCase}Id`] = navigation[i + 1].key;
          }
        }
      }

      // If there are categories in the path, build filterCategoryPath
      if (hasCategoryInPath && categoryKeyStartIndex >= 0) {
        const categoryIds = [];
        // Start from the first category entry and collect keys where previous groupBy was also 'category'
        // This ensures we only collect actual category IDs, not IDs from other dimensions
        for (let i = categoryKeyStartIndex; i < navigation.length; i++) {
          if (navigation[i].groupBy === 'category' && navigation[i].key !== null) {
            // Only add this key if the previous groupBy was also 'category'
            // (meaning this key represents a category we drilled into, not another dimension)
            if (i === categoryKeyStartIndex) {
              // Skip the first category entry - its key comes from the previous dimension (e.g., project)
              continue;
            }
            if (navigation[i - 1].groupBy === 'category') {
              categoryIds.push(navigation[i].key);
            }
          }
        }
        // If current groupBy is 'item' after categories, append -1 to the path
        // This tells backend to show items directly in the last category.
        // If the last item node has a real key (not -1), it's a terminal category whose ID must
        // be included in the path first, then -1 to signal "show direct items of this category".
        if (navigation[navigation.length - 1].groupBy === 'item' && categoryIds.length > 0) {
          const itemNodeKey = navigation[navigation.length - 1].key;
          if (itemNodeKey !== null && itemNodeKey !== -1 && itemNodeKey !== '-1') {
            categoryIds.push(itemNodeKey);
          }
          categoryIds.push(-1);
        }
        if (categoryIds.length > 0) {
          params.filterCategoryPath = categoryIds.join(',');
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

      const response = await fetch(url);
      if (!response.ok) throw new Error('API error');
      const result = await response.json();

      // Discard result if this effect was superseded by a newer navigation/year change
      if (cancelled) return;

      console.log('✅ api data loaded', result);

      // Handle empty rows: skip to next level in hierarchy if possible
      if (result.rows && result.rows.length === 0 && !result.isLeafLevel) {
        console.log('⚠️ Empty rows at non-leaf level, advancing to next grouping');
        // Always advance *forward* from the current groupBy position in the hierarchy.
        // Using "first unused" would loop: e.g. output→project (replacing 'output' in nav)
        // then project→output (since 'output' is now gone from usedGroupBys).
        setNavigation((nav) => {
          const currentGroupBy = nav[nav.length - 1]?.groupBy;

          // Special case: if current groupBy is 'category' and we got empty rows,
          // it means there are no more subcategories. Switch to 'item' to show items.
          if (currentGroupBy === 'category') {
            const newNav = [...nav];
            newNav[newNav.length - 1] = { ...newNav[newNav.length - 1], groupBy: 'item' };
            return newNav;
          }

          const nextGroupBy = getNextGroupBy(nav);
          if (!nextGroupBy || nextGroupBy === currentGroupBy) {
            // No next group, or nextGroupBy is the same as current
            // This prevents infinite loops.
            return nav;
          }
          const newNav = [...nav];
          newNav[newNav.length - 1] = { ...newNav[newNav.length - 1], groupBy: nextGroupBy };
          return newNav;
        });
        return; // Let the effect re-run with new groupBy
      }

      setData(result);
      setLoading(false);
    };
    fetchData();

    // Cancel stale in-flight fetch when navigation/year changes before it resolves
    return () => { cancelled = true; };
  }, [currentYear, compareYear, navigation]);

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

  // const preprocessedData = useMemo(() => data
  //   .map((d) => {
  //     const amountThisYear = parseFloat(d.AMOUNT_2569.replace(/,/g, '')) || 0;
  //     const amountLastYear = parseFloat(d.AMOUNT_2568.replace(/,/g, '')) || 0;
  //     return {
  //       ...d,
  //       AMOUNT: amountThisYear,
  //       AMOUNT_LASTYEAR: amountLastYear,
  //       DIFF: amountThisYear - amountLastYear,
  //       GROWTH: amountLastYear > 0 ? (amountThisYear - amountLastYear) / amountLastYear : Infinity,
  //       OUTPUT_PROJECT: (d.OUTPUT || d.PROJECT) ? (d.OUTPUT + d.PROJECT) : 'ไม่ระบุโครงการ/ผลผลิต',
  //       MINISTRY: d.MINISTRY.replace(/\([0-9]+\)$/, '').trim(),
  //       ITEM: [
  //         d.ITEM_DESCRIPTION,
  //         d.CATEGORY_LV2,
  //         d.CATEGORY_LV3,
  //         d.CATEGORY_LV4,
  //         d.CATEGORY_LV5,
  //         d.CATEGORY_LV6,
  //       ]
  //         .filter((x) => x)
  //         .join(' - '),
  //     };
  //   }), [data]);

  // const location = useLocation();
  // const history = useHistory();

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
  //   history.push(`/${temp.join('/')}`);
  // };

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
            navigation={navigation}
            navigateTo={navigateTo}
            popNavigationToLevel={popNavigationToLevel}
            setGroupBy={setGroupBy}
            defaultHierarchy={DEFAULT_HIERARCHY}
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
      <ReactTooltip html />
    </FullView>
  );
}

export default App;

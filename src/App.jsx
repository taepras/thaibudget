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

function App() {
  const [data, setData] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isCompareView, setCompareView] = useState(false);
  const [sumWindows, setSumWindows] = useState([0, 0]);

  const [currentYear, setCurrentYear] = useState(2569);
  const [compareYear, setCompareYear] = useState(2568);

  const [navigation, setNavigation] = useState([{ key: null, displayName: 'รวมทุกหน่วยงาน', groupBy: 'ministry' }]);

  const navigateTo = useCallback((key, displayName = null, groupBy = null) => {
    if (displayName === null) displayName = key;
    if (groupBy === null) {
      const currentGroupBy = navigation[navigation.length - 1]?.groupBy;

      // Always advance to the next position in the hierarchy.
      // Using "first unused" would loop when the skip logic has replaced entries:
      // e.g. output→project→category replaces nav entries, so output/project
      // disappear from usedGroupBys and would be picked again on next click.
      if (currentGroupBy === 'ministry') {
        groupBy = 'budgetary_unit';
      } else {
        const currentIdx = DEFAULT_HIERARCHY.indexOf(currentGroupBy);
        groupBy = currentIdx >= 0 ? DEFAULT_HIERARCHY[currentIdx + 1] : null;
      }
    }
    setNavigation([...navigation, { key, groupBy, displayName }]);
  }, [navigation, setNavigation]);

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
        year: [currentYear, compareYear, 2567, 2566, 2565], // todo: dynamic years
        group: navigation[navigation.length - 1].groupBy,
      };
      for (let i = 0; i < navigation.length - 1; i++) {
        if (navigation[i].groupBy && navigation[i + 1].key) {
          const groupByCamelCase = navigation[i].groupBy
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
          console.log('groupByCamelCase', groupByCamelCase, navigation[i + 1].key);
          params[`filter${groupByCamelCase}Id`] = navigation[i + 1].key;
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
          const currentGroupBy = nav[nav.length - 1].groupBy;
          const nextGroupBy = currentGroupBy === 'ministry'
            ? 'budgetary_unit'
            : currentGroupBy === 'budget_plan'
              ? 'output'
              : DEFAULT_HIERARCHY.filter((x) => !nav.map((n) => n.groupBy).includes(x))[0];

          // const currentIdx = DEFAULT_HIERARCHY.indexOf(currentGroupBy);
          // const nextGroupBy = currentIdx >= 0 ? DEFAULT_HIERARCHY[currentIdx + 1] : null;
          if (!nextGroupBy) return nav; // already at deepest level, nothing to skip
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
      <ReactTooltip multiline />
    </FullView>
  );
}

export default App;

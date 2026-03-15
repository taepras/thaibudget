import React, {
  useMemo, useState, useRef, useCallback, useEffect,
} from 'react';
import styled from 'styled-components';
import { abbreviateGrowthRate, abbreviateNumber, signedNumber } from '../utils/numberFormat';
import DropdownLink from './DropdownLink';
import Ui from './BasicUi';

const ListItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;  
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ListItemTitle = styled.div`
  display: flex;
  width: 100%;
  text-align: left;
`
const ListItemDetails = styled.div`
  text-align: right;
  // padding-left: 40px;
  display: flex;
  width: 100%;
`

const ListContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  scrollbar-c
`

const Name = styled.span`
  flex: 1;
  overflow: hidden;
  margin-right: 8px;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const PercentChange = styled.span`
  white-space: nowrap;
  // font-weight: bold;
  // width: 46px;
  text-align: right;
  flex-shrink: 0;
  color: ${(props) => {
    if (props.growth > 0.05) return '#00ac00'; // Significant increase - green
    if (props.growth > 0) return '#88dd88'; // Small increase - light green
    if (props.growth > -0.05) return '#ff9999'; // Small decrease - light red
    return '#cc0000'; // Significant decrease - red
  }};
`;

function Sparkline({
  amounts, years, uid, color = '#00cc66', width = 48, height = 14,
}) {
  if (!amounts || !years || years.length < 2) return null;
  const sortedYears = [...years].sort((a, b) => a - b);
  const values = sortedYears.map((y) => +(amounts[y] ?? 0));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const baseline = minVal <= 0 ? 0 : minVal * (2 / 3);
  const range = maxVal - baseline || 1;
  const pad = 1;
  const id = `spark-${uid}`;

  const toX = (i) => (i / (values.length - 1)) * width;
  const toY = (v) => pad + (1 - (v - baseline) / range) * (height - pad * 2);

  const points = values.map((v, i) => [toX(i), toY(v)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      style={{ flexShrink: 0, alignSelf: 'center', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PercentageChangeList({
  data,
  hoveredItemName = null,
  setHoveredItemName = () => { },
  onItemClick = () => { },
  primaryYear = 2569,
  compareYear = 2568
}) {
  const [sortMode, setSortMode] = useState('amount');

  // Virtual scroll state
  const ROW_HEIGHT = 48; // px — must match ListItem height below
  const OVERSCAN = 8;    // extra rows rendered above/below viewport
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    setViewportHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const sortModeLabels = {
    percent: '% ความเปลี่ยนแปลง',
    diff: 'จำนวนเงินเปลี่ยนแปลง',
    amount: 'จำนวนเงินงบประมาณ',
    alphabet: 'ตัวอักษร',
  };

  const changeData = useMemo(() => {
    if (!data || !data.rows || data.rows.length === 0) return [];

    return data.rows.map((row) => {
      const amountCurrent = +(row.amounts?.[primaryYear] ?? 0);
      const amountPrev = +(row.amounts?.[compareYear] ?? 0);
      const isNew = amountPrev === 0 && amountCurrent > 0;
      const growth = amountPrev > 0
        ? (amountCurrent - amountPrev) / amountPrev
        : (amountCurrent > 0 ? 999999999 : 0);
      return {
        name: row.name,
        id: row.id,
        growth,
        isNew,
        amountCurrent,
        amountPrev,
        diff: amountCurrent - amountPrev,
        amounts: row.amounts,
      };
    }).sort((a, b) => {
      if (sortMode === 'alphabet') {
        return a.name.localeCompare(b.name, 'th');
      }
      // if (a.isNew && !b.isNew) return -1;
      // if (!a.isNew && b.isNew) return 1;
      if (sortMode === 'diff') return b.diff - a.diff;
      if (sortMode === 'amount') return b.amountCurrent - a.amountCurrent;
      return b.growth - a.growth;
    });
  }, [data, primaryYear, compareYear, sortMode]);

  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    setSearchFilter('');
  }, [data]);

  const filteredChangeData = useMemo(() => {
    if (!searchFilter) return changeData;
    const lowerFilter = searchFilter.toLowerCase();
    return changeData.filter((item) => item.name.toLowerCase().includes(lowerFilter));
  }, [changeData, searchFilter]);

  return (
    <Ui.Container>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ marginBottom: 0, flexGrow: 1 }}>
          <Ui.Title style={{ marginBottom: 0, flexGrow: 1 }}>
            รายการในกลุ่มนี้
          </Ui.Title>
          <div
            style={{
              // marginBottom: '12px',
              fontSize: '0.875rem',
              position: 'relative',
              display: 'inline-block',
              opacity: 0.6,
            }}
          >
            <DropdownLink
              label={`เรียงตาม ${sortModeLabels[sortMode]}${compareYear && ['percent', 'diff'].includes(sortMode) ? ` เทียบกับปี ${String(compareYear).slice(-2)}` : ''}`}
              options={[
                { value: 'percent', label: '% ความเปลี่ยนแปลง' },
                { value: 'diff', label: 'จำนวนเงินเปลี่ยนแปลง' },
                { value: 'amount', label: 'จำนวนเงินงบประมาณ' },
                { value: 'alphabet', label: 'ชื่อตัวอักษร (A-Z)' },
              ]}
              value={sortMode}
              onChange={setSortMode}
            />
          </div>
        </div>
        <Ui.TextInput
          type="text"
          placeholder="กรอง..."
          style={{ maxWidth: '144px', width: '100%' }}
          onInput={(e) => setSearchFilter(e.target.value)}
          value={searchFilter || ''}
        />
      </div>

      {changeData.length > 0 && (
        <ListContainer
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ flexGrow: 1 }}

        >
          {(() => {
            // lazy loading
            const totalHeight = filteredChangeData.length * ROW_HEIGHT;
            const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
            const endIdx = Math.min(
              filteredChangeData.length - 1,
              Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
            );
            const visible = filteredChangeData.slice(startIdx, endIdx + 1);
            const padTop = startIdx * ROW_HEIGHT;
            const padBottom = totalHeight - (endIdx + 1) * ROW_HEIGHT;
            return (
              <>
                <div style={{ height: padTop }} />
                {visible.map((item) => {
                  let displayColor = '';
                  if (item.isNew) displayColor = '#00cccc';
                  else if (item.growth > 0.05) displayColor = '#00ac00';
                  else if (item.growth > 0.01) displayColor = '#88dd88';
                  else if (item.growth > -0.01) displayColor = '#999999';
                  else if (item.growth > -0.05) displayColor = '#ff9999';
                  else displayColor = '#cc0000';
                  return (
                    <ListItem
                      key={item.name}
                      style={{
                        // height: ROW_HEIGHT,
                        boxSizing: 'border-box',
                        backgroundColor: hoveredItemName === item.name ? 'rgba(255,255,255,0.1)' : 'transparent',
                        borderRadius: '4px',
                      }}
                      onClick={() => onItemClick(item.name)}
                      onMouseEnter={() => setHoveredItemName(item.name)}
                      onMouseLeave={() => setHoveredItemName(null)}
                    >
                      <ListItemTitle>
                        <Name title={item.name}>{item.name}</Name>
                        <Sparkline amounts={item.amounts} years={data?.years} uid={item.id} color={displayColor} height={12}/>
                      </ListItemTitle>
                      <ListItemDetails>
                        <div style={{display: 'flex', flexGrow: 1, opacity: 0.6}}>
                          {item.amountCurrent.toLocaleString()} บาท
                        </div>
                        <PercentChange growth={item.growth} style={{ color: displayColor }}>
                          {item.isNew ? `รายการใหม่` : `${abbreviateNumber(item.diff, true)} บาท / ${abbreviateGrowthRate(item.growth)}`}
                        </PercentChange>
                      </ListItemDetails>
                    </ListItem>
                  );
                })}
                <div style={{ height: padBottom }} />
              </>
            );
          })()}
        </ListContainer>
      )}
      {changeData.length === 0 && (
        <div style={{ opacity: 0.5 }}>ไม่มีข้อมูล</div>
      )}
    </Ui.Container>
  );
}

export default PercentageChangeList;

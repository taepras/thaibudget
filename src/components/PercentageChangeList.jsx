import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { abbreviateNumber } from '../utils/numberFormat';
import DropdownLink from './DropdownLink';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  // background: #1a1a1a;
  color: white;
  font-size: 11px;
  overflow-y: auto;
  flex-grow: 1;
  position: relative;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  opacity: 0.8;
  word-break: break-word;
`;

const ListItem = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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

const Name = styled.span`
  flex: 1;
  overflow: hidden;
  margin-right: 8px;
  // white-space: nowrap;
  // text-overflow: ellipsis;
`;

const PercentChange = styled.span`
  font-weight: bold;
  white-space: nowrap;
  color: ${(props) => {
    if (props.growth > 0.05) return '#00ac00'; // Significant increase - green
    if (props.growth > 0) return '#88dd88'; // Small increase - light green
    if (props.growth > -0.05) return '#ff9999'; // Small decrease - light red
    return '#cc0000'; // Significant decrease - red
  }};
`;

function PercentageChangeList({
  data,
  filters,
  hierarchyBy,
  hoveredItemName = null,
  setHoveredItemName = () => { },
  onItemClick = () => { },
}) {
  const [sortMode, setSortMode] = useState('percent'); // 'percent', 'amount', 'budget'

  const sortModeLabels = {
    percent: '% ความเปลี่ยนแปลง',
    amount: 'จำนวนเงินเปลี่ยนแปลง',
    budget: 'จำนวนเงินงบประมาณ',
  };
  const changeData = useMemo(() => {
    if (!data || data.length === 0 || !filters || filters.length === 0) {
      return [];
    }

    const activeFilters = filters[0] === 'all' ? filters.slice(1) : filters;

    // hierarchyBy already contains the effective hierarchy from parent
    // Determine the next hierarchy level to compare items at
    const levelToCompare = Math.min(activeFilters.length, hierarchyBy.length - 1);
    const compareField = hierarchyBy[levelToCompare];

    // Filter data: apply all current active filters
    let filtered = data;
    for (let i = 0; i < activeFilters.length; i++) {
      const filterLevel = hierarchyBy[i];
      const filterValue = activeFilters[i];
      filtered = filtered.filter((d) => d[filterLevel] === filterValue);
    }

    // Group by the compare field and calculate totals for each year
    const groups = new Map();

    // If we're at root, we're comparing by the first level (ministries)
    // Otherwise, we're comparing by the next level's children
    filtered.forEach((d) => {
      const groupKey = d[compareField];
      const amount69 = parseFloat(d.AMOUNT_2569?.replace(/,/g, '') || '0') || 0;
      const amount68 = parseFloat(d.AMOUNT_2568?.replace(/,/g, '') || '0') || 0;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { amount69: 0, amount68: 0 });
      }
      const group = groups.get(groupKey);
      group.amount69 += amount69;
      group.amount68 += amount68;
    });

    // Calculate % changes
    const changes = Array.from(groups.entries())
      .map(([name, { amount69, amount68 }]) => {
        const isNew = amount68 === 0 && amount69 > 0;
        const growth = amount68 > 0 ? (amount69 - amount68) / amount68 : (amount69 > 0 ? 1 : 0);
        return {
          name,
          growth,
          isNew,
          amount68,
          amount69,
          diff: amount69 - amount68,
        };
      })
      .sort((a, b) => {
        // New items first, then by selected sort mode
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;

        if (sortMode === 'amount') {
          return b.diff - a.diff;
        }
        if (sortMode === 'budget') {
          return b.amount69 - a.amount69;
        }
        // Default: 'percent'
        return b.growth - a.growth;
      });

    return changes;
  }, [data, filters, hierarchyBy, sortMode]);

  return (
    <Container>
      <Title style={{ marginBottom: 0 }}>
        ความเปลี่ยนแปลง
      </Title>
      <div
        style={{
          marginBottom: '12px',
          fontSize: 12,
          opacity: 1,
          position: 'relative',
          display: 'inline-block',
        }}
      >
        <DropdownLink
          label={`เรียงตาม ${sortModeLabels[sortMode]} เทียบกับปี 68`}
          options={[
            { value: 'percent', label: '% ความเปลี่ยนแปลง' },
            { value: 'amount', label: 'จำนวนเงินเปลี่ยนแปลง' },
            { value: 'budget', label: 'จำนวนเงินงบประมาณ' },
          ]}
          value={sortMode}
          onChange={setSortMode}
        />
      </div>
      {changeData.length > 0 && (
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {changeData.map((item) => {
            let displayValue = '';
            let displayColor = '';

            if (sortMode === 'percent') {
              displayValue = item.isNew ? 'ใหม่' : `${(item.growth * 100).toFixed(1)}%`;
              if (item.isNew) displayColor = '#00cccc'; // Bright green for new items
              else if (item.growth > 0.05) displayColor = '#00ac00';
              else if (item.growth > 0) displayColor = '#88dd88';
              else if (item.growth > -0.05) displayColor = '#ff9999';
              else displayColor = '#cc0000';
            } else if (sortMode === 'amount') {
              displayValue = `${item.diff > 0 ? '+' : ''}${abbreviateNumber(item.diff)}`;
              displayColor = item.diff >= 0 ? '#00ac00' : '#cc0000';
            } else if (sortMode === 'budget') {
              displayValue = abbreviateNumber(item.amount69);
              displayColor = '#00ac00';
            }

            return (
              <ListItem
                key={item.name}
                onClick={() => onItemClick(item.name)}
                onMouseEnter={() => setHoveredItemName(item.name)}
                onMouseLeave={() => setHoveredItemName(null)}
                style={
                  {
                    backgroundColor: hoveredItemName === item.name ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    borderRadius: '4px',
                  }
                }
              >
                <Name title={item.name}>
                  {item.name}
                </Name>
                <PercentChange growth={item.growth} style={{ color: displayColor }}>
                  {displayValue}
                </PercentChange>
              </ListItem>
            );
          })}
        </div>
      )}
      {changeData.length === 0 && (
        <div style={{ opacity: 0.5 }}>ไม่มีข้อมูล</div>
      )}
    </Container>
  );
}

export default PercentageChangeList;

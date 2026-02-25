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

  const primaryYear = data?.years?.[0];
  const compareYear = data?.years?.[1];

  const changeData = useMemo(() => {
    if (!data || !data.rows || data.rows.length === 0) return [];

    return data.rows.map((row) => {
      const amountCurrent = +(row.amounts?.[primaryYear] ?? 0);
      const amountPrev = +(row.amounts?.[compareYear] ?? 0);
      const isNew = amountPrev === 0 && amountCurrent > 0;
      const growth = amountPrev > 0
        ? (amountCurrent - amountPrev) / amountPrev
        : (amountCurrent > 0 ? 1 : 0);
      return {
        name: row.name,
        id: row.id,
        growth,
        isNew,
        amountCurrent,
        amountPrev,
        diff: amountCurrent - amountPrev,
      };
    }).sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      if (sortMode === 'amount') return b.diff - a.diff;
      if (sortMode === 'budget') return b.amountCurrent - a.amountCurrent;
      return b.growth - a.growth;
    });
  }, [data, primaryYear, compareYear, sortMode]);

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
          label={`เรียงตาม ${sortModeLabels[sortMode]}${compareYear ? ` เทียบกับปี ${String(compareYear).slice(-2)}` : ''}`}
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
              displayValue = abbreviateNumber(item.amountCurrent);
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

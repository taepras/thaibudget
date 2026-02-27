import React, { useMemo } from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { abbreviateNumber } from '../utils/numberFormat';
import Ui from './BasicUi';

// const Container = styled.div`
//   display: flex;
//   flex-direction: column;
//   padding: 16px;
//   color: white;
//   font-size: 12px;
//   flex-grow: 1;
// `;

// const Title = styled.h3`
//   margin: 0 0 12px 0;
//   font-size: 14px;
//   opacity: 0.8;
//   word-break: break-word;
// `;

const ChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 176px;
`;

const BarSlot = styled.div`
  height: 140px;
  width: 100%;
  display: flex;
  align-items: flex-end;
`;

const Bar = styled.div`
  flex: 1;
  border-radius: 2px 2px 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 0;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

const BarLabel = styled.div`
  font-size: 10px;
  margin-top: 4px;
  text-align: center;
`;

const BarValue = styled.div`
  font-size: 9px;
  // opacity: 0.6;
  color: white;
`;

function YearComparison({ data, currentYear, onYearClick = () => {} }) {
  const yearData = useMemo(() => {
    if (!data || !data.totals) return [];
    return Object.entries(data.totals)
      .map(([year, amount]) => ({ year, amount }))
      .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  }, [data]);

  const maxAmount = useMemo(
    () => d3.max(yearData, (d) => d.amount) || 1,
    [yearData],
  );

  if (yearData.length === 0) {
    return (
      <Ui.Container>
        <Ui.Title>ข้อมูลรายปี</Ui.Title>
        <div style={{ opacity: 0.5 }}>ไม่มีข้อมูล</div>
      </Ui.Container>
    );
  }

  return (
    <Ui.Container>
      <Ui.Title>
        ข้อมูลรายปีย้อนหลัง
      </Ui.Title>
      <ChartContainer>
        {yearData.map((d) => (
          <div
            key={d.year}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <BarSlot>
              <Bar
                style={{
                  height: `${(d.amount / maxAmount) * 100}%`,
                  minHeight: '6px',
                  background: String(d.year) === String(currentYear) ? '#00ac00' : '#555',
                }}
                title={`${d.year}: ${abbreviateNumber(d.amount)}`}
                onClick={() => onYearClick(parseInt(d.year, 10))}
              >
                <BarValue>{abbreviateNumber(d.amount)}</BarValue>
              </Bar>
            </BarSlot>
            <BarLabel>{d.year}</BarLabel>
          </div>
        ))}
      </ChartContainer>
      {/* <div style={{ fontSize: 11, opacity: 0.6 }}>
        {yearData.map((d) => (
          <div key={d.year}>
            {d.year}
            {': '}
            {abbreviateNumber(d.amount)}
          </div>
        ))}
      </div> */}
    </Ui.Container>
  );
}

export default YearComparison;

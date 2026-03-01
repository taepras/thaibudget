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

const ALL_YEARS = [2565, 2566, 2567, 2568, 2569];

function YearComparison({ data, currentYear, onYearClick = () => {} }) {
  const yearData = useMemo(() => {
    const totals = data?.totals ?? {};
    return ALL_YEARS.map((year) => ({ year, amount: totals[year] ?? 0 }));
  }, [data]);

  const maxAmount = useMemo(
    () => d3.max(yearData, (d) => d.amount) || 1,
    [yearData],
  );

  return (
    <Ui.Container>
      <Ui.Title>
        ข้อมูลรายปีย้อนหลัง
      </Ui.Title>
      <ChartContainer>
        {yearData.map((d) => {
          const hasData = d.amount > 0;
          const isCurrent = String(d.year) === String(currentYear);
          return (
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
                    height: hasData ? `${(d.amount / maxAmount) * 100}%` : '4px',
                    minHeight: hasData ? '6px' : '4px',
                    background: isCurrent ? '#00ac00' : hasData ? '#555' : '#333',
                    opacity: hasData ? 1 : 0.4,
                  }}
                  title={hasData ? `${d.year}: ${abbreviateNumber(d.amount)}` : `${d.year}: ไม่มีข้อมูล`}
                  onClick={() => onYearClick(d.year)}
                >
                  {hasData && <BarValue>{abbreviateNumber(d.amount)}</BarValue>}
                </Bar>
              </BarSlot>
              <BarLabel>{d.year}</BarLabel>
            </div>
          );
        })}
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

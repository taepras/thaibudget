import React, { useMemo } from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  // background: #1a1a1a;
  color: white;
  font-size: 12px;
  overflow-y: auto;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  opacity: 0.8;
  word-break: break-word;
`;

const ChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 180px;
  margin-bottom: 20px;
`;

const BarSlot = styled.div`
  height: 140px;
  width: 100%;
  display: flex;
  align-items: flex-end;
`;

const Bar = styled.div`
  flex: 1;
  background: linear-gradient(to top, #00ac00, #00ac00);
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
  opacity: 0.7;
  color: white;
`;

function YearComparison({ data, filters, hierarchyBy }) {
  // Generate a title based on the focused scope
  const scopeTitle = useMemo(() => {
    if (!filters || filters.length === 0) return 'ข้อมูลรายปี';
    if (filters.length === 1 && filters[0] === 'all') return 'งบประมาณทั้งหมด';
    // Return the last active filter value (the focused item)
    return filters[filters.length - 1];
  }, [filters]);

  const yearData = useMemo(() => {
    if (!data || data.length === 0 || !filters || filters.length === 0) {
      return [];
    }

    // Build the filtering logic based on current filters
    let filtered = data;
    const activeFilters = filters[0] === 'all' ? filters.slice(1) : filters;

    // Apply all active filters (if any)
    for (let i = 0; i < activeFilters.length; i++) {
      const filterLevel = hierarchyBy[i];
      const filterValue = activeFilters[i];
      filtered = filtered.filter((d) => d[filterLevel] === filterValue);
    }

    // Group by fiscal year and sum amounts
    const years = {};

    filtered.forEach((d) => {
      // For year 2026 (69)
      const amount69 = parseFloat(d.AMOUNT_69?.replace(/,/g, '') || '0') || 0;
      if (!years['2026']) years['2026'] = 0;
      years['2026'] += amount69;

      // For year 2025 (68)
      const amount68 = parseFloat(d.AMOUNT_68?.replace(/,/g, '') || '0') || 0;
      if (!years['2025']) years['2025'] = 0;
      years['2025'] += amount68;
    });

    return Object.entries(years)
      .map(([year, amount]) => ({ year, amount }))
      .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  }, [data, filters, hierarchyBy]);

  const maxAmount = useMemo(
    () => d3.max(yearData, (d) => d.amount) || 1,
    [yearData],
  );

  if (yearData.length === 0) {
    return (
      <Container>
        <Title>ข้อมูลรายปี</Title>
        <div style={{ opacity: 0.5 }}>ไม่มีข้อมูล</div>
      </Container>
    );
  }

  return (
    <Container>
      <Title title={scopeTitle}>
        {scopeTitle.length > 30 ? `${scopeTitle.substring(0, 27)}...` : scopeTitle}
      </Title>
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
                style={{ height: `${(d.amount / maxAmount) * 100}%`, minHeight: '6px' }}
                title={`${d.year}: ${d.amount.toLocaleString()}`}
              >
                <BarValue>{d.amount > 0 ? `${(d.amount / 1e9).toFixed(1)}B` : '0'}</BarValue>
              </Bar>
            </BarSlot>
            <BarLabel>{d.year}</BarLabel>
          </div>
        ))}
      </ChartContainer>
      <div style={{ fontSize: 11, opacity: 0.6 }}>
        {yearData.map((d) => (
          <div key={d.year}>
            {d.year}
            {': '}
            {d.amount.toLocaleString()}
            {' '}
            บาท
          </div>
        ))}
      </div>
    </Container>
  );
}

export default YearComparison;

import React, { useMemo } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  // background: #1a1a1a;
  color: white;
  font-size: 11px;
  overflow-y: auto;
  flex-grow: 1;
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
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  align-items: center;

  &:last-child {
    border-bottom: none;
  }
`;

const Name = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
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

function PercentageChangeList({ data, filters, hierarchyBy }) {
  // Generate a title based on the focused scope
  const scopeTitle = useMemo(() => {
    if (!filters || filters.length === 0) return '% เปลี่ยนแปลง';
    if (filters.length === 1 && filters[0] === 'all') return '% เปลี่ยนแปลงรายหน่วยงาน';
    // Return the last active filter value (the focused item)
    return `% เปลี่ยนแปลง: ${filters[filters.length - 1]}`;
  }, [filters]);

  const changeData = useMemo(() => {
    if (!data || data.length === 0 || !filters || filters.length === 0) {
      return [];
    }

    const activeFilters = filters[0] === 'all' ? filters.slice(1) : filters;

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
      const amount69 = parseFloat(d.AMOUNT_69?.replace(/,/g, '') || '0') || 0;
      const amount68 = parseFloat(d.AMOUNT_68?.replace(/,/g, '') || '0') || 0;

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
        const isNew = amount68 === 0;
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
        // New items first, then by growth
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return b.growth - a.growth;
      });

    return changes;
  }, [data, filters, hierarchyBy]);

  if (changeData.length === 0) {
    return (
      <Container>
        <Title>% เปลี่ยนแปลง</Title>
        <div style={{ opacity: 0.5 }}>ไม่มีข้อมูล</div>
      </Container>
    );
  }

  return (
    <Container>
      <Title title={scopeTitle}>
        {scopeTitle.length > 30 ? `${scopeTitle.substring(0, 27)}...` : scopeTitle}
      </Title>
      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {changeData.map((item) => (
          <ListItem key={item.name}>
            <Name title={item.name}>{item.name.length > 25 ? `${item.name.substring(0, 22)}...` : item.name}</Name>
            <PercentChange growth={item.growth}>
              {item.isNew ? 'รายการใหม่' : `${(item.growth * 100).toFixed(1)}%`}
            </PercentChange>
          </ListItem>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          opacity: 0.5,
          fontStyle: 'italic',
        }}
      >
        หมายเหตุ: % เปลี่ยนแปลงจาก 2025 ถึง 2026
      </div>
    </Container>
  );
}

export default PercentageChangeList;

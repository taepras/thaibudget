import React, { useMemo } from 'react';
import styled from 'styled-components';
import { abbreviateNumber, signedNumber } from '../utils/numberFormat';

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
`;

const ModalContainer = styled.div`
  background: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  color: white;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  word-break: break-word;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #999;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const Section = styled.div`
  margin-bottom: 28px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-child {
    border-bottom: none;
  }
`;

const DetailLabel = styled.span`
  color: #999;
  font-size: 0.9rem;
`;

const DetailValue = styled.span`
  font-weight: 600;
  font-size: 0.95rem;
  text-align: right;
  flex-shrink: 0;
  margin-left: 12px;
`;

const ChangeValue = styled(DetailValue)`
  color: ${(props) => {
    if (props.growth == null) return '#999';
    if (props.growth > 0) return '#00ac00';
    if (props.growth < 0) return '#cf0000';
    return '#999';
  }};
`;

const YearTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 0.9rem;

  th {
    text-align: right;
    padding: 8px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #aaa;
    font-weight: 600;
    font-size: 0.85rem;
  }

  th:first-child {
    text-align: left;
  }

  td {
    text-align: right;
    padding: 8px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  td:first-child {
    text-align: left;
    color: #999;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
`;

function ItemDetailsModal({
  item = null,
  years = [],
  primaryYear = null,
  compareYear = null,
  onClose = () => { },
}) {
  const detail = useMemo(() => {
    if (!item) return null;
    const current = +(item.amounts?.[primaryYear] ?? 0);
    const previous = +(item.amounts?.[compareYear] ?? 0);
    const growth = previous > 0 ? (current / previous) - 1 : (current > 0 ? 1 : null);
    const diff = current - previous;

    return {
      id: item.id,
      name: item.name,
      current,
      previous,
      growth,
      diff,
      allAmounts: item.amounts || {},
      obligedData: item.obligedData || {},
    };
  }, [item, primaryYear, compareYear]);

  const sortedYears = useMemo(() => {
    return [...years].sort((a, b) => a - b);
  }, [years]);

  if (!item || !detail) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Backdrop onClick={handleBackdropClick}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{detail.name}</ModalTitle>
          <CloseButton onClick={onClose} title="Close">
            ×
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          {/* ID Section */}
          <Section>
            <SectionTitle>รหัส</SectionTitle>
            <DetailRow>
              <DetailLabel>ID</DetailLabel>
              <DetailValue>{detail.id || 'N/A'}</DetailValue>
            </DetailRow>
          </Section>

          {/* Primary Year Data */}
          <Section>
            <SectionTitle>{primaryYear} (งบประมาณปัจจุบัน)</SectionTitle>
            <DetailRow>
              <DetailLabel>จำนวนเงิน</DetailLabel>
              <DetailValue>{abbreviateNumber(detail.current)} บาท</DetailValue>
            </DetailRow>
          </Section>

          {/* Comparison Data */}
          {compareYear && (
            <Section>
              <SectionTitle>เปรียบเทียบกับ {compareYear}</SectionTitle>
              <DetailRow>
                <DetailLabel>จำนวนเงิน ({compareYear})</DetailLabel>
                <DetailValue>{abbreviateNumber(detail.previous)} บาท</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>เพิ่ม/ลด (จำนวน)</DetailLabel>
                <ChangeValue growth={detail.diff}>
                  {signedNumber(detail.diff, 0)} บาท
                </ChangeValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>เพิ่ม/ลด (%)</DetailLabel>
                <ChangeValue growth={detail.growth}>
                  {detail.growth != null
                    ? `${signedNumber(detail.growth * 100, 1)}%`
                    : 'N/A'}
                </ChangeValue>
              </DetailRow>
            </Section>
          )}

          {/* All Years Data */}
          {sortedYears.length > 0 && (
            <Section>
              <SectionTitle>ข้อมูลงบประมาณทั้งหมด</SectionTitle>
              <YearTable>
                <thead>
                  <tr>
                    <th>ปีงบประมาณ</th>
                    <th>จำนวนเงิน</th>
                    <th>เปลี่ยนแปลง</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedYears.map((year, idx) => {
                    const amount = +(detail.allAmounts[year] ?? 0);
                    const prevYear = idx > 0 ? sortedYears[idx - 1] : null;
                    const prevAmount = prevYear
                      ? +(detail.allAmounts[prevYear] ?? 0)
                      : null;
                    const yearGrowth = prevAmount != null && prevAmount > 0
                      ? (amount / prevAmount) - 1
                      : null;

                    return (
                      <tr key={year}>
                        <td>{year}</td>
                        <td>{abbreviateNumber(amount)} บาท</td>
                        <td>
                          {yearGrowth != null ? (
                            <span style={{
                              color: yearGrowth > 0 ? '#00ac00' : yearGrowth < 0 ? '#cf0000' : '#999',
                            }}>
                              {signedNumber(yearGrowth * 100, 1)}%
                            </span>
                          ) : (
                            <span style={{ color: '#666' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </YearTable>
            </Section>
          )}

          {/* Obliged Data */}
          {sortedYears.some(year => detail.obligedData[year]?.length > 0) && (
            <Section>
              <SectionTitle>ข้อมูลงบประมาณผูกพัน</SectionTitle>
              {sortedYears.map((year) => {
                const obligedData = detail.obligedData[year];

                if (!obligedData || !Array.isArray(obligedData) || obligedData.length === 0) {
                  return null;
                }

                return (
                  <div key={year} style={{ marginBottom: '20px' }}>
                    <DetailLabel style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '0.95rem',
                      color: '#ccc',
                      fontWeight: 600
                    }}>
                      ปีงบประมาณ {year}
                    </DetailLabel>
                    <YearTable>
                      <thead>
                        <tr>
                          <th>ปีผูกพัน</th>
                          <th>จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obligedData.map((entry, idx) => (
                          <tr key={idx}>
                            <td>{entry.fiscalYear}</td>
                            <td>{abbreviateNumber(entry.amount)} บาท</td>
                          </tr>
                        ))}
                      </tbody>
                    </YearTable>
                  </div>
                );
              }).filter(Boolean)}
            </Section>
          )}
        </ModalContent>
      </ModalContainer>
    </Backdrop>
  );
}

export default ItemDetailsModal;

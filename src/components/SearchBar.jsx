import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import styled from 'styled-components';
import Ui from './BasicUi';

const DIMENSION_LABELS = {
  budgetary_unit: 'หน่วยรับงบฯ',
  budget_plan: 'แผนงาน',
  output_project: 'ผลผลิต/โครงการ',
  category: 'ประเภทรายจ่าย',
  item: 'รายการ',
};

const SearchContainer = styled.div`
  position: relative;

  @media screen and (orientation: portrait) {
    position: ${(props) => (props.$mobileExpanded ? 'fixed' : 'absolute')};
    top: ${(props) => (props.$mobileExpanded ? '0' : '8px')};
    right: ${(props) => (props.$mobileExpanded ? '0' : '8px')};
    bottom: ${(props) => (props.$mobileExpanded ? '0' : 'auto')};
    left: ${(props) => (props.$mobileExpanded ? '0' : 'auto')};
    background: ${(props) => (props.$mobileExpanded ? '#1a1a1a' : 'transparent')};
    z-index: ${(props) => (props.$mobileExpanded ? '9999' : 'auto')};
    display: flex;
    flex-direction: column;
  }
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  @media screen and (orientation: portrait) {
    padding: ${(props) => (props.$mobileExpanded ? '12px' : '0')};
    border-bottom: ${(props) => (props.$mobileExpanded ? '1px solid rgba(255,255,255,0.15)' : 'none')};
  }
`;

const SearchInput = styled(Ui.TextInput)`
  width: 200px;
  padding-right: 28px;
  transition: border-color 0.15s, background 0.15s, width 0.2s;

  &:focus {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.15);
    width: 260px;
  }

  @media screen and (orientation: portrait) {
    width: ${(props) => (props.$mobileExpanded ? '100%' : '0')};
    flex: ${(props) => (props.$mobileExpanded ? '1' : 'none')};
    padding: ${(props) => (props.$mobileExpanded ? '6px 28px 6px 10px' : '0')};
    border-color: ${(props) => (props.$mobileExpanded ? 'rgba(255,255,255,0.2)' : 'transparent')};
    background: ${(props) => (props.$mobileExpanded ? 'rgba(255,255,255,0.1)' : 'transparent')};
    overflow: hidden;
    transition: border-color 0.15s, background 0.15s;

    &:focus {
      width: ${(props) => (props.$mobileExpanded ? '100%' : '0')};
    }
  }
`;

const MobileIconButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  font-size: 18px;
  line-height: 1;
  align-items: center;
  justify-content: center;

  @media screen and (orientation: portrait) {
    display: flex;
  }
`;

const MobileCloseButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
  align-items: center;

  @media screen and (orientation: portrait) {
    display: flex;
  }
`;

const LoadingDot = styled.span`
  position: absolute;
  right: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  animation: pulse 1s infinite;

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 100vw;
  max-width: 600px;
  max-height: 600px;
  overflow-y: auto;
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);

  @media screen and (orientation: portrait) {
    position: static;
    width: 100%;
    max-width: none;
    max-height: none;
    flex: 1;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
`;

const DropdownSection = styled.div`
  padding: 0 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

const SectionTitle = styled.div`
  padding: 4px 12px 2px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  background: rgba(255, 255, 255, 0.15);
`;

const ResultItem = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: white;
  padding: 8px 12px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;

const ResultName = styled.span`
  font-size: 0.875rem;
  line-height: 1.3;
`;

const ResultMeta = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyMessage = styled.div`
  padding: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.875rem;
  text-align: center;
`;

const Highlight = styled.mark`
  background: rgba(255, 220, 80, 0.35);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
`;

function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    // eslint-disable-next-line react/no-array-index-key
    new RegExp(`^${escaped}$`, 'i').test(part) ? <Highlight key={i}>{part}</Highlight> : part
  );
}

function formatAmount(amount) {
  if (amount == null) return '';
  return `${Number(amount).toLocaleString()} บาท`;
}

function getResultMeta(result, dimension) {
  const parts = [];
  if (dimension === 'budgetary_unit') {
    const parentNames = result.parent_budgetary_unit_names || [];
    if (parentNames.length > 0) parts.push(parentNames.join(' › '));
  } else {
    const buNames = result.budgetary_unit_names || [];
    if (buNames.length > 0) parts.push(buNames.join(' › '));
  }
  if (result.total_amount != null) parts.push(formatAmount(result.total_amount));
  return parts.join(' · ');
}

function SearchBar({ currentYear, onResultClick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setIsOpen(false);
      return undefined;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = new URL(`${process.env.REACT_APP_API_URL}/api/search`);
        url.searchParams.set('q', query.trim());
        url.searchParams.append('year', currentYear);
        url.searchParams.set('limit', '5');
        const res = await fetch(url);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.groups);
        setIsOpen(true);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Search error:', e);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, currentYear]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleResultClick = useCallback((result, dimension) => {
    setIsOpen(false);
    setMobileExpanded(false);
    setQuery('');
    onResultClick(result, dimension);
  }, [onResultClick]);

  const handleMobileIconClick = useCallback(() => {
    setMobileExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileExpanded(false);
    setIsOpen(false);
  }, []);

  const hasResults = results && Object.values(results).some((g) => g.items.length > 0);
  const DIMENSION_ORDER = ['budgetary_unit', 'budget_plan', 'output_project', 'category', 'item'];

  return (
    <SearchContainer ref={containerRef} $mobileExpanded={mobileExpanded}>
      <SearchInputWrapper $mobileExpanded={mobileExpanded}>
        {mobileExpanded ? (
          <MobileCloseButton type="button" aria-label="ปิด" onClick={handleMobileClose}>
            ←
          </MobileCloseButton>
        ) : (
          <MobileIconButton
            type="button"
            aria-label="ค้นหา"
            onClick={handleMobileIconClick}
          >
            🔍
          </MobileIconButton>
        )}
        <SearchInput
          ref={inputRef}
          type="text"
          placeholder="ค้นหา..."
          value={query}
          $mobileExpanded={mobileExpanded}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setIsOpen(true)}
        />
        {isLoading && <LoadingDot />}
      </SearchInputWrapper>

      {isOpen && (
        <Dropdown $mobileExpanded={mobileExpanded}>
          {!hasResults && !isLoading && (
            <EmptyMessage>ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;</EmptyMessage>
          )}
          {results && DIMENSION_ORDER.map((dim) => {
            const group = results[dim];
            if (!group || !group.items.length) return null;
            return (
              <DropdownSection key={dim}>
                <SectionTitle>{DIMENSION_LABELS[dim] || dim}</SectionTitle>
                {group.items.map((item, idx) => (
                  <ResultItem
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${dim}-${item.id}-${idx}`}
                    type="button"
                    onClick={() => handleResultClick(item, dim)}
                  >
                    <ResultName>{highlightText(item.name, query)}</ResultName>
                    <ResultMeta>{getResultMeta(item, dim)}</ResultMeta>
                  </ResultItem>
                ))}
              </DropdownSection>
            );
          })}
        </Dropdown>
      )}
    </SearchContainer>
  );
}

export default SearchBar;

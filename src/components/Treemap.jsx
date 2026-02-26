import React, {
  useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle,
} from 'react';

import * as d3 from 'd3';
import useDimensions from 'react-cool-dimensions';
import ReactTooltip from 'react-tooltip';
import { useHistory, useLocation } from 'react-router-dom';
import { abbreviateNumber } from '../utils/numberFormat';
import FullView from './FullView';

const BATCH_SIZE = 500;

// Inject spin keyframe once
if (typeof document !== 'undefined' && !document.getElementById('treemap-spin-style')) {
  const s = document.createElement('style');
  s.id = 'treemap-spin-style';
  s.textContent = '@keyframes _tm_spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

function Spinner({ size = 36, thickness = 3 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `${thickness}px solid rgba(255,255,255,0.15)`,
      borderTopColor: 'rgba(255,255,255,0.85)',
      borderRadius: '50%',
      animation: '_tm_spin 0.7s linear infinite',
    }}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-treemap overlay shown when user clicks the "อื่นๆ" bucket
// ---------------------------------------------------------------------------
function TailOverlay({
  items,           // full tail array (pre-mapped {key, value:{id,value,AMOUNT_LASTYEAR,GROWTH}})
  count,           // how many to render right now
  onLoadMore,      // () => void
  onClose,         // () => void
  navigateTo,      // (id, name) => void
  colorScaleMaxValue = 0.3,
  padding = 12,
  gutter = 3,
}) {
  const svgRef = useRef(null);
  const { observe, width, height } = useDimensions({
    onResize: ({ observe: obs, unobserve }) => { unobserve(); obs(); },
  });
  const [isRendering, setIsRendering] = useState(false);

  const colorScale = useMemo(() => d3.scaleLinear()
    .domain([-colorScaleMaxValue, 0, colorScaleMaxValue])
    .range(['#cf0000ff', '#333333', '#00ac00ff'])
    .clamp(true), [colorScaleMaxValue]);

  const getColor = useCallback((node) => {
    if (node?.AMOUNT_LASTYEAR == null || node?.AMOUNT_LASTYEAR === 0) return '#00aaaaff';
    return node?.GROWTH != null ? colorScale(node.GROWTH) : '#666666';
  }, [colorScale]);

  const visibleItems = useMemo(() => {
    const top = items.slice(0, count);
    if (items.length <= count) return top;
    const tail = items.slice(count);
    const tailValue = tail.reduce((s, r) => s + (r.value?.value ?? 0), 0);
    const tailLastYear = tail.reduce((s, r) => s + (r.value?.AMOUNT_LASTYEAR ?? 0), 0);
    top.push({
      key: `อื่นๆ (${tail.length.toLocaleString()} รายการ)`,
      value: {
        id: null,
        value: tailValue,
        AMOUNT_LASTYEAR: tailLastYear,
        GROWTH: tailLastYear > 0 ? (tailValue / tailLastYear) - 1 : null,
        isTailBucket: true,
      },
    });
    return top;
  }, [items, count]);

  useEffect(() => {
    if (!svgRef.current || width === 0 || height === 0) return;
    setIsRendering(true);
    // Defer heavy D3 work one frame so React paints the spinner first
    const raf = requestAnimationFrame(() => {
    const svgH = height - 2 * padding;
    const svgW = width - 2 * padding;

    const nestedData = {
      key: null,
      values: visibleItems,
    };

    const root = d3.hierarchy(nestedData, (d) => d?.values)
      .sum((d) => d?.value?.value ?? 0)
      .sort((a, b) => (b?.data?.value?.value ?? 0) - (a?.data?.value?.value ?? 0))
      .each((d) => {
        if (d.data.value) {
          // eslint-disable-next-line no-param-reassign
          d.AMOUNT_LASTYEAR = d.data.value.AMOUNT_LASTYEAR;
          // eslint-disable-next-line no-param-reassign
          d.GROWTH = d.data.value.GROWTH;
        }
      });

    d3.treemap().size([svgW, svgH]).padding(0)(root);

    const MIN_PX = 3;
    const leaves = root.leaves().filter(
      (d) => (d.x1 - d.x0) >= MIN_PX && (d.y1 - d.y0) >= MIN_PX,
    );

    const svg = d3.select(svgRef.current).select('g.sub-chart');
    const pieces = svg.selectAll('g.sub-piece').data(leaves, (d) => d?.data?.value?.id ?? d?.data?.key);

    const enter = pieces.enter().append('g').attr('class', 'sub-piece')
      .attr('clip-path', (d) => `url(#subclip-${d?.data?.value?.id ?? d?.data?.key?.replaceAll(/[ ()]/g, '')})`)
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .style('cursor', 'pointer')
      .on('mouseenter', (e, d) => {
        const tip = `${d?.data?.key}<br>${abbreviateNumber(d?.value)}<br>เติบโต: ${d?.GROWTH != null ? `${(d.GROWTH * 100).toFixed(1)}%` : 'N/A'}`;
        e.currentTarget.setAttribute('data-tip', tip);
        ReactTooltip.show(e.currentTarget);
      })
      .on('mouseleave', (e) => ReactTooltip.hide(e.currentTarget))
      .on('click', (e, d) => {
        e.stopPropagation();
        if (d?.data?.value?.isTailBucket) {
          onLoadMore();
          return;
        }
        if (d?.data?.value?.id != null) {
          navigateTo(d.data.value.id, d.data.key);
          onClose();
        }
      });

    enter.append('clipPath')
      .attr('id', (d) => `subclip-${d?.data?.value?.id ?? d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
      .append('rect').attr('rx', 2)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0);

    enter.append('rect').attr('class', 'box').attr('rx', 2)
      .style('fill', (d) => getColor(d))
      .attr('stroke', 'black').attr('stroke-width', gutter)
      .attr('width', (d) => Math.max(d.x1 - d.x0, 0))
      .attr('height', (d) => Math.max(d.y1 - d.y0, 0));

    enter.append('text').attr('class', 'label').attr('fill', 'white').attr('font-size', '11px')
      .attr('x', 4).attr('y', 7).attr('dominant-baseline', 'hanging');

    const merged = enter.merge(pieces);

    merged.attr('transform', (d) => `translate(${d.x0},${d.y0})`);
    merged.select('clipPath rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0);
    merged.select('rect.box')
      .style('fill', (d) => (d?.data?.value?.isTailBucket ? '#444' : getColor(d)))
      .attr('width', (d) => Math.max(d.x1 - d.x0, 0))
      .attr('height', (d) => Math.max(d.y1 - d.y0, 0));
    merged.select('text.label')
      .text((d) => (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 14) ? d?.data?.key : '');

    pieces.exit().remove();
      setIsRendering(false);
    }); // end rAF
    // eslint-disable-next-line consistent-return
    return () => cancelAnimationFrame(raf);
  }, [visibleItems, width, height, padding, gutter, getColor, navigateTo, onClose]);

  return (
    // full-area backdrop — click on backdrop closes overlay
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 10,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* inner panel stops propagation so clicking it doesn’t close */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 14px', background: '#111', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            {`อื่นๆ — ${items.length.toLocaleString()} รายการ (แสดง ${Math.min(count, items.length).toLocaleString()})`}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: 'white',
                fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>
        {/* svg area */}
        <div style={{ flexGrow: 1, position: 'relative' }}>
          <div
            ref={observe}
            style={{ position: 'absolute', inset: 0 }}
          >
            <svg ref={svgRef} width={width} height={height}>
              <g transform={`translate(${padding},${padding})`} className="sub-chart" />
            </svg>
          </div>
          {isRendering && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)', pointerEvents: 'none',
            }}>
              <Spinner size={48} thickness={4} />
            </div>
          )}
        </div>
        {/* footer hint */}
        <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.4, padding: '4px 0 6px', flexShrink: 0 }}>
          คลิกนอกพื้นที่เพื่อปิด
        </div>
      </div>
    </div>
  );
}

function TreemapComponent({
  data = [],
  isLoading = true,
  padding = 16,
  gutter = 4,
  filters = ['all'],
  setFilters = () => { },
  hierarchyBy = [],
  groupingAxis = 'MINISTRY',
  setCurrentSum = (sum) => { },
  title = 'รวมทุกหน่วยงาน',
  // fullValue = -1,
  index = 0,
  // isMultipleMaxSum = false,
  sumWindows = [],
  hoveredItemName = null,
  colorScaleMaxValue = 0.3,
  navigateTo = (key, displayName, groupBy) => { }
}, ref) {
  const {
    observe, width, height,
  } = useDimensions({
    onResize: ({ observe, unobserve }) => {
      unobserve();
      observe();
    },
  });

  // const history = useHistory();

  const svgRef = useRef(null);
  const navigateToRef = useRef(navigateTo);
  useEffect(() => { navigateToRef.current = navigateTo; }, [navigateTo]);
  const isNavigatingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    triggerItemClick: (itemName) => {
      // Find the element with matching data key and trigger click
      const elements = svgRef.current?.querySelectorAll('.treemap-piece');
      if (!elements) return;

      elements.forEach((el) => {
        // Get the D3 node's data
        const d3Node = d3.select(el);
        const nodeData = d3Node.datum();
        if (nodeData?.data?.key === itemName) {
          // Dispatch click event on this element
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    },
  }), []);

  // const [data, setData] = useState([]);
  const [sum, setSum] = useState(-1); // or 'bar'

  const colorScale = useMemo(() => d3.scaleLinear()
    .domain([-colorScaleMaxValue, 0, colorScaleMaxValue]) // -50% to +50% growth
    .range(['#cf0000ff', '#333333', '#00ac00ff'])
    .clamp(true), [colorScaleMaxValue]);

  const getNodeColor = useCallback((node) => {
    // New items (only in 2026, no amount in 2025) get the greenest color
    const lastYear = node?.AMOUNT_LASTYEAR;
    if (lastYear == null || lastYear === 0) {
      return '#00aaaaff'; // Brightest green for new items
    }
    // Existing items use the growth-based color scale
    return node?.GROWTH != null ? colorScale(node.GROWTH) : '#666666';
  }, [colorScale]);

  const tailItemsRef = useRef([]);

  const dataKey = useMemo(() => (
    `${data?.group || groupingAxis}|${hierarchyBy.join('>')}|${filters.join('>')}`
  ), [data?.group, groupingAxis, hierarchyBy, filters]);

  // convert to d3 nest format: { key, values: [{ key, value }] }
  // Cap at MAX_TILES items — beyond this the treemap layout + DOM work freezes the page.
  // Tail items are merged into a single "อื่นๆ" bucket.
  const MAX_TILES = 500;
  const nestedData = useMemo(() => {
    const primaryYear = data.years?.[0];
    const compareYear = data.years?.[1];
    if (!data.rows) return { key: null, values: [] };

    const mapped = data.rows.map((r) => ({
      key: r.name,
      value: {
        id: r.id,
        value: +(r.amounts?.[primaryYear] ?? 0),
        AMOUNT_LASTYEAR: +(r.amounts?.[compareYear] ?? 0),
        GROWTH: r.amounts?.[compareYear] > 0
          ? (r.amounts[primaryYear] / r.amounts[compareYear]) - 1
          : null,
      },
    }));

    // Sort descending by primary-year value so we keep the largest tiles
    mapped.sort((a, b) => b.value.value - a.value.value);

    if (mapped.length <= MAX_TILES) {
      tailItemsRef.current = [];
      return { key: null, values: mapped };
    }

    const top = mapped.slice(0, MAX_TILES);
    const tail = mapped.slice(MAX_TILES);
    tailItemsRef.current = tail; // keep full tail for overlay
    const tailValue = tail.reduce((s, r) => s + r.value.value, 0);
    const tailLastYear = tail.reduce((s, r) => s + r.value.AMOUNT_LASTYEAR, 0);
    top.push({
      key: `อื่นๆ (${tail.length} รายการ)`,
      value: {
        id: null,
        value: tailValue,
        AMOUNT_LASTYEAR: tailLastYear,
        GROWTH: tailLastYear > 0 ? (tailValue / tailLastYear) - 1 : null,
        isTailBucket: true,
      },
    });
    return { key: null, values: top };
  }, [data]);

  const [growth, setGrowth] = useState(null);
  const [overlayCount, setOverlayCount] = useState(BATCH_SIZE);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [isNavLoading, setIsNavLoading] = useState(false);
  const navLoadTimerRef = useRef(null);

  // Reset overlay when data changes
  useEffect(() => { setOverlayOpen(false); setOverlayCount(BATCH_SIZE); }, [data]);

  useEffect(() => {
    // New data arrived — safe to allow D3 effect to run again
    isNavigatingRef.current = false;
    // Timer and isNavLoading are cleared at the END of the D3 effect so the spinner
    // covers both the fetch wait AND the rendering phase.
  }, [data]);

  useEffect(() => {
    const s = nestedData.values.reduce((a, b) => a + (b.value?.value ?? b.value ?? 0), 0);
    const lastYearSum = nestedData.values.reduce((a, b) => a + (b.value?.AMOUNT_LASTYEAR || 0), 0);
    const g = lastYearSum > 0 ? (s / lastYearSum) - 1 : null;
    console.log('sum', s, 'lastYear', lastYearSum, 'growth', g, data);
    // Object.is handles NaN === NaN correctly (true), preventing an infinite loop
    if (!Object.is(sum, s)) { setCurrentSum(s); }
    setSum(s);
    setGrowth(g);
  }, [nestedData, setCurrentSum, sum]);

  useEffect(() => {
    if (!svgRef.current) return;

    d3.select(svgRef.current)
      .selectAll('g.treemap-piece')
      .select('rect.box')
      .attr('stroke', (d) => {
        if (!hoveredItemName) return 'black';
        return d?.data?.key === hoveredItemName ? 'white' : 'black';
      })
      .attr('stroke-width', (d) => {
        if (!hoveredItemName) return gutter;
        return d?.data?.key === hoveredItemName ? gutter * 2 : gutter;
      });
  }, [hoveredItemName, gutter]);

  useEffect(() => {
    if (!svgRef.current) return;
    // While a click-zoom is in flight, don't touch the DOM —
    // let the zoom animation hold until new data arrives.
    if (isNavigatingRef.current) return;

    const svgHeight = svgRef.current.clientHeight;

    const getValue = (d) => d?.value?.value ?? d?.value ?? 0;

    const root = d3.hierarchy(nestedData, (d) => d?.values)
      .sum((d) => getValue(d))
      .sort((a, b) => getValue(b.data) - getValue(a.data))
      // eslint-disable-next-line no-param-reassign
      .each((d) => {
        if (d.data.value) {
          // eslint-disable-next-line no-param-reassign
          d.AMOUNT_LASTYEAR = d.data.value.AMOUNT_LASTYEAR;
          // eslint-disable-next-line no-param-reassign
          d.GROWTH = d.data.value.GROWTH;
        }
      });

    const newSum = nestedData.values.reduce((a, b) => a + (b.value?.value ?? b.value ?? 0), 0);

    const itemCount = nestedData.values.length;
    const isLargeDataset = itemCount > MAX_TILES / 2;
    const transitionDuration = isLargeDataset ? 0 : 300;

    // const newSumWin = [...sumWindows];
    // const idx0 = newSumWin.indexOf(sum);
    // if (idx0 !== -1) {
    //   newSumWin[idx0] = newSum;
    // }
    // const fullVal = d3.max(newSumWin);
    const fullVal = data.totals?.[data.years?.[0]];
    const treeFullArea = (width - 2 * padding) * (svgHeight - 2 * padding);
    const treeAspect = (width - 2 * padding) / (svgHeight - 2 * padding);
    const treeCurrentArea = (newSum / (fullVal || 1)) * treeFullArea;
    const treeH = fullVal <= 0 ? svgHeight - 2 * padding : Math.sqrt(treeCurrentArea / treeAspect);
    const treeW = fullVal <= 0 ? width - 2 * padding : treeCurrentArea / treeH;

    const treemap = d3.treemap()
      .size([treeW, treeH])
      .padding(0);
    // .round(true);

    treemap(root);

    // Filter out sub-pixel tiles — they're invisible and each costs 5 DOM nodes + a GPU <mask>
    const MIN_TILE_PX = 3;
    const visibleLeaves = root.leaves().filter(
      (d) => (d.x1 - d.x0) >= MIN_TILE_PX && (d.y1 - d.y0) >= MIN_TILE_PX,
    );

    const svg = d3.select(svgRef.current).select('g.chart');

    const treemapPieceGroup = svg
      .selectAll('g.treemap-piece')
      .data(visibleLeaves, (d) => `${dataKey}-${d?.data?.value?.id ?? d?.data?.key}`);

    const treemapPieceGroupEnter = treemapPieceGroup
      .enter()
      .append('g')
      .attr('class', 'treemap-piece')
      .attr('id', (d) => `${d?.data?.key?.replaceAll(/[ ()]/g, '')}-${index}`)
      .attr('clip-path', (d) => `url(#clip-${d?.data?.key?.replaceAll(/[ ()]/g, '')}-${index})`)
      .attr('transform', (d) => `translate(${d.x0 || 0},${d.y0 || 0})`);

    treemapPieceGroupEnter
      .append('rect')
      .attr('class', 'box')
      .attr('rx', 3)
      .style('fill', (d) => getNodeColor(d))
      .attr('width', (d) => (d.x1 - d.x0) || 0)
      .attr('height', (d) => (d.y1 - d.y0) || 0);

    treemapPieceGroupEnter
      .append('clipPath')
      .attr('id', (d) => `clip-${d?.data?.key?.replaceAll(/[ ()]/g, '')}-${index}`)
      .append('rect')
      .attr('rx', 3)
      .attr('width', (d) => (d.x1 - d.x0) || 0)
      .attr('height', (d) => (d.y1 - d.y0) || 0);

    treemapPieceGroupEnter
      .append('text')
      .attr('class', 'text-name')
      .attr('font-size', '12px')
      .attr('fill', 'white');

    treemapPieceGroupEnter
      .append('text')
      .attr('class', 'text-value')
      .attr('font-size', '12px')
      .attr('fill', 'white');

    treemapPieceGroupEnter
      .append('text')
      .attr('class', 'text-growth')
      .attr('font-size', '12px')
      .attr('fill', 'white');

    const treemapPieceMerged = treemapPieceGroupEnter.merge(treemapPieceGroup);

    treemapPieceMerged
      .on('mouseenter', (e, d) => {
        const nodeGrowth = d?.GROWTH;
        const lastYear = d?.AMOUNT_LASTYEAR;
        const growthText = nodeGrowth != null ? `${(nodeGrowth * 100).toFixed(1)}%` : 'N/A';
        const lastYearText = lastYear != null ? abbreviateNumber(lastYear) : 'N/A';
        const tip = `${d?.data?.key}<br>${abbreviateNumber(d?.value)}<br>ปีที่แล้ว: ${lastYearText}<br>เติบโต: ${growthText}`;
        e.currentTarget.setAttribute('data-tip', tip);
        ReactTooltip.show(e.currentTarget);
      })
      .on('mouseleave', (e) => {
        ReactTooltip.hide(e.currentTarget);
      })
      .on('click', null)
      .on('click', (e, d) => {
        const newArea = treeFullArea;
        const newH = Math.sqrt(newArea / treeAspect);
        const newW = newArea / newH;

        const dx = d.x0;
        const dy = d.y0;
        const sx = newW / (d.x1 - d.x0);
        const sy = newH / (d.y1 - d.y0);

        d3.select(this).classed('selected', true);

        if (isLargeDataset) {
          treemapPieceMerged
            .attr('transform', (p) => `translate(${(p.x0 - dx) * sx},${(p.y0 - dy) * sy})`);
          treemapPieceMerged.select('rect.box')
            .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
            .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));
          treemapPieceMerged.select('clipPath rect')
            .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
            .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));
        } else {
          treemapPieceMerged
            .transition().duration(300)
            .attr('transform', (p) => `translate(${(p.x0 - dx) * sx},${(p.y0 - dy) * sy})`);
          treemapPieceMerged.select('rect.box')
            .transition().duration(300)
            .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
            .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));
          treemapPieceMerged.select('clipPath rect')
            .transition().duration(300)
            .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
            .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));
        }

        // "อื่นๆ" bucket — play zoom animation then open overlay
        if (d?.data?.value?.isTailBucket) {
          setTimeout(() => setOverlayOpen(true), isLargeDataset ? 0 : 300);
          return;
        }

        isNavigatingRef.current = true;
        navLoadTimerRef.current = setTimeout(() => {
          if (isNavigatingRef.current) setIsNavLoading(true);
        }, 300);
        setTimeout(() => {
          navigateToRef.current(d?.data?.value?.id, d?.data?.key);
        }, transitionDuration);
      });

    if (isLargeDataset) {
      treemapPieceMerged
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
        .attr('opacity', 1);
      treemapPieceMerged.select('rect.box')
        .attr('rx', 3)
        .style('fill', (d) => getNodeColor(d))
        .attr('stroke', 'black')
        .attr('stroke-width', gutter)
        .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
        .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));
      treemapPieceMerged.select('clipPath rect')
        .attr('rx', 3)
        .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
        .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));
    } else {
      treemapPieceMerged
        .transition().duration(300)
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
        .attr('opacity', 1);
      treemapPieceMerged.select('rect.box')
        .transition().duration(300)
        .attr('rx', 3)
        .style('fill', (d) => getNodeColor(d))
        .attr('stroke', (d) => {
          if (!hoveredItemName) return 'black';
          return d?.data?.key === hoveredItemName ? 'white' : 'black';
        })
        .attr('stroke-width', (d) => {
          if (!hoveredItemName) return gutter;
          return d?.data?.key === hoveredItemName ? gutter * 2 : gutter;
        })
        .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
        .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));
      treemapPieceMerged.select('clipPath rect')
        .transition().duration(300)
        .attr('rx', 3)
        .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
        .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));
    }

    treemapPieceMerged.select('text.text-name')
      .attr('x', 5)
      .attr('y', 8)
      .attr('dominant-baseline', 'hanging')
      .text((d) => (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 14) ? d?.data?.key : '');

    treemapPieceMerged.select('text.text-value')
      .attr('x', 5)
      .attr('y', 24)
      .attr('fill-opacity', 0.6)
      .attr('dominant-baseline', 'hanging')
      .attr('opacity', 1)
      .text((d) => (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 28) ? abbreviateNumber(d.value) : '');

    treemapPieceMerged.select('text.text-growth')
      .attr('x', 5)
      .attr('y', 40)
      .attr('fill-opacity', 0.6)
      .attr('dominant-baseline', 'hanging')
      .attr('opacity', 1)
      .text((d) => {
        if (d.x1 - d.x0 <= 40 || d.y1 - d.y0 <= 44) return '';
        const itemGrowth = d?.GROWTH;
        return itemGrowth != null ? `${itemGrowth >= 0 ? '+' : ''}${(itemGrowth * 100).toFixed(1)}%` : '';
      })
      .attr('fill', (d) => (d?.GROWTH > 0 ? '#4f4' : d?.GROWTH < 0 ? '#f44' : 'white'));

    treemapPieceGroup.exit()
      .transition()
      .delay(transitionDuration)
      .duration(isLargeDataset ? 0 : 600)
      .attr('opacity', 0)
      .remove();

    // Dismiss the nav spinner after the next paint — at this point D3 DOM work
    // is done and the browser will render the new frame before the callback fires.
    const clearNavRaf = requestAnimationFrame(() => {
      setIsNavLoading(false);
      if (navLoadTimerRef.current) { clearTimeout(navLoadTimerRef.current); navLoadTimerRef.current = null; }
    });
    return () => cancelAnimationFrame(clearNavRaf);
  }, [
    dataKey,
    svgRef,
    nestedData,
    width,
    height,
    padding,
    gutter,
    index,
    sumWindows,
    getNodeColor,
    data,
    hoveredItemName,
  ]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          paddingLeft: 18,
          fontSize: 12,
          marginBottom: -padding + 4,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingRight: 18,
        }}
      >
        <div>
          <b style={{ whiteSpace: 'nowrap', fontSize: 16 }}>
            {title}
          </b>
          <br />
          <span style={{ opacity: 0.6 }}>
            {sum.toLocaleString()} บาท
            {growth != null && (
              <span
                style={{
                  color: growth > 0 ? '#4f4' : growth < 0 ? '#f44' : 'inherit',
                  marginLeft: '8px',
                }}
              >
                {'('}
                {(growth >= 0 ? '+' : '') + (growth * 100).toFixed(1)}
                {'% จากปีก่อน)'}
              </span>
            )}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 11,
            opacity: 0.6,
            gap: '6px',
            marginTop: 4,
          }}
        >
          <span>{`-${colorScaleMaxValue * 100}%`}</span>
          <div
            style={{
              width: '80px',
              height: '10px',
              background: 'linear-gradient(to right, #cf0000, #333333, #00ac00)',
            }}
          />
          <span>{`+${colorScaleMaxValue * 100}%`}</span>
        </div>
      </div>
      {isLoading
        && (
          <FullView
            style={{
              backgroundColor: '#000c',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              flexDirection: 'column',
            }}
          >
            <Spinner size={48} thickness={4} />
            <span style={{ opacity: 0.7, fontSize: 13 }}>กำลังโหลด...</span>
          </FullView>
        )}
      {isNavLoading && !isLoading && (
        <FullView
          style={{
            backgroundColor: '#000c',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexDirection: 'column',
            pointerEvents: 'none',
          }}
        >
          <Spinner size={48} thickness={4} />
          <span style={{ opacity: 0.7, fontSize: 13 }}>กำลังโหลด...</span>
        </FullView>
      )}

      <div
        style={{
          height: padding,
          marginBottom: -padding,
          background: 'linear-gradient(#000f, #0000)',
          width: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
          ref={observe}
        >
          <svg ref={svgRef} width={width} height={height}>
            <g transform={`translate(${padding}, ${padding})`} className="chart" />
          </svg>
        </div>
        {overlayOpen && tailItemsRef.current.length > 0 && (
          <TailOverlay
            items={tailItemsRef.current}
            count={overlayCount}
            onLoadMore={() => setOverlayCount((c) => c + BATCH_SIZE)}
            onClose={() => setOverlayOpen(false)}
            navigateTo={navigateToRef.current}
            colorScaleMaxValue={colorScaleMaxValue}
            padding={padding}
            gutter={gutter}
          />
        )}
      </div>
      <div
        style={{
          height: padding,
          marginTop: -padding,
          background: 'linear-gradient(#0000, #000f)',
          width: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default forwardRef(TreemapComponent);

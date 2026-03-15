import React, {
  useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle,
} from 'react';

import * as d3 from 'd3';
import useDimensions from 'react-cool-dimensions';
import ReactTooltip from 'react-tooltip';

import { abbreviateGrowthRate, abbreviateNumber, signedNumber } from '../utils/numberFormat';
import FullView from './FullView';
import Spinner from './Spinner';
import Ui from './BasicUi';
import ItemDetailsModal from './ItemDetailsModal';

const BATCH_SIZE = 500;

// Inject spin keyframe once
if (typeof document !== 'undefined' && !document.getElementById('treemap-spin-style')) {
  const s = document.createElement('style');
  s.id = 'treemap-spin-style';
  s.textContent = '@keyframes _tm_spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

const MAX_TILES = 500;

// ---------------------------------------------------------------------------
// Sub-treemap overlay shown when user clicks the "อื่นๆ" bucket
// ---------------------------------------------------------------------------
function TailOverlay({
  items,           // full tail array (pre-mapped {key, value:{id,value,AMOUNT_LASTYEAR,GROWTH}})
  count,           // how many to render right now
  onLoadMore,      // () => void
  onClose,         // () => void
  navigateTo,      // (id, name) => void
  onItemClick,     // (item) => void - called when leaf level item is clicked
  dataRows = [],   // original data rows for looking up full item data
  isLeafLevel = false,
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

    const merged = svg.selectAll('g.sub-piece')
      .data(leaves, (d) => `gsg-${d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
      .join(
        (enter) => {
          const g = enter.append('g').attr('class', 'sub-piece')
            .attr('clip-path', (d) => `url(#subclip-${d?.data?.value?.id ?? d?.data?.key?.replaceAll(/[ ()]/g, '')})`)
            .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
            .style('cursor', isLeafLevel ? 'default' : 'pointer')
            .on('mouseenter', (e, d) => {
              d3.select(e.currentTarget)
                .select('rect.box')
                .style('filter', 'drop-shadow(0 0 3px rgba(255,255,255,0.8))');

              const tip = `${d?.data?.key}<br>${abbreviateNumber(d?.value)}<br>เติบโต: ${d?.GROWTH != null ? `${(d.GROWTH * 100).toFixed(1)}%` : 'ใหม่'}`;
              e.currentTarget.setAttribute('data-html', 'true');
              e.currentTarget.setAttribute('data-tip', tip);
              ReactTooltip.show(e.currentTarget);
            })
            .on('mouseleave', (e) => {
              d3.select(e.currentTarget)
                .select('rect.box')
                .style('filter', null);
              ReactTooltip.hide(e.currentTarget);
            })
            .on('click', (e, d) => {
              e.stopPropagation();
              if (d?.data?.value?.isTailBucket) {
                onLoadMore();
                return;
              }
              if (isLeafLevel) {
                const itemKey = d?.data?.key;
                const itemId = d?.data?.value?.id;
                const itemData = dataRows.find((row) => row.name === itemKey && row.id === itemId);
                if (itemData && onItemClick) {
                  onItemClick(itemData);
                }
                return;
              }
              if (d?.data?.value?.id != null) {
                navigateTo(d.data.value.id, d.data.key, { isTerminal: d.data.value.isTerminal });
                onClose();
              }
            });

          g.append('clipPath')
            .attr('id', (d) => `subclip-${d?.data?.value?.id ?? d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
            .append('rect').attr('rx', 2)
            .attr('width', (d) => d.x1 - d.x0)
            .attr('height', (d) => d.y1 - d.y0);

          g.append('rect').attr('class', 'box').attr('rx', 2)
            .style('fill', (d) => getColor(d))
            .attr('stroke', 'black').attr('stroke-width', gutter)
            .attr('width', (d) => Math.max(d.x1 - d.x0, 0))
            .attr('height', (d) => Math.max(d.y1 - d.y0, 0));

          g.append('text').attr('class', 'label').attr('fill', 'white').attr('font-size', '11px')
            .attr('x', 4).attr('y', 7).attr('dominant-baseline', 'hanging');

          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      );

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
      setIsRendering(false);
    }); // end rAF
    // eslint-disable-next-line consistent-return
    return () => cancelAnimationFrame(raf);
  }, [visibleItems, width, height, padding, gutter, getColor, navigateTo, isLeafLevel, onLoadMore, onClose, onItemClick, dataRows]);

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
  title = 'รวมทุกหน่วยงาน',
  hoveredItemName = null,
  colorScaleMaxValue = 0.3,
  navigateTo = (key, displayName, groupBy, metadata) => { },
  isLeafLevel = false,
  primaryYear = 0,
  compareYear = 0,
}, ref) {
  const {
    observe, width, height,
  } = useDimensions({
    onResize: ({ observe, unobserve }) => {
      unobserve();
      observe();
    },
  });

  const svgRef = useRef(null);
  const navigateToRef = useRef(navigateTo);
  useEffect(() => { navigateToRef.current = navigateTo; }, [navigateTo]);
  const isLeafLevelRef = useRef(isLeafLevel);
  useEffect(() => { isLeafLevelRef.current = isLeafLevel; }, [isLeafLevel]);
  const hoveredItemNameRef = useRef(hoveredItemName);
  useEffect(() => { hoveredItemNameRef.current = hoveredItemName; }, [hoveredItemName]);
  const nestedDataRef = useRef(null);

  useImperativeHandle(ref, () => ({
    triggerItemClick: (itemName) => {
      if (isLeafLevelRef.current) return;
      const currentData = nestedDataRef.current;
      if (!currentData?.values) return;
      for (const item of currentData.values) {
        if (item.key === itemName) {
          navigateToRef.current(item.value.id, item.key, { isTerminal: item.value.isTerminal });
          return;
        }
      }
    },
  }), []);

  const tailItemsRef = useRef([]);

  const colorScale = useMemo(() => d3.scaleLinear()
    .domain([-colorScaleMaxValue, 0, colorScaleMaxValue])
    .range(['#cf0000ff', '#222222', '#00ac00ff'])
    .clamp(true), [colorScaleMaxValue]);

  const getNodeColor = useCallback((node) => {
    if (node?.AMOUNT_LASTYEAR == null || node?.AMOUNT_LASTYEAR === 0) return '#00aaaaff';
    return node?.GROWTH != null ? colorScale(node.GROWTH) : '#666666';
  }, [colorScale]);

  const nestedData = useMemo(() => {
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
        isTerminal: r.isTerminal, // Flag from backend indicating if category has no children
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
  }, [data, primaryYear, compareYear]);

  useEffect(() => {
    nestedDataRef.current = nestedData;
  }, [nestedData]);

  useEffect(() => {
    dataRowsRef.current = data.rows || [];
  }, [data.rows]);

  const [overlayCount, setOverlayCount] = useState(BATCH_SIZE);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const dataRowsRef = useRef([]);
  // Set to true just before navigating from a zoom-click so the render effect
  // can crossfade the new chart over the frozen zoomed state.
  const isFromZoomRef = useRef(false);
  // Only trigger crossfade when `data` is new — not when other deps like isLeafLevel
  // change in the intermediate render that fires before the fetch completes.
  const prevDataRef = useRef(data);
  // While true, mouseenter effects (drop-shadow, tooltip) and stroke highlights are
  // suppressed. Cleared on the first mousemove after the crossfade has fully settled.
  const suppressHoverRef = useRef(false);

  useEffect(() => {
    // When navigating via a zoom-click, leave g.chart frozen at its zoomed scale —
    // the render effect will crossfade the new chart in and then clean up.
    // For all other data changes (initial load, filter, year change) reset immediately.
    if (svgRef.current && !isFromZoomRef.current) {
      d3.select(svgRef.current).select('g.chart')
        .interrupt()
        .attr('transform', 'translate(0,0) scale(1,1)')
        .style('opacity', 1)
        .style('pointer-events', null);
    }
    setOverlayOpen(false);
    setOverlayCount(BATCH_SIZE);
  }, [data]);

  useEffect(() => {
    // update stroke
    if (!svgRef.current || isLeafLevel) return;
    if (suppressHoverRef.current) return;

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
  }, [hoveredItemName, gutter, isLeafLevel]);

  // Zoom back to original scale when overlay closes
  useEffect(() => {
    // update overlay status
    if (overlayOpen || !svgRef.current) return;

    const chartGroup = d3.select(svgRef.current).select('g.chart');
    const svg = chartGroup;
    chartGroup
      .transition().duration(300)
      .attr('transform', 'translate(0,0) scale(1,1)')
      .on('end', () => {
        // Restore interactivity and text after zoom animation
        svg.selectAll('g.treemap-piece').attr('pointer-events', 'auto');
        svg.selectAll('text').attr('opacity', 1);
      });
  }, [overlayOpen]);

  useEffect(() => {
    if (!svgRef.current) return;

    const performRender = () => {
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

    const transitionDuration = 200;

    // Always render at proportional scale into g.chart
    const fullVal = data.totals?.[data.years?.[0]];
    const treeFullArea = (width - 2 * padding) * (svgHeight - 2 * padding);
    const treeAspect = (width - 2 * padding) / (svgHeight - 2 * padding);
    const treeCurrentArea = (newSum / (fullVal || 1)) * treeFullArea;
    const treeH = fullVal <= 0 ? svgHeight - 2 * padding : Math.sqrt(treeCurrentArea / treeAspect);
    const treeW = fullVal <= 0 ? width - 2 * padding : treeCurrentArea / treeH;

    const treemap = d3.treemap()
      .size([treeW, treeH])
      .padding(0);

    treemap(root);

    // Filter out sub-pixel tiles — they're invisible and each costs 5 DOM nodes + a GPU <mask>
    const MIN_TILE_PX = 3;
    const visibleLeaves = root.leaves().filter(
      (d) => (d.x1 - d.x0) >= MIN_TILE_PX && (d.y1 - d.y0) >= MIN_TILE_PX,
    );

    const isCrossFade = isFromZoomRef.current && data !== prevDataRef.current;
    if (data !== prevDataRef.current) prevDataRef.current = data;
    if (!isCrossFade) isFromZoomRef.current = false;

    const currentChart = d3.select(svgRef.current).select('g.chart');
    const renderChart = isCrossFade
      ? d3.select(svgRef.current).select('g.chart-next')
      : currentChart;

    renderChart.selectAll('*').remove();
    if (isCrossFade) {
      // New tiles start invisible on top; old zoomed chart is kept as background
      renderChart
        .attr('transform', 'translate(0,0) scale(1,1)')
        .style('opacity', 0)
        .style('pointer-events', 'none');
      currentChart.style('pointer-events', 'none');
    }

    const treemapPieceMerged = renderChart
      .selectAll('g.treemap-piece')
      .data(visibleLeaves, (d) => `g-${d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'treemap-piece')
            .attr('id', (d) => `${d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
            .attr('clip-path', (d) => `url(#clip-${d?.data?.key?.replaceAll(/[ ()]/g, '')})`)
            .attr('transform', (d) => `translate(${d.x0 || 0},${d.y0 || 0})`)
            .style('cursor', isLeafLevel ? 'default' : 'pointer');

          g.append('rect')
            .attr('class', 'box')
            .attr('rx', 3)
            .style('fill', (d) => getNodeColor(d))
            .attr('width', (d) => (d.x1 - d.x0) || 0)
            .attr('height', (d) => (d.y1 - d.y0) || 0);

          g.append('clipPath')
            .attr('id', (d) => `clip-${d?.data?.key?.replaceAll(/[ ()]/g, '')}`)
            .append('rect')
            .attr('rx', 3)
            .attr('width', (d) => (d.x1 - d.x0) || 0)
            .attr('height', (d) => (d.y1 - d.y0) || 0);

          g.append('text')
            .attr('class', 'text-name')
            .attr('font-size', '0.875rem')
            .attr('fill', 'white');

          g.append('text')
            .attr('class', 'text-value')
            .attr('font-size', '0.875rem')
            .attr('fill', 'white');

          g.append('text')
            .attr('class', 'text-growth')
            .attr('font-size', '0.875rem')
            .attr('fill', 'white');

          return g;
        },
        (update) => update,
        (exit) => exit
          .transition()
          .delay(transitionDuration)
          .duration(600)
          .attr('opacity', 0)
          .remove(),
      );

    treemapPieceMerged
      .on('mouseenter', (e, d) => {
        if (suppressHoverRef.current) return;
        if (!isLeafLevelRef.current) {
          d3.select(e.currentTarget)
            .select('rect.box')
            .style('filter', 'drop-shadow(0 0 3px rgba(255,255,255,0.8))');
        }

        const nodeGrowth = d?.GROWTH ?? 0;
        const lastYear = d?.AMOUNT_LASTYEAR;
        const growthText = nodeGrowth != null
          ? `<span style="color:${nodeGrowth > 0 ? '#25d925' : '#f11919'}">${abbreviateGrowthRate(nodeGrowth)}</span>`
          : 'N/A';
        const lastYearText = lastYear != null ? abbreviateNumber(lastYear) : 'N/A';
        const tip = [
          `<div><b>${d?.data?.key}</b></div>`,
          `<div style="opacity: 0.6">${primaryYear}: ${abbreviateNumber(d?.value)} บาท</div>`,
          `<div style="opacity: 0.6">${compareYear}: ${lastYearText} บาท</div>`,
          `<div><span style="opacity: 0.6">เติบโต: </span>${growthText}</div>`,
          `<div style="opacity: 0.6; font-size: 0.75rem; font-style: italic; margin-top: 0.25rem;">กดเพื่อดูรายละเอียด</div>`,
        ].join('');
        e.currentTarget.setAttribute('data-html', 'true');
        e.currentTarget.setAttribute('data-tip', tip);
        ReactTooltip.show(e.currentTarget);
      })
      .on('mouseleave', (e) => {
        d3.select(e.currentTarget)
          .select('rect.box')
          .style('filter', null);
        ReactTooltip.hide(e.currentTarget);
      })
      .on('click', null)
      .on('click', (e, d) => {
        if (isLeafLevelRef.current) {
          // Show modal for item details at leaf level
          const itemKey = d?.data?.key;
          const itemId = d?.data?.value?.id;
          const itemData = dataRowsRef.current.find((row) => row.name === itemKey && row.id === itemId);
          if (itemData) {
            setSelectedItem(itemData);
          }
          return;
        }

        // Immediately clear hover visuals and suppress further hover until
        // the mouse moves again after the new chart has fully faded in.
        suppressHoverRef.current = true;
        d3.select(e.currentTarget).select('rect.box').style('filter', null);
        ReactTooltip.hide(e.currentTarget);
        // Current tile dimensions (before zoom)
        const oldTileWidth = d.x1 - d.x0 - gutter;
        const oldTileHeight = d.y1 - d.y0 - gutter;
        const oldTileX = d.x0 + gutter / 2;
        const oldTileY = d.y0 + gutter / 2;

        const sx = treeW / oldTileWidth;
        const sy = treeH / oldTileHeight;
        const dx = oldTileX;
        const dy = oldTileY;

        // Fade text, then zoom into the tile; navigation fires only after zoom completes
        // so the chart stays frozen at the zoomed scale while data loads.
        currentChart.selectAll('text').transition().duration(transitionDuration).attr('opacity', 0);

        currentChart
          .transition().duration(transitionDuration)
          .attr('transform', `translate(${-dx * sx},${-dy * sy}) scale(${sx},${sy})`)
          .on('end', () => {
            if (!d?.data?.value?.isTailBucket) {
              isFromZoomRef.current = true;
              navigateToRef.current(d?.data?.value?.id, d?.data?.key, { isTerminal: d?.data?.value?.isTerminal });
            }
          });

        // "อื่นๆ" bucket — open overlay after zoom
        if (d?.data?.value?.isTailBucket) {
          setTimeout(() => setOverlayOpen(true), transitionDuration);
        }
      });

    treemapPieceMerged
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .attr('opacity', 1);
    treemapPieceMerged.select('rect.box')
      .attr('rx', 3)
      .style('fill', (d) => getNodeColor(d))
      .attr('stroke', (d) => {
        if (isLeafLevelRef.current || !hoveredItemNameRef.current) return 'black';
        return d?.data?.key === hoveredItemNameRef.current ? 'white' : 'black';
      })
      .attr('stroke-width', (d) => {
        if (isLeafLevelRef.current || !hoveredItemNameRef.current) return gutter;
        return d?.data?.key === hoveredItemNameRef.current ? gutter * 2 : gutter;
      })
      .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
      .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));
    treemapPieceMerged.select('clipPath rect')
      .attr('rx', 3)
      .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
      .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));

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
      .text((d) => (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 28) ? `${abbreviateNumber(d.value)} บาท` : '');

    treemapPieceMerged.select('text.text-growth')
      .attr('x', 5)
      .attr('y', 40)
      .attr('fill-opacity', 0.6)
      .attr('dominant-baseline', 'hanging')
      .attr('opacity', 1)
      .text((d) => {
        if (d.x1 - d.x0 <= 40 || d.y1 - d.y0 <= 44) return '';
        return abbreviateGrowthRate(d?.GROWTH);
      })
      .attr('fill', (d) => (d?.GROWTH > 0 ? '#4f4' : d?.GROWTH < 0 ? '#f44' : 'white'));

    if (isCrossFade) {
      // Fade in new chart, then fade out old zoomed chart, then swap children into g.chart
      renderChart.transition().duration(250)
        .style('opacity', 1)
        .on('end', () => {
          currentChart.transition().duration(200)
            .style('opacity', 0)
            .on('end', () => {
              const chartNode = currentChart.node();
              currentChart.selectAll('*').remove();
              renderChart.selectChildren().nodes().forEach((child) => chartNode.appendChild(child));
              currentChart
                .interrupt()
                .attr('transform', 'translate(0,0) scale(1,1)')
                .style('opacity', 1)
                .style('pointer-events', null);
              renderChart
                .style('opacity', 1)
                .style('pointer-events', 'none');
              // Lift suppression on the first mouse move inside the chart
              const svgEl = svgRef.current;
              if (svgEl) {
                const onMove = () => {
                  suppressHoverRef.current = false;
                  svgEl.removeEventListener('mousemove', onMove);
                };
                svgEl.addEventListener('mousemove', onMove, { once: true });
              }
            });
        });
    }
    };

    const raf = requestAnimationFrame(performRender);
    // eslint-disable-next-line consistent-return
    return () => cancelAnimationFrame(raf);
  }, [
    svgRef,
    data,
    nestedData,
    width,
    height,
    padding,
    gutter,
    getNodeColor,
    // hoveredItemName is intentionally omitted: stroke highlighting is handled by
    // the dedicated lightweight effect above, which uses D3 selections directly.
    // The main render reads hoveredItemNameRef.current internally.
    isLeafLevel,
    compareYear,
    primaryYear,
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
          padding: 16,
          paddingBottom: 8,
          fontSize: 12,
          marginBottom: -padding + 4,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          // paddingRight: 18,
        }}
      >
        <Ui.Title>โครงสร้างงบประมาณ</Ui.Title>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 11,
            // opacity: 0.6,
            gap: '6px',
            marginTop: 4,
          }}
        >
          <span style={{color: '#f11919'}}>{`-${colorScaleMaxValue * 100}%`}</span>
          <div
            style={{
              width: '80px',
              height: '10px',
              background: 'linear-gradient(to right, #cf0000, #222222, #00ac00)',
            }}
          />
          <span style={{color: '#25d925'}}>{`+${colorScaleMaxValue * 100}%`}</span>
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
      {!isLoading && data?.rows?.length === 0 && (
        <FullView style={{ backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', gap: 16, flexDirection: 'column' }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>{isLeafLevel ? '🔍' : '📭'}</div>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '0 24px' }}>
            <div style={{ fontSize: 18, marginBottom: 8, opacity: 0.9 }}>
              {isLeafLevel ? 'ไม่พบรายการงบประมาณ' : 'ไม่มีข้อมูลในหมวดนี้'}
            </div>
            <div style={{ fontSize: 14, opacity: 0.6, lineHeight: 1.5 }}>
              {isLeafLevel
                ? <>ไม่มีรายการงบประมาณที่ตรงกับตัวกรองที่เลือก<br />ลองเปลี่ยนตัวกรองหรือย้อนกลับไปดูระดับก่อนหน้า</>
                : <>ไม่มีข้อมูลงบประมาณที่ตรงกับเงื่อนไขที่เลือก<br />กรุณาเลือกหมวดอื่น หรือย้อนกลับไปยังหน้าก่อนหน้า</>}
            </div>
          </div>
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
            <g transform={`translate(${padding}, ${padding})`} className="chart-wrapper">
              <g className="chart" />
              <g className="chart-next" style={{ opacity: 1, pointerEvents: 'none' }} />
            </g>
          </svg>
        </div>
        {overlayOpen && tailItemsRef.current.length > 0 && (
          <TailOverlay
            items={tailItemsRef.current}
            count={overlayCount}
            onLoadMore={() => setOverlayCount((c) => c + BATCH_SIZE)}
            onClose={() => setOverlayOpen(false)}
            navigateTo={navigateToRef.current}
            onItemClick={setSelectedItem}
            dataRows={dataRowsRef.current}
            isLeafLevel={isLeafLevel}
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
      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          years={data.years || []}
          primaryYear={primaryYear}
          compareYear={compareYear}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

export default forwardRef(TreemapComponent);

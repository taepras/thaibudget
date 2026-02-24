import React, {
  useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle,
} from 'react';

import * as d3 from 'd3';
import { nest } from 'd3-collection';
import useDimensions from 'react-cool-dimensions';
import ReactTooltip from 'react-tooltip';
import { useHistory, useLocation } from 'react-router-dom';
import { abbreviateNumber } from '../utils/numberFormat';
import FullView from './FullView';

const THAI_NAME = {
  MINISTRY: 'กระทรวงหรือเทียบเท่า',
  BUDGETARY_UNIT: 'หน่วยรับงบฯ',
  BUDGET_PLAN: 'แผนงาน',
  OUTPUT_PROJECT: 'ผลผลิต/โครงการ',
  ITEM: 'รายการ',
};

function TreemapComponent({
  data = [],
  isLoading = true,
  padding = 16,
  gutter = 4,
  filters = ['all'],
  setFilters = () => { },
  hierarchyBy = [],
  setCurrentSum = (sum) => { },
  fullValue = -1,
  index = 0,
  isMultipleMaxSum = false,
  sumWindows = [],
  hoveredItemName = null,
  colorScaleMaxValue = 0.3,
}, ref) {
  const {
    observe, unobserve, width, height, entry,
  } = useDimensions({
    onResize: ({
      /* eslint-disable-next-line no-shadow */
      observe, unobserve, w, h, entr,
    }) => {
      unobserve();
      observe();
    },
  });

  // const history = useHistory();

  const svgRef = useRef(null);

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
  const [displayMode, setDisplayMode] = useState('treemap'); // or 'bar'

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

  const nestedData = useMemo(() => {
    console.log('filters', filters);

    let out = nest();
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in filters) {
      // for (const i in hierarchyBy) {
      // console.log(hierarchyBy[i], filters[i])
      out = out.key((d) => d[hierarchyBy[i]]);
    }

    const nested = out
      .rollup((leaves) => ({
        value: d3.sum(leaves, (l) => l.AMOUNT),
        AMOUNT_LASTYEAR: d3.sum(leaves, (l) => l.AMOUNT_LASTYEAR),
        GROWTH: d3.sum(leaves, (l) => l.AMOUNT_LASTYEAR) > 0
          ? (d3.sum(leaves, (l) => l.AMOUNT) / d3.sum(leaves, (l) => l.AMOUNT_LASTYEAR)) - 1
          : null,
      }))
      .entries(data);
    let inData = {
      key: 'root',
      values: [{ key: 'all', values: nested }],
    };

    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in filters) {
      inData = inData?.values?.filter?.((d) => d.key === filters[i])[0];
    }

    console.log('indata', inData);

    return inData;
  }, [data, filters, hierarchyBy]);

  const [growth, setGrowth] = useState(null);

  useEffect(() => {
    const s = nestedData.values.reduce((a, b) => {
      const val = b.value?.value !== undefined ? b.value.value : (b.value || 0);
      return a + val;
    }, 0);
    const lastYearSum = nestedData.values.reduce((a, b) => a + (b.value?.AMOUNT_LASTYEAR || 0), 0);
    const g = lastYearSum > 0 ? (s / lastYearSum) - 1 : null;
    console.log('sum', s, 'lastYear', lastYearSum, 'growth', g);
    if (sum !== s) { setCurrentSum(s); }
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

    console.log('fullVal', fullValue);
    console.log('nested', nestedData);
    const svgHeight = svgRef.current.clientHeight;
    console.log(svgHeight);

    const root = d3.hierarchy(nestedData, (d) => d?.values)
      .sum((d) => (d?.value?.value !== undefined ? d.value.value : (d?.value || 0)))
      .sort((a, b) => {
        const valA = a?.value?.value !== undefined ? a.value.value : (a?.value || 0);
        const valB = b?.value?.value !== undefined ? b.value.value : (b?.value || 0);
        return valB - valA;
      })
      // eslint-disable-next-line no-param-reassign
      .each((d) => {
        if (d.data.value) {
          // eslint-disable-next-line no-param-reassign
          d.AMOUNT_LASTYEAR = d.data.value.AMOUNT_LASTYEAR;
          // eslint-disable-next-line no-param-reassign
          d.GROWTH = d.data.value.GROWTH;
        }
      });

    const newSum = nestedData.values.reduce((a, b) => {
      const val = b.value?.value !== undefined ? b.value.value : (b.value || 0);
      return a + val;
    }, 0);

    const newSumWin = [...sumWindows];
    const idx0 = newSumWin.indexOf(sum);
    if (idx0 !== -1) {
      newSumWin[idx0] = newSum;
    }
    const fullVal = d3.max(newSumWin);
    const treeFullArea = (width - 2 * padding) * (svgHeight - 2 * padding);
    const treeAspect = (width - 2 * padding) / (svgHeight - 2 * padding);
    const treeCurrentArea = (newSum / (fullVal || 1)) * treeFullArea;
    console.log('sumw', index, sumWindows, newSumWin, sum, fullVal, newSum);
    const treeH = fullVal <= 0 ? svgHeight - 2 * padding : Math.sqrt(treeCurrentArea / treeAspect);
    const treeW = fullVal <= 0 ? width - 2 * padding : treeCurrentArea / treeH;

    const treemap = d3.treemap()
      .size([treeW, treeH])
      .padding(0);
    // .round(true);

    const nodes = treemap(root);

    const svg = d3.select(svgRef.current).select('g.chart');

    const barScale = d3.scaleLinear()
      .domain([0, d3.max(root.leaves(), (d) => d.value)])
      .range([0, width - 2 * padding]);

    const treemapPieceGroup = svg
      .selectAll('g.treemap-piece')
      .data(root.leaves(), (d) => d?.data?.key);

    const treemapPieceGroupEnter = treemapPieceGroup
      .enter()
      .append('g')
      .attr('class', 'treemap-piece')
      .attr('id', (d) => `${d?.data?.key.replaceAll(/[ ()]/g, '')}-${index}`)
      .style('mask', (d) => `url(#mask-${d?.data?.key.replaceAll(/[ ()]/g, '')}-${index})`)
      .attr('data-tip', (d) => {
        const itemGrowth = d?.GROWTH;
        const lastYear = d?.AMOUNT_LASTYEAR;
        const growthText = itemGrowth != null ? `${(itemGrowth * 100).toFixed(1)}%` : 'N/A';
        const lastYearText = lastYear != null ? lastYear.toLocaleString() : 'N/A';
        return `${d?.data?.key}<br>${d?.value?.toLocaleString?.()} บาท<br>ปีที่แล้ว: ${lastYearText} บาท<br>เติบโต: ${growthText}`;
      })
      .attr('transform', (d) => `translate(${d.x0 || 0},${d.y0 || 0})`);
    // .attr('opacity', 0);

    treemapPieceGroupEnter
      .append('rect')
      .attr('class', 'box')
      .attr('rx', 3)
      .style('fill', (d) => getNodeColor(d))
      .attr('width', (d) => (d.x1 - d.x0) || 0)
      .attr('height', (d) => (d.y1 - d.y0) || 0);
    // .attr('x', d => d.x0)
    // .attr('y', d => d.y0)
    // .style('stroke', 'black')

    // .style('fill', 'cyan');

    treemapPieceGroupEnter
      .append('mask')
      .attr('id', (d) => `mask-${d?.data?.key.replaceAll(/[ ()]/g, '')}-${index}`)
      .append('rect')
      .attr('class', 'mask')
      .attr('rx', 3)
      .style('fill', 'white')
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
      .on('click', null)
      .on('click', (e, d, el) => {
        const newFilters = [...filters, d?.data?.key];
        if (newFilters.length > hierarchyBy.length) return;

        // const treeFullArea = (width - 2 * padding) * (svgHeight - 2 * padding);
        // const treeAspect = (width - 2 * padding) / (svgHeight - 2 * padding);
        // const treeCurrentArea = (sum / (fullValue || 1)) * treeFullArea;
        const newSumWindows = [...sumWindows];
        const idx = newSumWindows.indexOf(sum);
        if (idx !== -1) {
          newSumWindows[idx] = d.value;
        }
        const newFullValue = d3.max(newSumWindows);

        // const newFullValue = sum === fullValue && !isMultipleMaxSum ? d.value : fullValue;
        // const newArea = (d.value / (fullValue || 1)) * treeFullArea;
        const newArea = (d.value / (newFullValue || 1)) * treeFullArea;
        const newH = Math.sqrt(newArea / treeAspect);
        const newW = newArea / newH;

        const dx = d.x0;
        const dy = d.y0;
        const sx = newW / (d.x1 - d.x0);
        const sy = newH / (d.y1 - d.y0);

        console.log('prp', d3.select(this), e, d, el);
        // const sx = 0.43;
        // const sy = 1.05;

        d3.select(this).classed('selected', true);

        treemapPieceMerged
          .transition()
          .duration(300)
          .attr('transform', (p) => `translate(${(p.x0 - dx) * sx},${(p.y0 - dy) * sy})`);

        treemapPieceMerged.select('rect.box')
          .transition()
          .duration(300)
          .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
          .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));

        treemapPieceMerged.select('rect.mask')
          .transition()
          .duration(300)
          .attr('width', (p) => Math.max(sx * (p.x1 - p.x0), 0))
          .attr('height', (p) => Math.max(sy * (p.y1 - p.y0), 0));

        setTimeout(() => {
          setFilters(newFilters);
          // history.push(`/${newFilters.join('/')}`);
        }, 300);
      })
      .transition()
      .duration(300)
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .attr('opacity', 1)
      .attr('data-tip', (d) => {
        const nodeGrowth = d?.GROWTH;
        const lastYear = d?.AMOUNT_LASTYEAR;
        const growthText = nodeGrowth != null ? `${(nodeGrowth * 100).toFixed(1)}%` : 'N/A';
        const lastYearText = lastYear != null ? abbreviateNumber(lastYear) : 'N/A';
        return `${d?.data?.key}<br>${abbreviateNumber(d?.value)}<br>ปีที่แล้ว: ${lastYearText}<br>เติบโต: ${growthText}`;
      });

    treemapPieceMerged.select('rect.box')
      .transition()
      .duration(300)
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

    treemapPieceMerged.select('rect.mask')
      .transition()
      .duration(300)
      .attr('rx', 3)
      .style('fill', 'white')
      .attr('width', (d) => Math.max((d.x1 - d.x0) || 0, 0))
      .attr('height', (d) => Math.max((d.y1 - d.y0) || 0, 0));

    treemapPieceMerged.select('text.text-name')
      .attr('x', 5)
      .attr('y', 8)
      .attr('dominant-baseline', 'hanging')
      .text((d) => d?.data?.key);

    treemapPieceMerged.select('text.text-value')
      .attr('x', 5)
      .attr('y', 24)
      .attr('fill-opacity', 0.7)
      .attr('dominant-baseline', 'hanging')
      .attr('opacity', 1)
      .text((d) => abbreviateNumber(d.value));

    treemapPieceMerged.select('text.text-growth')
      .attr('x', 5)
      .attr('y', 40)
      .attr('fill-opacity', 0.7)
      .attr('dominant-baseline', 'hanging')
      .attr('opacity', 1)
      .text((d) => {
        const itemGrowth = d?.GROWTH;
        return itemGrowth != null ? `${itemGrowth >= 0 ? '+' : ''}${(itemGrowth * 100).toFixed(1)}%` : '';
      })
      .attr('fill', (d) => (d?.GROWTH > 0 ? '#4f4' : d?.GROWTH < 0 ? '#f44' : 'white'));

    treemapPieceGroup.exit()
      .transition()
      .delay(150)
      .duration(600)
      .attr('opacity', 0)
      // .delay(300)
      .remove();

    ReactTooltip.rebuild();
    console.log('rebuilding tooltip');

    console.log('too small', root.leaves().filter((d) => (d.x1 - d.x0) * (d.y1 - d.y0) < 100));
    console.log('too narrow', root.leaves().filter((d) => d.x1 - d.x0 < 20));
    console.log('too short', root.leaves().filter((d) => d.y1 - d.y0 < 20));
  }, [
    svgRef,
    nestedData,
    filters,
    width,
    height,
    displayMode,
    padding,
    gutter,
    hierarchyBy,
    setFilters,
    fullValue,
    sum,
    index,
    isMultipleMaxSum,
    sumWindows,
    colorScale,
    getNodeColor,
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
            {filters[filters.length - 1] === 'all' ? 'รวมทุกหน่วยงาน' : filters[filters.length - 1]}
          </b>
          <br />
          <span style={{ opacity: 0.7 }}>
            {abbreviateNumber(sum)}
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
            opacity: 0.7,
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
            }}
          >
            Loading...
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

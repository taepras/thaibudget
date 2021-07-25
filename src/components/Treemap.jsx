import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';

import * as d3 from 'd3';
import { nest } from 'd3-collection';
import useDimensions from 'react-cool-dimensions';
import ReactTooltip from 'react-tooltip';
import { useHistory, useLocation } from 'react-router-dom';
import FullView from './FullView';

const THAI_NAME = {
  MINISTRY: 'กระทรวงหรือเทียบเท่า',
  BUDGETARY_UNIT: 'หน่วยรับงบฯ',
  BUDGET_PLAN: 'แผนงาน',
  OUTPUT_PROJECT: 'ผลผลิต/โครงการ',
  ITEM: 'รายการ',
};

function Treemap({
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
}) {
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

  // const [data, setData] = useState([]);
  const [sum, setSum] = useState(-1); // or 'bar'
  const [displayMode, setDisplayMode] = useState('treemap'); // or 'bar'

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
      .rollup((leaves) => d3.sum(leaves, (l) => l.AMOUNT))
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

  useEffect(() => {
    const s = nestedData.values.reduce((a, b) => a + b.value, 0);
    console.log('sum', s);
    if (sum !== s) { setCurrentSum(s); }
    setSum(s);
  }, [nestedData, setCurrentSum, sum]);

  useEffect(() => {
    if (!svgRef.current) return;

    console.log('fullVal', fullValue);
    console.log('nested', nestedData);
    const svgHeight = svgRef.current.clientHeight;
    console.log(svgHeight);

    const root = d3.hierarchy(nestedData, (d) => d?.values)
      .sum((d) => d?.value)
      .sort((a, b) => b?.value - a?.value);

    const newSum = nestedData.values.reduce((a, b) => a + b.value, 0);

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
      .attr('data-tip', (d) => `${d?.data?.key}<br>${d?.value?.toLocaleString?.()} บาท`)
      .attr('transform', (d) => `translate(${d.x0 || 0},${d.y0 || 0})`);
    // .attr('opacity', 0);

    treemapPieceGroupEnter
      .append('rect')
      .attr('class', 'box')
      .attr('rx', 3)
      .style('fill', 'DarkSlateBlue')
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

    const treemapPieceMerged = treemapPieceGroupEnter.merge(treemapPieceGroup);

    treemapPieceMerged
      .on('click', null)
      .on('click', (e, d, el) => {
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
          const newFilters = [...filters, d?.data?.key];
          if (newFilters.length <= hierarchyBy.length) {
            setFilters(newFilters);
            // history.push(`/${newFilters.join('/')}`);
          }
        }, 300);
      })
      .transition()
      .duration(300)
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
      .attr('opacity', 1)
      .attr('data-tip', (d) => `${d?.data?.key}<br>${d?.value?.toLocaleString?.()} บาท`);

    treemapPieceMerged.select('rect.box')
      .transition()
      .duration(300)
      .attr('rx', 3)
      .attr('fill', 'DarkSlateBlue')
      .attr('stroke', 'black')
      .attr('stroke-width', gutter)
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
      .text((d) => `${d.value.toLocaleString()} บาท`);

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
      <div style={{
        paddingLeft: 18,
        fontSize: 12,
        marginBottom: -padding + 4,
        zIndex: 2,
      }}
      >
        <b style={{ whiteSpace: 'nowrap' }}>{filters[filters.length - 1] === 'all' ? 'รวมทุกหน่วยงาน' : filters[filters.length - 1]}</b>
        <br />
        <span style={{ opacity: 0.7 }}>
          {sum.toLocaleString()}
          {' '}
          บาท
        </span>
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

export default Treemap;

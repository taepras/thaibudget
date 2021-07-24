import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';

import * as d3 from 'd3';
import { nest } from 'd3-collection';
import useDimensions from 'react-cool-dimensions';
import { useHistory, useLocation } from 'react-router-dom';
import FullView from './FullView';

function Treemap({
  data = [],
  isLoading = true,
  padding = 16,
  filters = ['all'],
  setFilters = () => { },
  hierarchyBy = [],
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

  const history = useHistory();

  const svgRef = useRef(null);

  // const [data, setData] = useState([]);
  const [displayMode, setDisplayMode] = useState('treemap'); // or 'bar'

  const nestedData = useMemo(
    () => {
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
    },
    [data, filters, hierarchyBy],
  );

  useEffect(() => {
    if (!svgRef.current) return;

    console.log('nested', nestedData);
    const svgHeight = svgRef.current.clientHeight;
    console.log(svgHeight);

    const root = d3.hierarchy(nestedData, (d) => d?.values)
      .sum((d) => d?.value)
      .sort((a, b) => b?.value - a?.value);

    const treemap = d3.treemap()
      .size([width - 2 * padding, svgHeight - 2 * padding])
      .padding(3);
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
      .attr('class', 'treemap-piece');
    // .attr('opacity', 0);

    treemapPieceGroupEnter
      .append('rect');
    // .attr('x', d => d.x0)
    // .attr('y', d => d.y0)
    // .style('stroke', 'black')

    // .style('fill', 'cyan');

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

    if (displayMode === 'treemap') {
      treemapPieceMerged
        .on('click', null)
        .on('click', (e, d) => {
          const dx = d.x0;
          const dy = d.y0;
          const sx = (width - 2 * padding) / (d.x1 - d.x0);
          const sy = (height - 2 * padding) / (d.y1 - d.y0);

          treemapPieceMerged
            .transition()
            .duration(300)
            .attr('transform', (p) => `translate(${(p.x0 - dx) * sx},${(p.y0 - dy) * sy})`);

          // treemapPieceMerged
          //   .transition()
          //   .delay(500)
          //   .duration(300)
          //   .attr('opacity', 0);

          treemapPieceMerged.select('rect')
            .transition()
            .duration(300)
            .attr('width', (p) => sx * (p.x1 - p.x0))
            .attr('height', (p) => sy * (p.y1 - p.y0));

          // d3.select(this)
          //   .classed('expanding', true)
          //   .transition()
          //   .duration(300)
          //   .attr('transform', 'translate(0, 0)');

          // const thisClicked = this;

          // treemapPieceMerged
          //   .filter(function (node, i, el) {
          //     return this !== thisClicked;
          //   })
          //   .classed('not-current', true)
          //   .transition()
          //   .duration(300)
          //   .attr('opacity', 0);

          // d3.select(this).select('rect')
          //   .attr('opacity', 1)
          //   .transition()
          //   .duration(300)
          //   // .attr('x', (x) => -x.x0)
          //   // .attr('y', (x) => -x.y0)
          //   .attr('width', width - 2 * padding)
          //   .attr('height', svgHeight - 2 * padding);

          // // eslint-disable-next-line react/no-this-in-sfc

          // d3.select(this)
          //   .transition()
          //   .duration(300)
          //   .delay(500)
          //   .attr('opacity', 0);

          setTimeout(() => {
            const newFilters = [...filters, d?.data?.key];
            // setFilters(newFilters);
            history.push(`${process.env.PUBLIC_URL}/${newFilters.join('/')}`);
          }, 300);
        })
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
        .transition()
        .duration(600)
        .attr('opacity', 1);

      treemapPieceMerged.select('rect')
        .attr('rx', 2)
        .style('fill', 'DarkSlateBlue')
        .attr('width', (d) => d.x1 - d.x0)
        .attr('height', (d) => d.y1 - d.y0);

      treemapPieceMerged.select('text.text-name')
        .attr('x', 5)
        .attr('y', 20)
        .text((d) => d?.data?.key);

      treemapPieceMerged.select('text.text-value')
        .attr('x', 5)
        .attr('y', 36)
        .attr('opacity', 1)
        .text((d) => `${d.value.toLocaleString()} บาท`);
    }
    // else if (displayMode === 'bar') {
    //   const Y_SPACING = 40;
    //   treemapPieceMerged
    //     .on('click', null)
    //     .on('click', (e, d) => {
    //       setFilters([...filters, d?.data?.key]);
    //     })
    //     .transition().duration(300)
    //     .attr('transform', (d, i) => `translate(${0},${i * Y_SPACING + 30})`);

    //   treemapPieceMerged.select('rect')
    //     .transition().duration(300)
    //     .attr('width', (d) => barScale(d.value))
    //     .attr('height', 10);

    //   treemapPieceMerged.select('text.text-name')
    //     .transition().duration(300)
    //     .attr('x', 0)
    //     .attr('y', -4)
    //     .attr('alignment-baseline', 'baseline')
    //     .text((d) => `${d.data.key} - ${d.value.toLocaleString()} บาท`);

    //   treemapPieceMerged.select('text.text-value')
    //     .transition().duration(300)
    //     .attr('opacity', 0);

    //   svg.attr('height', root.leaves().length * Y_SPACING + 30);
    // }

    treemapPieceGroup.exit()
      .transition()
      .delay(300)
      .duration(600)
      .attr('opacity', 0)
      .delay(300)
      .remove();
  }, [svgRef, nestedData, filters, width, height, displayMode, padding, history]);

  return (
    <div
      ref={observe}
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
      {/* {JSON.stringify(filters)} */}
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
        }}
      />
      <svg ref={svgRef} width={width} height={height}>
        <g transform={`translate(${padding}, ${padding})`} className="chart" />
      </svg>
      <div
        style={{
          height: padding,
          marginTop: -padding,
          background: 'linear-gradient(#0000, #000f)',
          width: '100%',
          zIndex: 1,
        }}
      />
    </div>
  );
}

export default Treemap;

import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';

import * as d3 from 'd3';
import { nest } from 'd3-collection';
import useDimensions from 'react-cool-dimensions';
import { useHistory, useLocation } from 'react-router-dom';

function Treemap({
  padding = 16,
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

  const location = useLocation();
  const history = useHistory();

  const svgRef = useRef(null);
  const [hierarchyBy, setHierarchyBy] = useState([
    'MINISTRY',
    'BUDGETARY_UNIT',
    'BUDGET_PLAN',
    'OUPUT',
    'PROJECT',
    'CATEGORY_LV1',
    'CATEGORY_LV2',
    'CATEGORY_LV3',
    'CATEGORY_LV4',
    'CATEGORY_LV5',
    'CATEGORY_LV6',
  ]);
  const [filters, setFilters] = useState(['all']);
  const [data, setData] = useState([]);
  const [displayMode, setDisplayMode] = useState('treemap'); // or 'bar'

  const preprocessedData = useMemo(() => data.map(
    (d) => ({
      ...d,
      AMOUNT: parseFloat(d.AMOUNT.replace(/,/g, '')),
    }),
  ),
  [data]);

  const navigateTo = (x, i) => {
    console.log(x, i);
    const temp = [...filters];
    temp.splice(i + 1);
    // setFilters(temp);
    console.log('temp', temp);
    history.push(`${process.env.PUBLIC_URL}/${temp.join('/')}`);
  };

  const nestedData = useMemo(
    () => {
      console.log('filters', filters);

      let out = nest();
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const i in filters) {
        // console.log(hierarchyBy[i], filters[i])
        out = out.key((d) => d[hierarchyBy[i]]);
      }

      const nested = out
        .rollup((leaves) => d3.sum(leaves, (l) => l.AMOUNT))
        .entries(preprocessedData);

      let inData = {
        key: 'root',
        values: [{ key: 'all', values: nested }],
      };

      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const i in filters) {
        inData = inData.values.filter?.((d) => d.key === filters[i])[0];
      }
      return inData;
    },
    [preprocessedData, filters, hierarchyBy],
  );

  useEffect(() => {
    d3.csv(`${process.env.PUBLIC_URL}/data.csv`).then((d) => {
      setData(d);
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    console.log('nested', nestedData);
    const svgHeight = svgRef.current.clientHeight;
    console.log(svgHeight);

    const root = d3.hierarchy(nestedData, (d) => d.values)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
      .size([width - 2 * padding, svgHeight - 2 * padding])
      .padding(1)
      .round(true);

    const nodes = treemap(root);

    console.log('nodes', nodes);

    const svg = d3.select(svgRef.current).select('g.chart');

    const barScale = d3.scaleLinear()
      .domain([0, d3.max(root.leaves(), (d) => d.value)])
      .range([0, width - 2 * padding]);

    const treemapPieceGroup = svg
      .selectAll('g.treemap-piece')
      .data(root.leaves(), (d) => d.key);

    const treemapPieceGroupEnter = treemapPieceGroup
      .enter()
      .append('g')
      .attr('class', 'treemap-piece')
      .attr('opacity', 0);

    treemapPieceGroupEnter
      .append('rect')
      // .attr('x', d => d.x0)
      // .attr('y', d => d.y0)
      .style('stroke', 'black')
      .style('fill', 'slateblue');

    treemapPieceGroupEnter
      .append('text')
      .attr('class', 'text-name')
      .attr('font-size', '15px')
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
        .on('click', function (e, d) {
          d3.select(this)
            .classed('expanding', true)
            .transition()
            .duration(300)
            .attr('transform', 'translate(0, 0)');

          const thisClicked = this;

          treemapPieceMerged
            .filter(function (node, i, el) {
              return this !== thisClicked;
            })
            .classed('not-current', true)
            .transition()
            .duration(300)
            .attr('opacity', 0);

          d3.select(this).select('rect')
            .attr('opacity', 1)
            .transition()
            .duration(300)
            // .attr('x', (x) => -x.x0)
            // .attr('y', (x) => -x.y0)
            .attr('width', width - 2 * padding)
            .attr('height', svgHeight - 2 * padding);

          // eslint-disable-next-line react/no-this-in-sfc

          d3.select(this)
            .transition()
            .duration(300)
            .delay(500)
            .attr('opacity', 0);

          setTimeout(() => {
            const newFilters = [...filters, d.data.key];
            // setFilters(newFilters);
            history.push(`${process.env.PUBLIC_URL}/${newFilters.join('/')}`);
          }, 600);
        })
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)
        .transition()
        .duration(300)
        .attr('opacity', 1);

      treemapPieceMerged.select('rect')
        .attr('width', (d) => d.x1 - d.x0)
        .attr('height', (d) => d.y1 - d.y0);

      treemapPieceMerged.select('text.text-name')
        .attr('x', (d) => 5)
        .attr('y', (d) => 20)
        .text((d) => d.data.key);

      treemapPieceMerged.select('text.text-value')
        .attr('x', (d) => 5)
        .attr('y', (d) => 40)
        .attr('opacity', 1)
        .text((d) => `${d.value.toLocaleString()} บาท`);
    } else if (displayMode === 'bar') {
      const Y_SPACING = 40;
      treemapPieceMerged
        .on('click', null)
        .on('click', (e, d) => {
          setFilters([...filters, d.data.key]);
        })
        .transition().duration(300)
        .attr('transform', (d, i) => `translate(${0},${i * Y_SPACING + 30})`);

      treemapPieceMerged.select('rect')
        .transition().duration(300)
        .attr('width', (d) => barScale(d.value))
        .attr('height', 10);

      treemapPieceMerged.select('text.text-name')
        .transition().duration(300)
        .attr('x', 0)
        .attr('y', -4)
        .attr('alignment-baseline', 'baseline')
        .text((d) => `${d.data.key} - ${d.value.toLocaleString()} บาท`);

      treemapPieceMerged.select('text.text-value')
        .transition().duration(300)
        .attr('opacity', 0);

      svg.attr('height', root.leaves().length * Y_SPACING + 30);
    }

    treemapPieceGroup.exit().transition().delay(900).remove();
  }, [svgRef, nestedData, filters, width, height, displayMode, padding, history]);

  useEffect(() => history.listen((loc) => {
    console.log(`You changed the page to: ${loc.pathname}`);
    console.log(loc.pathname.split('/').slice(2));
    setFilters(loc.pathname.split('/').slice(2));
  }), [history]);

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
      <div style={{ height: 50 }}>
        {/* <button type="button" onClick={() => setDisplayMode('treemap')}>treemap</button>
        <button type="button" onClick={() => setDisplayMode('bar')}>bar</button> */}

        {filters.map((x, i) => (
          <>
            <button type="button" onClick={() => navigateTo(x, i)}>{x}</button>
          </>
        ))}
        {/* {JSON.stringify(filters)} */}
      </div>
      <svg ref={svgRef} width={width} height={height - 50}>
        <g transform={`translate(${padding}, ${padding})`} className="chart" />
      </svg>
    </div>
  );
}

export default Treemap;

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { nest } from 'd3-collection';
import useDimensions from 'react-cool-dimensions';

function Treemap() {
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

  let preprocessedData = useMemo(() => data.map(
    d => ({
      ...d,
      AMOUNT: parseFloat(d.AMOUNT.replace(/,/g, ''))
    })),
    [data]
  );

  const navigateTo = (x, i) => {
    console.log(x, i);
    const temp = [...filters];
    temp.splice(i + 1);
    setFilters(temp);
    console.log('temp', temp);
  }

  let nestedData = useMemo(
    () => {
      console.log('filters', filters);

      let out = nest()
      for (let i in filters) {
        // console.log(hierarchyBy[i], filters[i])
        out = out.key(d => d[hierarchyBy[i]])
      }

      let nested = out
        .rollup((leaves) => d3.sum(leaves, l => l.AMOUNT))
        .entries(preprocessedData);

      let inData = {
        key: 'root',
        values: [{ key: 'all', values: nested }]
      };

      for (let i in filters) {
        inData = inData.values.filter?.(d => d.key === filters[i])[0]
      }
      return inData;
    },
    [preprocessedData, filters, hierarchyBy]
  );

  useEffect(() => {
    d3.csv(process.env.PUBLIC_URL + '/data.csv').then((d) => {
      setData(d)
    })
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    console.log('nested', nestedData);

    let root = d3.hierarchy(nestedData, d => d.values)
      .sum(d => d.value)
      .sort(function (a, b) { return b.value - a.value; });

    let treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    let nodes = treemap(root)

    console.log('nodes', nodes);

    let svg = d3.select(svgRef.current);

    let treemapPieceGroup = svg
      .selectAll("g.treemap-piece")
      .data(root.leaves())

    let treemapPieceGroupEnter = treemapPieceGroup
      .enter()
      .append("g")
      .attr("class", "treemap-piece")

    treemapPieceGroupEnter
      .append("rect")
      // .attr('x', d => d.x0)
      // .attr('y', d => d.y0)
      .style("stroke", "black")
      .style("fill", "slateblue")

    treemapPieceGroupEnter
      .append("text")
      .attr("class", "text-name")
      .attr("font-size", "15px")
      .attr("fill", "white")
    
    treemapPieceGroupEnter
      .append("text")
      .attr("class", "text-value")
      .attr("font-size", "12px")
      .attr("fill", "white")

    let treemapPieceMerged = treemapPieceGroupEnter.merge(treemapPieceGroup);

    treemapPieceMerged
      .on('click', null)
      .on('click', (e, d) => {
        console.log('data', d);
        console.log('old filter', filters);
        console.log('new filter', [...filters, d.data.key]);
        setFilters([...filters, d.data.key])
      })
      .transition().duration(500)
      .attr("transform", d => `translate(${d.x0},${d.y0})`)

    treemapPieceMerged.select("rect")
      .transition().duration(500)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)

    treemapPieceMerged.select("text.text-name")
      .transition().duration(500)
      .attr("x", d => 5)
      .attr("y", d => 20)
      .text(d => d.data.key)
    
    treemapPieceMerged.select("text.text-value")
      .transition().duration(500)
      .attr("x", d => 5)
      .attr("y", d => 40)
      .text(d => d.value.toLocaleString())

    treemapPieceGroup.exit().remove();

  }, [svgRef, nestedData, filters, width, height])

  return (
    <div ref={observe} style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ height: 50 }}>
        {filters.map((x, i) => <>
          <button type="button" onClick={() => navigateTo(x, i)}>{x}</button>
        </>)}
        {/* {JSON.stringify(filters)} */}
      </div>
      <svg ref={svgRef} width={width} height={height - 50}>
      </svg>
    </div>
  );
}

export default Treemap;

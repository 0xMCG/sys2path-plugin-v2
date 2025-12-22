import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GraphData } from '../../types';

interface GraphViewProps {
  data: GraphData;
  activeNodeId?: string | null;
  onNodeClick: (nodeId: string) => void;
  width?: number;
  height?: number;
}

const GraphView: React.FC<GraphViewProps> = ({ data, activeNodeId, onNodeClick, width = 600, height = 400 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [internalActiveNode, setInternalActiveNode] = useState<string | null>(null);
  const [edgePopup, setEdgePopup] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => {
    if (activeNodeId !== undefined) {
      setInternalActiveNode(activeNodeId);
    }
  }, [activeNodeId]);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    const linkGroup = svg.append("g");
    
    const linkHitArea = linkGroup
      .selectAll(".link-hit")
      .data(data.links)
      .join("line")
      .attr("stroke", "transparent")
      .attr("stroke-width", 10)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
         event.stopPropagation();
         const summary = d.summary || `Relation between ${(d.source as any).id} and ${(d.target as any).id}`;
         const [x, y] = d3.pointer(event, svgRef.current);
         setEdgePopup({ x, y, content: summary });
         setInternalActiveNode(null);
      });

    const link = linkGroup
      .selectAll(".link-visible")
      .data(data.links)
      .join("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.6)
      .attr("pointer-events", "none")
      .attr("stroke-width", (d) => Math.sqrt(d.value));

    const node = svg.append("g")
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d) => 5 + (d.rank * 15))
      .attr("fill", (d) => {
         if (d.id === internalActiveNode) return "#3b82f6";
         return d.group === 1 ? "#64748b" : "#94a3b8";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .call(drag(simulation) as any)
      .on("click", (event, d) => {
        event.stopPropagation();
        setInternalActiveNode(d.id);
        onNodeClick(d.id);
        setEdgePopup(null);
      });

    const label = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text(d => d.id)
      .attr("font-size", "10px")
      .attr("font-family", "sans-serif")
      .attr("fill", "#1e293b")
      .attr("pointer-events", "none")
      .attr("dx", 12)
      .attr("dy", 4);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkHitArea
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
      
      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            svg.selectAll("g").attr("transform", event.transform);
            setEdgePopup(null);
        });
    
    svg.call(zoom as any);
    
    d3.select(svgRef.current).on("click", () => {
        setInternalActiveNode(null);
        setEdgePopup(null);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height, internalActiveNode, onNodeClick]);

  function drag(simulation: d3.Simulation<any, undefined>) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div className="w-full h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative group">
      <svg ref={svgRef} width="100%" height="100%" />
      
      {edgePopup && (
        <div 
          className="absolute bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg z-20 max-w-[200px]"
          style={{ left: edgePopup.x, top: edgePopup.y - 40 }}
        >
            {edgePopup.content}
            <div className="absolute top-full left-4 -ml-2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}

      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur border border-slate-200 shadow-sm rounded-md p-2 max-h-48 overflow-y-auto w-40 z-10 transition-opacity opacity-50 hover:opacity-100">
        <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Top Entities</h4>
        <ul className="space-y-1">
          {[...data.nodes].sort((a,b) => b.rank - a.rank).map(node => (
             <li 
               key={node.id} 
               onClick={(e) => {
                 e.stopPropagation();
                 setInternalActiveNode(node.id);
                 onNodeClick(node.id);
               }}
               className={`text-xs cursor-pointer px-2 py-1.5 rounded flex justify-between gap-2 border ${
                 internalActiveNode === node.id 
                 ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' 
                 : 'border-transparent hover:bg-slate-100 text-slate-700'
               }`}
             >
               <span className="truncate">{node.id}</span>
               <span className="text-slate-400 font-mono text-[10px]">{(node.rank * 10).toFixed(1)}</span>
             </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GraphView;


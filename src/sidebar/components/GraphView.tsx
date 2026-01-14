import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RotateCcw } from 'lucide-react';
import type { GraphData } from '../../types';
import type { MVGResponse } from '../../types/api';

interface GraphViewProps {
  data?: GraphData;
  mvgData?: MVGResponse;
  activeNodeId?: string | null;
  onNodeClick: (nodeId: string) => void;
  width?: number;
  height?: number;
}

// Helper function to find connected components using DFS
function findConnectedComponents(nodes: any[], links: any[]): any[][] {
  // Create a map from node ID to original node reference (not a copy!)
  const nodeMap = new Map<string, any>();
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
  });

  // Build adjacency list using node IDs (separate from node objects)
  const adjacencyList = new Map<string, Set<string>>();
  nodes.forEach(node => {
    adjacencyList.set(node.id, new Set<string>());
  });

  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
    const sourceNeighbors = adjacencyList.get(sourceId);
    const targetNeighbors = adjacencyList.get(targetId);
    if (sourceNeighbors && targetNeighbors) {
      sourceNeighbors.add(targetId);
      targetNeighbors.add(sourceId);
    }
  });

  const visited = new Set<string>();
  const components: any[][] = [];

  // DFS to find all connected components
  function dfs(nodeId: string, component: any[]): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      // Push the ORIGINAL node reference, not a copy
      component.push(node);
      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        neighbors.forEach((neighborId: string) => {
          if (!visited.has(neighborId)) {
            dfs(neighborId, component);
          }
        });
      }
    }
  }

  // Find all components
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component: any[] = [];
      dfs(node.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });

  return components;
}

// Helper function to calculate node bounds
function calculateNodeBounds(nodes: any[]): { x: number; y: number; width: number; height: number } {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const padding = 50; // 边距
  
  nodes.forEach(node => {
    const radius = 5 + (node.rank * 15) || 20;
    const x = node.x || 0;
    const y = node.y || 0;
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + radius);
  });
  
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + 2 * padding,
    height: (maxY - minY) + 2 * padding
  };
}

// Helper function to find connected nodes and edges for a given node
function findConnectedNodesAndEdges(
  nodeId: string,
  links: any[]
): { connectedNodeIds: Set<string>, connectedEdgeIndices: number[] } {
  const connectedNodeIds = new Set<string>();
  const connectedEdgeIndices: number[] = [];
  
  links.forEach((link, index) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    
    if (sourceId === nodeId || targetId === nodeId) {
      connectedEdgeIndices.push(index);
      if (sourceId === nodeId) {
        connectedNodeIds.add(targetId);
      }
      if (targetId === nodeId) {
        connectedNodeIds.add(sourceId);
      }
    }
  });
  
  return { connectedNodeIds, connectedEdgeIndices };
}

// Helper function to check if two component bounds overlap
function checkComponentOverlap(
  bounds1: { x: number; y: number; width: number; height: number },
  bounds2: { x: number; y: number; width: number; height: number },
  minSpacing: number = 0
): boolean {
  return !(
    bounds1.x + bounds1.width + minSpacing < bounds2.x ||
    bounds2.x + bounds2.width + minSpacing < bounds1.x ||
    bounds1.y + bounds1.height + minSpacing < bounds2.y ||
    bounds2.y + bounds2.height + minSpacing < bounds1.y
  );
}

// Helper function to check all components for overlaps
function hasAnyOverlap(
  componentBounds: Array<{ x: number; y: number; width: number; height: number }>,
  minSpacing: number
): boolean {
  for (let i = 0; i < componentBounds.length; i++) {
    for (let j = i + 1; j < componentBounds.length; j++) {
      if (checkComponentOverlap(componentBounds[i], componentBounds[j], minSpacing)) {
        return true;
      }
    }
  }
  return false;
}

// Helper function to calculate component bounds including edges
function calculateComponentBounds(
  component: any[], 
  links: any[],
  padding: number = 30
): { x: number; y: number; width: number; height: number } {
  if (component.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  const componentNodeIds = new Set(component.map(n => n.id));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  // Consider all nodes in the component
  component.forEach(node => {
    const radius = 5 + (node.rank * 15) || 20;
    const x = node.x || 0;
    const y = node.y || 0;
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + radius);
  });
  
  // Consider all edges within this component (both endpoints are in the component)
  // Edges are straight lines, so endpoints are already covered by node bounds
  // But we verify completeness and ensure edge visualization space is included
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
    
    // Only consider edges where both nodes are in this component
    if (componentNodeIds.has(sourceId) && componentNodeIds.has(targetId)) {
      const sourceNode = component.find(n => n.id === sourceId);
      const targetNode = component.find(n => n.id === targetId);
      
      if (sourceNode && targetNode) {
        const sourceX = sourceNode.x || 0;
        const sourceY = sourceNode.y || 0;
        const sourceRadius = 5 + (sourceNode.rank * 15) || 20;
        const targetX = targetNode.x || 0;
        const targetY = targetNode.y || 0;
        const targetRadius = 5 + (targetNode.rank * 15) || 20;
        
        // Ensure endpoints with radii are included (edge connects to node edge, not center)
        // This is redundant with node bounds but ensures completeness
        minX = Math.min(minX, sourceX - sourceRadius, targetX - targetRadius);
        minY = Math.min(minY, sourceY - sourceRadius, targetY - targetRadius);
        maxX = Math.max(maxX, sourceX + sourceRadius, targetX + targetRadius);
        maxY = Math.max(maxY, sourceY + sourceRadius, targetY + targetRadius);
      }
    }
  });
  
  // Use fixed padding to avoid excessive bounds expansion
  // Dynamic padding was causing views to be too zoomed out
  return {
    x: minX - padding,
    y: minY - padding,
    width: (maxX - minX) + 2 * padding,
    height: (maxY - minY) + 2 * padding
  };
}

// Helper function to layout components compactly
function layoutComponentsCompact(
  components: any[][],
  links: any[],
  width: number,
  height: number,
  spacing: number = 120,
  componentPadding: number = 30
): void {
  if (components.length === 0) return;
  if (components.length === 1) {
    // Single component: center it
    const bounds = calculateComponentBounds(components[0], links, componentPadding);
    const offsetX = (width - bounds.width) / 2 - bounds.x;
    const offsetY = (height - bounds.height) / 2 - bounds.y;
    components[0].forEach(node => {
      node.x = (node.x || 0) + offsetX;
      node.y = (node.y || 0) + offsetY;
    });
    return;
  }

  // Try layout with increasing spacing until no overlap
  let currentSpacing = spacing;
  let maxIterations = 5; // Reduced iterations to prevent excessive spacing
  let iteration = 0;
  let componentBounds = components.map(comp => calculateComponentBounds(comp, links, componentPadding));
  
  while (iteration < maxIterations) {
    // Recalculate bounds with current spacing
    componentBounds = components.map(comp => calculateComponentBounds(comp, links, componentPadding));
    
    // Circular layout: arrange components in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate radius: ensure all components fit with spacing
    // Use the maximum component size plus spacing to determine minimum radius
    const maxComponentSize = Math.max(
      ...componentBounds.map(b => Math.max(b.width, b.height))
    );
    const minRadius = (maxComponentSize + currentSpacing) / (2 * Math.sin(Math.PI / components.length));
    
    // Use a reasonable radius that fits in the viewport
    const availableRadius = Math.min(width, height) * 0.35; // Use 35% of viewport
    const radius = Math.max(minRadius, availableRadius);
    
    // Layout components in a circle
    components.forEach((component, index) => {
      const bounds = componentBounds[index];
      
      // Calculate angle for this component (start from top, go clockwise)
      const angle = (index / components.length) * Math.PI * 2 - Math.PI / 2; // Start from top
      
      // Calculate target center position on the circle
      const targetCenterX = centerX + Math.cos(angle) * radius;
      const targetCenterY = centerY + Math.sin(angle) * radius;
      
      // Calculate offset to move component to target position
      const currentCenterX = bounds.x + bounds.width / 2;
      const currentCenterY = bounds.y + bounds.height / 2;
      const offsetX = targetCenterX - currentCenterX;
      const offsetY = targetCenterY - currentCenterY;
      
      // Apply offset to all nodes in the component
      component.forEach(node => {
        node.x = (node.x || 0) + offsetX;
        node.y = (node.y || 0) + offsetY;
      });
    });
    
    // Recalculate bounds after layout
    componentBounds = components.map(comp => calculateComponentBounds(comp, links, componentPadding));
    
    // Check for overlaps with reasonable spacing requirement
    const minSpacing = componentPadding * 0.3; // Reduced from 0.8 to prevent excessive spacing
    if (!hasAnyOverlap(componentBounds, minSpacing)) {
      // No overlap, we're done
      break;
    }
    
    // Has overlap, increase spacing and try again
    // Use moderate increment to prevent excessive spacing
    currentSpacing = currentSpacing * 1.3; // Reduced from 1.8 to 1.3
    iteration++;
  }
  
  // If still overlapping after max iterations, log a warning
  if (iteration >= maxIterations) {
    componentBounds = components.map(comp => calculateComponentBounds(comp, links, componentPadding));
    if (hasAnyOverlap(componentBounds, componentPadding)) {
      // This is a fallback - the layout should have worked, but if not, we log a warning
      console.warn('Component overlap detected after max iterations. Consider increasing spacing or padding.');
    }
  }
}

// Helper function to check if node is in view
function isNodeInView(
  node: any,
  transform: d3.ZoomTransform,
  viewWidth: number,
  viewHeight: number
): boolean {
  const nodeX = node.x || 0;
  const nodeY = node.y || 0;
  const radius = 5 + (node.rank * 15) || 20;
  
  // Calculate screen coordinates
  const screenX = nodeX * transform.k + transform.x;
  const screenY = nodeY * transform.k + transform.y;
  
  // Check if node (with radius) is in view with margin
  const margin = 50;
  return screenX >= -radius - margin && 
         screenX <= viewWidth + radius + margin &&
         screenY >= -radius - margin && 
         screenY <= viewHeight + radius + margin;
}

// Helper function to calculate optimal scale for focusing on a node
function calculateOptimalScale(
  viewWidth: number,
  viewHeight: number,
  currentScale: number = 1
): number {
  // Calculate a scale that shows the node and some surrounding area
  // Use a reasonable default scale based on view size
  const baseScale = Math.min(viewWidth / 800, viewHeight / 600, 1.0);
  
  // If current scale is reasonable, use it as reference
  if (currentScale > 0.3 && currentScale < 2) {
    return Math.min(Math.max(currentScale, 0.5), 1.5);
  }
  
  return Math.min(Math.max(baseScale, 0.5), 1.2);
}

// Helper function to get layout parameters based on window size
function getLayoutParams(width: number, height: number) {
  const isSmallWindow = width < 600 || height < 400;
  return {
    spacing: isSmallWindow ? 30 : 45,  // Reduced by 50% more (from 60/90 to 30/45)
    nodeRadiusMultiplier: isSmallWindow ? 0.8 : 1.0,
    linkDistance: isSmallWindow ? 80 : 100,
    fontSize: isSmallWindow ? '9px' : '10px',
    componentPadding: isSmallWindow ? 18 : 30  // Reduced by 50% more (from 36/60 to 18/30)
  };
}

// Helper function to calculate fitted transform
function calculateFittedTransform(
  bounds: { x: number; y: number; width: number; height: number },
  viewWidth: number,
  viewHeight: number
): d3.ZoomTransform {
  if (bounds.width === 0 || bounds.height === 0) {
    return d3.zoomIdentity;
  }
  
  // Calculate scale with reasonable padding
  // Allow slight zoom in if content is small, but limit zoom out
  const scale = Math.min(
    viewWidth / bounds.width,
    viewHeight / bounds.height,
    1.2 // Allow slight zoom in (20%) for better visibility
  ) * 0.95; // 留 5% 边距 (reduced from 10% to show more content)
  
  const translateX = (viewWidth - bounds.width * scale) / 2 - bounds.x * scale;
  const translateY = (viewHeight - bounds.height * scale) / 2 - bounds.y * scale;
  
  return d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(scale);
}

const GraphView: React.FC<GraphViewProps> = ({ data, mvgData, activeNodeId, onNodeClick, width = 600, height = 400 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);
  const initialTransformRef = useRef<d3.ZoomTransform | null>(null);
  const bestInitialViewRef = useRef<d3.ZoomTransform | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const previousNodeIdsRef = useRef<string>(''); // Track previous node IDs
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [internalActiveNode, setInternalActiveNode] = useState<string | null>(null);
  const [edgePopup, setEdgePopup] = useState<{ x: number; y: number; content: string } | null>(null);
  const [weightThreshold, setWeightThreshold] = useState<number>(0);

  // Keep onNodeClick ref up to date
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Convert MVG data to GraphData format and filter by weight threshold
  const graphData = useMemo<GraphData>(() => {
    let allNodes: any[] = [];
    let allEdges: any[] = [];

    if (mvgData) {
      // Convert MVG nodes to D3 nodes
      allNodes = mvgData.nodes.map(node => ({
        id: node.id,
        label: node.label,
        rank: node.value,
        group: 1,
      }));

      // Convert MVG edges to D3 edges
      allEdges = mvgData.edges.map(edge => ({
        source: edge.from_node,
        target: edge.to_node,
        value: edge.chunks.length,
        chunks: edge.chunks,
        summary: `Connected via ${edge.chunks.length} chunk(s)`,
      }));
    } else if (data) {
      allNodes = data.nodes;
      allEdges = data.links;
    }

    // Filter nodes by weight threshold
    const filteredNodes = allNodes.filter(node => node.rank >= weightThreshold);
    const nodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter edges: only keep edges where both source and target nodes pass the threshold
    const filteredEdges = allEdges.filter(edge => {
      const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes: filteredNodes, links: filteredEdges };
  }, [mvgData, data, weightThreshold]);

  // Monitor container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver if available for more accurate tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (activeNodeId !== undefined) {
      setInternalActiveNode(activeNodeId);
    }
  }, [activeNodeId]);

  // Handle dimension changes - re-fit view if needed
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (!svgRef.current || !graphData.nodes.length) return;
    if (!zoomBehaviorRef.current) return;

    // If we have a best initial view, recalculate it with new dimensions
    if (bestInitialViewRef.current && simulationRef.current) {
      // Wait a bit for simulation to stabilize if it's running
      const timeoutId = setTimeout(() => {
        const bounds = calculateNodeBounds(graphData.nodes);
        const fittedTransform = calculateFittedTransform(
          bounds,
          dimensions.width,
          dimensions.height
        );
        
        // Update best initial view
        bestInitialViewRef.current = fittedTransform;
        
        // If current transform is close to the old best view, update to new best view
        const currentTransform = zoomTransformRef.current;
        if (currentTransform && bestInitialViewRef.current &&
            Math.abs(currentTransform.k - bestInitialViewRef.current.k) < 0.1) {
          const svg = d3.select(svgRef.current);
          svg.transition()
            .duration(500)
            .call(zoomBehaviorRef.current!.transform as any, fittedTransform)
            .on("end", () => {
              zoomTransformRef.current = fittedTransform;
            });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [dimensions.width, dimensions.height, graphData.nodes.length]);

  // Helper function to focus on a node with intelligent scaling
  const focusOnNode = useCallback((nodeId: string) => {
    if (!svgRef.current || !zoomTransformRef.current || !zoomBehaviorRef.current) return;
    if (dimensions.width === 0 || dimensions.height === 0) return;
    
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node || node.x === undefined || node.y === undefined) return;
    
    const svg = d3.select(svgRef.current);
    const currentTransform = zoomTransformRef.current;
    const actualWidth = dimensions.width || width;
    const actualHeight = dimensions.height || height;
    
    // Check if node is in view
    const nodeInView = isNodeInView(node, currentTransform, actualWidth, actualHeight);
    
    let targetTransform: d3.ZoomTransform;
    
    if (nodeInView) {
      // Node is in view: keep current scale, just translate to center
      const nodeX = node.x;
      const nodeY = node.y;
      const targetX = actualWidth / 2 - nodeX * currentTransform.k;
      const targetY = actualHeight / 2 - nodeY * currentTransform.k;
      targetTransform = d3.zoomIdentity
        .translate(targetX, targetY)
        .scale(currentTransform.k);
    } else {
      // Node is not in view: calculate optimal scale and translate
      const nodeX = node.x;
      const nodeY = node.y;
      const optimalScale = calculateOptimalScale(actualWidth, actualHeight, currentTransform.k);
      const targetX = actualWidth / 2 - nodeX * optimalScale;
      const targetY = actualHeight / 2 - nodeY * optimalScale;
      targetTransform = d3.zoomIdentity
        .translate(targetX, targetY)
        .scale(optimalScale);
    }
    
    svg.transition()
      .duration(750)
      .ease(d3.easeCubicInOut)
      .call(zoomBehaviorRef.current.transform as any, targetTransform)
      .on("end", () => {
        zoomTransformRef.current = targetTransform;
      });
  }, [dimensions.width, dimensions.height, graphData.nodes, width, height]);

  // Drag function factory
  const createDrag = useCallback((simulation: d3.Simulation<any, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      // Clear fixed position to allow dragging
      event.subject.fx = null;
      event.subject.fy = null;
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep the dragged position fixed
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;
    // Wait for dimensions to be available
    if (dimensions.width === 0 || dimensions.height === 0) return;

    // Clean up previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Check if node IDs have changed (data has changed)
    const currentNodeIds = graphData.nodes.map(n => n.id).sort().join(',');
    const hasDataChanged = previousNodeIdsRef.current !== currentNodeIds;
    
    if (hasDataChanged) {
      previousNodeIdsRef.current = currentNodeIds;
      
      // Reset all view-related refs when data changes
      zoomTransformRef.current = d3.zoomIdentity;
      initialTransformRef.current = d3.zoomIdentity;
      bestInitialViewRef.current = null;
      
      // Clear all fixed positions and reset positions only when data changes
      graphData.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
        // Only reset position when data actually changes
        node.x = undefined;
        node.y = undefined;
      });
      
      // Clear SVG element's zoom state before clearing content
      if (svgRef.current) {
        const svgElement = d3.select(svgRef.current);
        // Remove any zoom event listeners
        svgElement.on(".zoom", null);
        // Remove any transform attributes
        svgElement.attr("transform", null);
      }
    } else {
      // If data hasn't changed, only clear fixed positions
      graphData.nodes.forEach(node => {
        node.fx = null;
        node.fy = null;
        // Keep existing x/y positions
      });
    }

    d3.select(svgRef.current).selectAll("*").remove();

    // Clear D3 zoom internal state (__zoom property) if it exists
    // D3 stores zoom transform state on the element, we need to clear it
    if (svgRef.current && hasDataChanged) {
      const svgElement = svgRef.current as any;
      if (svgElement.__zoom) {
        delete svgElement.__zoom;
      }
    }

    const actualWidth = dimensions.width || width;
    const actualHeight = dimensions.height || height;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, actualWidth, actualHeight]);

    // Find connected components
    const components = findConnectedComponents(graphData.nodes, graphData.links);
    
    // Initialize node positions - compact random initialization
    // Let force simulation stabilize components internally first
    graphData.nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) {
        // Initialize all nodes in a compact area around center
        node.x = actualWidth / 2 + (Math.random() - 0.5) * Math.min(actualWidth, actualHeight) * 0.4;
        node.y = actualHeight / 2 + (Math.random() - 0.5) * Math.min(actualWidth, actualHeight) * 0.4;
      }
    });
    
    // Get layout parameters based on window size
    const layoutParams = getLayoutParams(actualWidth, actualHeight);
    
    // Create simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(layoutParams.linkDistance))
      .force("charge", d3.forceManyBody().strength(-50))
      .force("collide", d3.forceCollide().radius((d: any) => 30 + (d.rank * 15 || 0)))
      .alphaDecay(0.3)  // Increased decay rate to complete simulation in ~0.3 seconds
      .alpha(1);  // Set initial alpha value

    // For single component, use center force
    if (components.length === 1) {
      simulation.force("center", d3.forceCenter(actualWidth / 2, actualHeight / 2));
    }

    simulationRef.current = simulation;

    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const labelGroup = svg.append("g").attr("class", "labels");
    
    const linkHitArea = linkGroup
      .selectAll(".link-hit")
      .data(graphData.links)
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
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return "#3b82f6"; // Highlighted edge - blue
          }
        }
        return "#94a3b8"; // Default
      })
      .attr("stroke-opacity", (d) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return 1.0; // Full opacity for highlighted
          }
          return 0.2; // Dimmed for non-highlighted
        }
        return 0.6; // Default
      })
      .attr("pointer-events", "none")
      .attr("stroke-width", (d) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return Math.sqrt(d.value) * 2; // Thicker for highlighted
          }
        }
        return Math.sqrt(d.value); // Default
      });

    // Get connected nodes if there's an active node
    let connectedNodeIds = new Set<string>();
    if (internalActiveNode) {
      const result = findConnectedNodesAndEdges(internalActiveNode, graphData.links);
      connectedNodeIds = result.connectedNodeIds;
    }

    const node = nodeGroup
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", (d) => (5 + (d.rank * 15)) * layoutParams.nodeRadiusMultiplier)
      .attr("fill", (d) => {
        if (d.id === internalActiveNode) return "#3b82f6"; // Selected node
        if (connectedNodeIds.has(d.id)) return "#60a5fa"; // Connected node - lighter blue
        return d.group === 1 ? "#64748b" : "#94a3b8"; // Default
      })
      .attr("stroke", (d) => {
        if (d.id === internalActiveNode) return "#1e40af"; // Selected node border
        if (connectedNodeIds.has(d.id)) return "#3b82f6"; // Connected node border
        return "#fff"; // Default
      })
      .attr("stroke-width", (d) => {
        if (d.id === internalActiveNode || connectedNodeIds.has(d.id)) return 3; // Thicker border for selected/connected
        return 2; // Default
      })
      .attr("cursor", "pointer")
      .call(createDrag(simulation) as any)
      .on("click", (event, d) => {
        event.stopPropagation();
        setInternalActiveNode(d.id);
        // Use ref to avoid dependency issues
        onNodeClickRef.current(d.id);
        setEdgePopup(null);
        
        // Smooth focus on clicked node
        focusOnNode(d.id);
      });

    const label = labelGroup
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text(d => d.label || d.id)
      .attr("font-size", layoutParams.fontSize)
      .attr("font-family", "sans-serif")
      .attr("fill", "#1e293b")
      .attr("pointer-events", "none")
      .attr("dx", 12)
      .attr("dy", 4);

    let layoutStage = 0; // 0: initial stabilization, 1: compact layout applied, 2: final fit
    let hasAutoFitted = false;
    
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

    // Two-stage layout: stabilize components, then compact layout
    simulation.on("end", () => {
      if (graphData.nodes.length === 0) return;
      
      if (layoutStage === 0 && components.length > 1) {
        // Stage 1: Components are stabilized, now apply compact layout
        layoutStage = 1;
        
        // Debug: log component count
        console.log('[GraphView] Applying layout to', components.length, 'components');
        
        layoutComponentsCompact(components, graphData.links, actualWidth, actualHeight, layoutParams.spacing, layoutParams.componentPadding);
        
        // Fix all node positions to prevent diffusion
        graphData.nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            node.fx = node.x;
            node.fy = node.y;
          }
        });
        
        // CRITICAL: Manually update SVG elements to reflect new positions
        // The tick event won't fire after simulation.stop(), so we must update manually
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
        
        // Stop simulation instead of restarting
        simulation.stop();
        
        // Directly proceed to auto-fit
        if (hasAutoFitted) return;
        hasAutoFitted = true;
        layoutStage = 2;
        
        // Calculate bounds of all nodes after layout
        const bounds = calculateNodeBounds(graphData.nodes);
        
        // Debug: log bounds
        console.log('[GraphView] Node bounds after layout:', bounds);
        
        // Calculate fitted transform
        const fittedTransform = calculateFittedTransform(bounds, actualWidth, actualHeight);
        
        // Debug: log transform
        console.log('[GraphView] Fitted transform:', { k: fittedTransform.k, x: fittedTransform.x, y: fittedTransform.y });
        
        // Save as best initial view
        bestInitialViewRef.current = fittedTransform;
        initialTransformRef.current = fittedTransform;
        
        // Smooth transition to fitted view
        if (svgRef.current && zoomBehaviorRef.current) {
          const svgSelection = d3.select(svgRef.current);
          svgSelection
            .transition()
            .duration(750)
            .call(zoomBehaviorRef.current.transform as any, fittedTransform)
            .on("end", () => {
              zoomTransformRef.current = fittedTransform;
            });
        }
      } else if (layoutStage === 1 || (layoutStage === 0 && components.length === 1)) {
        // Stage 2: Final auto-fit
        if (hasAutoFitted) return;
        hasAutoFitted = true;
        layoutStage = 2;
        
        // Fix node positions for single component as well
        graphData.nodes.forEach(node => {
          node.fx = node.x;
          node.fy = node.y;
        });
        
        // Stop simulation
        simulation.stop();
        
        // Calculate bounds of all nodes
        const bounds = calculateNodeBounds(graphData.nodes);
        
        // Calculate fitted transform
        const fittedTransform = calculateFittedTransform(bounds, actualWidth, actualHeight);
        
        // Save as best initial view
        bestInitialViewRef.current = fittedTransform;
        initialTransformRef.current = fittedTransform;
        
        // Smooth transition to fitted view
        if (svgRef.current && zoomBehaviorRef.current) {
          const svgSelection = d3.select(svgRef.current);
          svgSelection
            .transition()
            .duration(750)
            .call(zoomBehaviorRef.current.transform as any, fittedTransform)
            .on("end", () => {
              zoomTransformRef.current = fittedTransform;
            });
        }
      }
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            const transform = event.transform;
            zoomTransformRef.current = transform;
            linkGroup.attr("transform", transform);
            nodeGroup.attr("transform", transform);
            labelGroup.attr("transform", transform);
            setEdgePopup(null);
        });
    
    zoomBehaviorRef.current = zoom;
    
    // Initialize zoom transform (will be updated by auto-fit)
    // For data changes, we already reset to zoomIdentity above
    // For first load, zoomTransformRef.current is null, so set it
    const initialTransform = d3.zoomIdentity;
    if (hasDataChanged || !zoomTransformRef.current) {
      zoomTransformRef.current = initialTransform;
    }
    if (hasDataChanged || !initialTransformRef.current) {
      initialTransformRef.current = initialTransform;
    }
    
    // Remove any existing zoom behavior before applying new one
    // This ensures clean state, just like first load
    if (svgRef.current) {
      d3.select(svgRef.current).on(".zoom", null);
    }
    
    svg.call(zoom);
    
    // Note: We don't explicitly apply transform here to match first load behavior
    // On first load, groups start without transform (identity), and transform is only
    // applied when auto-fit runs or user interacts. This ensures data switching
    // behaves exactly like first load.
    
    // Handle click on background - only clear selection, don't change view
    d3.select(svgRef.current).on("click", (event) => {
      // Only clear if clicking directly on SVG background, not on nodes/links
      const target = event.target as SVGElement;
      if (target === svgRef.current || target.tagName === 'svg') {
        setInternalActiveNode(null);
        setEdgePopup(null);
        // Don't change view transform - keep current view stable
      }
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions.width, dimensions.height, width, height, weightThreshold]);

  // Update node and edge visual state when internalActiveNode changes
  useEffect(() => {
    if (!svgRef.current || !graphData.nodes.length) return;
    
    const svg = d3.select(svgRef.current);
    const nodeGroup = svg.select(".nodes");
    const linkGroup = svg.select(".links");
    
    if (nodeGroup.empty() || linkGroup.empty()) return;
    
    // Get connected nodes if there's an active node
    let connectedNodeIds = new Set<string>();
    if (internalActiveNode) {
      const result = findConnectedNodesAndEdges(internalActiveNode, graphData.links);
      connectedNodeIds = result.connectedNodeIds;
    }
    
    // Update node fill color and stroke
    nodeGroup
      .selectAll("circle")
      .attr("fill", (d: any) => {
        if (d.id === internalActiveNode) return "#3b82f6";
        if (connectedNodeIds.has(d.id)) return "#60a5fa";
        return d.group === 1 ? "#64748b" : "#94a3b8";
      })
      .attr("stroke", (d: any) => {
        if (d.id === internalActiveNode) return "#1e40af";
        if (connectedNodeIds.has(d.id)) return "#3b82f6";
        return "#fff";
      })
      .attr("stroke-width", (d: any) => {
        if (d.id === internalActiveNode || connectedNodeIds.has(d.id)) return 3;
        return 2;
      });
    
    // Update edge styles
    linkGroup
      .selectAll(".link-visible")
      .attr("stroke", (d: any) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return "#3b82f6";
          }
        }
        return "#94a3b8";
      })
      .attr("stroke-opacity", (d: any) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return 1.0;
          }
          return 0.2;
        }
        return 0.6;
      })
      .attr("stroke-width", (d: any) => {
        if (internalActiveNode) {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const targetId = typeof d.target === 'object' ? d.target.id : d.target;
          if (sourceId === internalActiveNode || targetId === internalActiveNode) {
            return Math.sqrt(d.value) * 2;
          }
        }
        return Math.sqrt(d.value);
      });
  }, [internalActiveNode, graphData.nodes, graphData.links]);

  // Reset view function
  const resetView = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    
    // Use best initial view if available, otherwise use initial transform
    const targetTransform = bestInitialViewRef.current || initialTransformRef.current || d3.zoomIdentity;
    
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform as any, targetTransform)
      .on("end", () => {
        zoomTransformRef.current = targetTransform;
      });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative group flex flex-col">
      {/* Weight filter slider */}
      <div className="absolute top-2 left-2 z-20 bg-white/95 backdrop-blur border border-slate-200 shadow-sm rounded-md p-2 min-w-[200px]">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Weight Threshold
          </label>
          <span className="text-xs text-slate-600 font-mono">
            {(weightThreshold * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={weightThreshold}
          onChange={(e) => setWeightThreshold(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${weightThreshold * 100}%, #e2e8f0 ${weightThreshold * 100}%, #e2e8f0 100%)`
          }}
        />
      </div>
      <svg ref={svgRef} width="100%" height="100%" className="flex-1" />
      
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
          {[...graphData.nodes].sort((a,b) => b.rank - a.rank).map(node => (
             <li 
               key={node.id} 
               onClick={(e) => {
                 e.stopPropagation();
                 setInternalActiveNode(node.id);
                 onNodeClickRef.current(node.id);
                 focusOnNode(node.id);
               }}
               className={`text-xs cursor-pointer px-2 py-1.5 rounded flex justify-between gap-2 border ${
                 internalActiveNode === node.id 
                 ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' 
                 : 'border-transparent hover:bg-slate-100 text-slate-700'
               }`}
             >
               <span className="truncate">{node.label || node.id}</span>
               <span className="text-slate-400 font-mono text-[10px]">{(node.rank * 10).toFixed(1)}</span>
             </li>
          ))}
        </ul>
      </div>

      {/* Reset View Button */}
      <button
        onClick={resetView}
        className="absolute bottom-4 right-4 z-20 p-2 bg-white/95 backdrop-blur border border-slate-200 shadow-sm rounded-full hover:bg-slate-50 hover:shadow-md transition-all flex items-center justify-center"
        title="Reset view to initial position"
      >
        <RotateCcw size={16} className="text-slate-600" />
      </button>
    </div>
  );
};

export default GraphView;


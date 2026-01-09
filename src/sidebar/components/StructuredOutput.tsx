// 结构化输出组件
import React, { useMemo } from 'react';
import type { MVGResponse } from '../../types/api';

interface StructuredOutputProps {
  data: string; // JSON string
  mvgData?: MVGResponse | null; // Optional MVG data for entity name mapping
}

export const StructuredOutput: React.FC<StructuredOutputProps> = ({
  data,
  mvgData,
}) => {
  let parsedData: any = null;
  try {
    parsedData = JSON.parse(data);
  } catch (error) {
    console.error('[STRUCTURED_OUTPUT] Failed to parse JSON:', error);
  }

  if (!parsedData) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
        Failed to parse structured output
      </div>
    );
  }

  // Create entity ID to name mapping
  const entityIdToName = useMemo(() => {
    if (!mvgData?.nodes) return new Map<string, string>();
    const map = new Map<string, string>();
    mvgData.nodes.forEach(node => {
      map.set(node.id, node.label);
    });
    return map;
  }, [mvgData]);

  // Parse entity pair key (format: "entity_a_entity_b")
  // The key format from backend is: f"{entity_a}_{entity_b}"
  // Since entity IDs are UUIDs (contain hyphens), we can find the split point
  const parseEntityPairKey = (key: string): string => {
    if (!key.includes('_') || entityIdToName.size === 0) {
      return key;
    }
    
    // Find the split point: look for underscore that separates two UUIDs
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
    // We need to find the underscore that's between two UUIDs
    const underscoreIndex = key.indexOf('_');
    if (underscoreIndex > 0) {
      // Try splitting at the first underscore
      const part1 = key.substring(0, underscoreIndex);
      const part2 = key.substring(underscoreIndex + 1);
      
      // Check if both parts look like UUIDs (contain hyphens and reasonable length)
      if (part1.includes('-') && part2.includes('-') && 
          part1.length > 20 && part2.length > 20) {
        const name1 = entityIdToName.get(part1) || part1;
        const name2 = entityIdToName.get(part2) || part2;
        return `${name1} → ${name2}`;
      }
    }
    
    // Fallback: if we can't parse, return original key
    return key;
  };

  // Check if an array is a path (contains entity IDs)
  const isPathArray = (arr: any[]): boolean => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    // Check if all items are strings that look like UUIDs (contain hyphens)
    return arr.every(item => 
      typeof item === 'string' && 
      item.includes('-') && 
      item.length > 20
    );
  };

  // Render path array with entity names
  const renderPath = (path: string[]): React.ReactNode => {
    if (entityIdToName.size > 0) {
      const pathNames = path.map(id => entityIdToName.get(id) || id);
      return <span className="text-blue-600 font-medium">{pathNames.join(' → ')}</span>;
    }
    return <span className="text-blue-600">{path.join(' → ')}</span>;
  };

  const renderValue = (value: any, depth: number = 0, key?: string): React.ReactNode => {
    if (depth > 3) {
      return <span className="text-gray-400">...</span>;
    }

    if (value === null) {
      return <span className="text-gray-400">null</span>;
    }

    if (typeof value === 'string') {
      return <span className="text-blue-600">"{value}"</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-green-600">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-purple-600">{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      // Check if this is a path array
      if (key === 'path' && isPathArray(value)) {
        return renderPath(value);
      }
      return (
        <div className="ml-4 border-l-2 border-gray-200 pl-2">
          {value.map((item, index) => (
            <div key={index} className="mb-1">
              <span className="text-gray-500">[{index}]: </span>
              {renderValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="ml-4 border-l-2 border-gray-200 pl-2">
          {Object.entries(value).map(([objKey, val]) => (
            <div key={objKey} className="mb-1">
              <span className="text-gray-700 font-medium">{objKey}:</span>{' '}
              {renderValue(val, depth + 1, objKey)}
            </div>
          ))}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Content area - removed copy button and padding adjustment */}
      <div className="flex-1 overflow-y-auto p-4 text-sm font-mono">
        {Object.entries(parsedData).map(([key, value]) => (
          <div key={key} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0">
            <div className="text-gray-900 font-semibold mb-2 text-base">
              {parseEntityPairKey(key)}
            </div>
            {renderValue(value, 0)}
          </div>
        ))}
      </div>
    </div>
  );
};


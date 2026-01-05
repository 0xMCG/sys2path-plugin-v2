// 结构化输出组件
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface StructuredOutputProps {
  data: string; // JSON string
  onExpand?: () => void;
}

export const StructuredOutput: React.FC<StructuredOutputProps> = ({
  data,
  onExpand,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  let parsedData: any = null;
  try {
    parsedData = JSON.parse(data);
  } catch (error) {
    console.error('[STRUCTURED_OUTPUT] Failed to parse JSON:', error);
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    onExpand?.();
  };

  if (!parsedData) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
        Failed to parse structured output
      </div>
    );
  }

  const renderValue = (value: any, depth: number = 0): React.ReactNode => {
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
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="mb-1">
              <span className="text-gray-700 font-medium">{key}:</span>{' '}
              {renderValue(val, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-md bg-white">
      <div
        className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={toggleExpand}
      >
        <h3 className="text-sm font-semibold text-gray-700">
          Structured Output
        </h3>
        {isExpanded ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </div>
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 text-sm font-mono">
          {renderValue(parsedData)}
        </div>
      )}
    </div>
  );
};


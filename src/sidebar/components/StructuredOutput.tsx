// 结构化输出组件
import React from 'react';

interface StructuredOutputProps {
  data: string; // JSON string
}

export const StructuredOutput: React.FC<StructuredOutputProps> = ({
  data,
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
    <div className="flex flex-col h-full bg-white">
      {/* Content area - removed copy button and padding adjustment */}
      <div className="flex-1 overflow-y-auto p-4 text-sm font-mono">
        {renderValue(parsedData)}
      </div>
    </div>
  );
};


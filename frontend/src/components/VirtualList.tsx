import React from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscanCount?: number;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className = '',
  overscanCount = 5,
}: VirtualListProps<T>) {
  const [ListComponent, setListComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Dynamic import to handle CommonJS module properly
    import('react-window')
      .then((module) => {
        // Try to get FixedSizeList - check multiple possible locations
        const component = 
          module.FixedSizeList || 
          (module as any).FixedSizeList ||
          (module as any).default?.FixedSizeList || 
          (module as any)['FixedSizeList'];
        
        if (component) {
          setListComponent(component);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load react-window:', err);
        setIsLoading(false);
      });
  }, []);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      {renderItem(items[index], index)}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-gray-500">No items to display</p>
      </div>
    );
  }

  // Show fallback list while loading or if component not available
  if (!ListComponent || isLoading) {
    return (
      <div className={className} style={{ height: 'auto' }}>
        {items.map((item, index) => (
          <div key={index} style={{ height: itemHeight }}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <ListComponent
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
      overscanCount={overscanCount}
      className={className}
    >
      {Row}
    </ListComponent>
  );
}

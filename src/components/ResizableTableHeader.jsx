import { useCallback } from 'react';

const ResizableTableHeader = ({ columns, columnWidths, setColumnWidths, actionColumnTitle = 'Details' }) => {
    const startResizing = useCallback((e, colKey) => {
        e.preventDefault();
        const startX = e.clientX;
        const currentWidth = columnWidths[colKey] || 200;

        const mouseMoveHandler = (moveEvent) => {
            const widthChange = moveEvent.clientX - startX;
            // Limit minimum column width to prevent collapse
            const newWidth = Math.max(50, currentWidth + widthChange);

            setColumnWidths(prev => ({
                ...prev,
                [colKey]: newWidth
            }));
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    }, [columnWidths, setColumnWidths]);

    // Convert column keys to display names
    const displayColumns = columns.map(field => ({
        key: field,
        title: field.toUpperCase().replace(/_/g, ' ')
    }));

    // Special handling for Audit Logs which use static titles that match the keys in initialColumnWidths
    const isAuditLogHeader = columns.some(c => ['Action', 'User', 'Table', 'Record ID', 'Timestamp'].includes(c));

    return (
        <thead className="bg-[#F4F6F8]">
            <tr>
                {displayColumns.map(({ key, title }) => (
                    <th
                        key={key}
                        // Use key directly for width lookups
                        style={{ width: columnWidths[key] || 'auto', minWidth: 50 }}
                        className="relative px-4 py-3 text-left text-xs font-medium text-[#575757] uppercase tracking-wider group"
                    >
                        <div className="flex items-center justify-between h-full">
                            {title}

                            {/* Resizer Handle */}
                            <div
                                className="absolute top-0 right-0 w-2 h-full cursor-col-resize opacity-0 group-hover:opacity-100 bg-[#C7C7C7] hover:bg-[#0071B8] transition-opacity"
                                onMouseDown={(e) => startResizing(e, key)}
                                title="Drag to resize column"
                            />
                        </div>
                    </th>
                ))}
                {/* Fixed Action/Details column only for data tables */}
                {!isAuditLogHeader && (
                    <th style={{ width: 120, minWidth: 120 }} className="px-4 py-3 text-center text-xs font-medium text-[#575757] uppercase tracking-wider">
                        {actionColumnTitle}
                    </th>
                )}
            </tr>
        </thead>
    );
};

export default ResizableTableHeader;

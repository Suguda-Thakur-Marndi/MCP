"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { EmptyState, LoadingState } from "./FeedbackStates";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  totalItems,
  pageSize = 10,
  currentPage = 1,
  onPageChange,
  emptyTitle = "No records found",
  emptyMessage = "No security data available in this view.",
  onRowClick,
  className = "",
}: {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  totalItems?: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[sortKey];
      const valB = (b as Record<string, unknown>)[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      return sortDirection === "asc" ? 1 : -1;
    });
  }, [data, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil((totalItems ?? data.length) / pageSize));

  return (
    <div className={`rounded-lg border border-[#D1CEC7] dark:border-[#243044] bg-[#FFFFFF] dark:bg-[#111827] overflow-hidden flex flex-col shadow-xs ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#1E1E1E] dark:text-slate-300 border-collapse">
          <thead className="bg-[#EAE7E1] dark:bg-[#1A2332] text-[#4A4A4A] dark:text-slate-400 uppercase text-[11px] font-semibold tracking-wider sticky top-0 border-b border-[#D1CEC7] dark:border-[#243044] z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-4 py-3 whitespace-nowrap ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.sortable ? "cursor-pointer select-none hover:text-[#1E1E1E] dark:hover:text-slate-200" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      <span className="text-[#D95E00] dark:text-sky-400">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DFDA] dark:divide-[#243044]/60">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <LoadingState message="Fetching security records..." />
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} message={emptyMessage} />
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={(row as { id?: string | number; ticket_id?: string }).ticket_id || (row as { id?: string | number }).id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors duration-150 ${
                    onRowClick ? "cursor-pointer hover:bg-[#F5F4F0] dark:hover:bg-slate-800/60" : "hover:bg-[#F5F4F0]/60 dark:hover:bg-slate-800/30"
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 whitespace-nowrap text-xs ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#EAE7E1] dark:bg-[#0F172A] border-t border-[#D1CEC7] dark:border-[#243044] text-xs text-[#4A4A4A] dark:text-slate-400">
          <div className="font-mono text-[11px]">
            Page <span className="font-bold text-[#1E1E1E] dark:text-slate-200">{currentPage}</span> of{" "}
            <span className="font-bold text-[#1E1E1E] dark:text-slate-200">{totalPages}</span>
            {totalItems !== undefined && (
              <span className="ml-2 text-[#7A7670] dark:text-slate-500">({totalItems} total records)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded bg-[#E2DFDA] dark:bg-slate-800 border border-[#D1CEC7] dark:border-slate-700 text-[#1E1E1E] dark:text-slate-300 hover:bg-[#D1CEC7] dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded bg-[#E2DFDA] dark:bg-slate-800 border border-[#D1CEC7] dark:border-slate-700 text-[#1E1E1E] dark:text-slate-300 hover:bg-[#D1CEC7] dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

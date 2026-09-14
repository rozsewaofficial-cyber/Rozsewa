import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The pager under an admin table.
 *
 * Every table it sits under is showing one page of a larger set, so it is told
 * how many rows matched rather than counting the ones it can see — a pager that
 * measures its own page always reports exactly one page.
 */
const TablePager = ({ page, total, perPage, onPage, noun = "records" }) => {
    const pages = Math.ceil((total || 0) / perPage);
    if (pages <= 1) return null;

    const first = ((page - 1) * perPage) + 1;
    const last = Math.min(page * perPage, total);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Showing <span className="text-gray-900 font-black">{first}</span>–
                <span className="text-gray-900 font-black">{last}</span> of{" "}
                <span className="text-gray-900 font-black">{total.toLocaleString("en-IN")}</span> {noun}
            </p>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-bold text-gray-500 px-1">
                    Page {page} of {pages}
                </span>
                <button
                    onClick={() => onPage(Math.min(pages, page + 1))}
                    disabled={page === pages}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default TablePager;

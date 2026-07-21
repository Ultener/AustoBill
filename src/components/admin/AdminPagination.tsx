type AdminPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ page, totalPages, total, pageSize, onPageChange }: AdminPaginationProps) {
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const showDots = totalPages <= 8;

  return (
    <nav className="admin-pagination" aria-label="Навигация по страницам">
      <div className="admin-pagination__info">
        <span className="admin-pagination__pages">
          {from}–{to} из {total}
        </span>
        <span className="admin-pagination__meta">
          Страница {page} / {totalPages}
        </span>
      </div>
      {showDots ? (
        <div className="admin-pagination__dots" aria-hidden>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              className={`admin-pagination__dot${p === page ? ' admin-pagination__dot--active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-label={`Страница ${p}`}
              aria-current={p === page ? 'page' : undefined}
            />
          ))}
        </div>
      ) : null}
      <div className="admin-pagination__nav">
        <button
          type="button"
          className="admin-pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <i className="fas fa-chevron-left" /> Назад
        </button>
        <button
          type="button"
          className="admin-pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд <i className="fas fa-chevron-right" />
        </button>
      </div>
    </nav>
  );
}

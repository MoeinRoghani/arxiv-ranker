interface Props {
  tiers: string[];
  activeTier: string | null;
  onTierChange: (tier: string | null) => void;
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  sort: 'newest' | 'oldest' | 'most_papers' | 'most_landmarks';
  onSortChange: (sort: 'newest' | 'oldest' | 'most_papers' | 'most_landmarks') => void;
}

export default function FilterBar({
  tiers, activeTier, onTierChange,
  categories, activeCategory, onCategoryChange,
  sort, onSortChange,
}: Props) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <button
          className={`filter-chip ${activeTier === null ? 'active' : ''}`}
          onClick={() => onTierChange(null)}
        >
          All tiers
        </button>
        {tiers.map(t => (
          <button
            key={t}
            className={`filter-chip ${activeTier === t ? 'active' : ''}`}
            onClick={() => onTierChange(activeTier === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="filter-group">
        <button
          className={`filter-chip ${activeCategory === null ? 'active' : ''}`}
          onClick={() => onCategoryChange(null)}
        >
          All categories
        </button>
        {categories.map(c => (
          <button
            key={c}
            className={`filter-chip ${activeCategory === c ? 'active' : ''}`}
            onClick={() => onCategoryChange(activeCategory === c ? null : c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="filter-group">
        <select
          className="filter-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Props['sort'])}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="most_papers">Most papers</option>
          <option value="most_landmarks">Most landmarks</option>
        </select>
      </div>
    </div>
  );
}

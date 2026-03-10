import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '../components/Select';

const dayOptions = [7, 30, 90, 180];
const timeRangeOptions = dayOptions.map((days) => ({
  value: days,
  label: `Last ${days} days`
}));

function formatTimestamp(value) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function formatSectionLabel(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function TrendChart({ points }) {
  const width = 640;
  const height = 220;
  const maxValue = Math.max(...points.map((point) => point.events), 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const polyline = points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - (point.events / maxValue) * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="analytics-trend-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-trend-chart" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height - ratio * (height - 24) - 12}
            y2={height - ratio * (height - 24) - 12}
            className="analytics-grid-line"
          />
        ))}
        <polyline points={polyline} fill="none" className="analytics-trend-line" />
        {points.map((point, index) => {
          const x = index * stepX;
          const y = height - (point.events / maxValue) * (height - 24) - 12;
          return <circle key={`${point.day}-${index}`} cx={x} cy={y} r="4" className="analytics-trend-dot" />;
        })}
      </svg>
      <div className="analytics-trend-labels">
        {points.map((point) => (
          <span key={point.day}>{formatDate(point.day)}</span>
        ))}
      </div>
    </div>
  );
}

export default function Analytics({
  onQueryAdminAnalytics,
  onGetParquetDatasets,
  onDownloadParquetDataset
}) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ days: 30, section: '', tag: '' });
  const [parquetDatasets, setParquetDatasets] = useState([]);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadingKey, setDownloadingKey] = useState('');

  useEffect(() => {
    async function refreshForFilters() {
      setLoading(true);
      const result = await onQueryAdminAnalytics(filters);
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      setError('');
      setReport(result.data);
      setLoading(false);
    }
    refreshForFilters();
  }, [filters, onQueryAdminAnalytics]);

  useEffect(() => {
    async function loadParquetDatasets() {
      const parquetResult = await onGetParquetDatasets();
      if (parquetResult.ok) {
        setParquetDatasets(parquetResult.datasets || []);
      } else if (parquetResult.message) {
        setDownloadMessage(parquetResult.message);
      }
    }
    loadParquetDatasets();
  }, [onGetParquetDatasets]);

  const latestLeaderboard = useMemo(() => report?.dailyLeaderboard || [], [report]);
  const sectionOptions = useMemo(
    () => {
      const availableSections = report?.availableFilters?.sections || [];
      return [{ value: '', label: 'All sections' }, ...availableSections.map((section) => ({
        value: section,
        label: formatSectionLabel(section)
      }))];
    },
    [report]
  );
  const tagOptions = useMemo(
    () => {
      const availableTags = report?.availableFilters?.tags || [];
      return [{ value: '', label: 'All tags' }, ...availableTags.map((tag) => ({
        value: tag,
        label: `#${tag}`
      }))];
    },
    [report]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ days: 30, section: '', tag: '' });
  };

  const downloadDataset = async (datasetKey) => {
    setDownloadMessage('');
    setDownloadingKey(datasetKey);
    const result = await onDownloadParquetDataset(datasetKey);
    setDownloadingKey('');
    if (!result.ok) {
      setDownloadMessage(result.message);
      return;
    }
    setDownloadMessage(`Downloaded ${datasetKey}.parquet`);
  };

  return (
    <div className="container page-shell analytics-page">
      <section className="panel">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <p className="type-kicker mb-2">Admin</p>
            <h2 className="mb-1 type-title-md">DuckDB Analytics</h2>
            <p className="type-body mb-0">Real-time filtered analytics across PostgreSQL and MongoDB snapshots, plus Parquet exports.</p>
          </div>
          <Link to="/forum" className="forum-secondary-btn text-decoration-none">Back to Forum</Link>
        </div>

        <section className="settings-card mb-4">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
            <div>
              <h4 className="mb-1">Live Filters</h4>
              <p className="muted mb-0">Change time range, section, or tag to rerun DuckDB queries and refresh the entire dashboard.</p>
            </div>
            <button type="button" className="forum-secondary-btn" onClick={resetFilters}>Reset</button>
          </div>
          <div className="analytics-filter-grid">
            <label className="analytics-filter-field">
              <span>Time Range</span>
              <Select
                options={timeRangeOptions}
                value={filters.days}
                onChange={(nextValue) => updateFilter('days', Number(nextValue))}
              />
            </label>
            <label className="analytics-filter-field">
              <span>Section</span>
              <Select
                options={sectionOptions}
                value={filters.section}
                onChange={(nextValue) => updateFilter('section', nextValue)}
              />
            </label>
            <label className="analytics-filter-field">
              <span>Tag</span>
              <Select
                options={tagOptions}
                value={filters.tag}
                onChange={(nextValue) => updateFilter('tag', nextValue)}
              />
            </label>
          </div>
        </section>

        {error && <div className="settings-alert is-error mb-3">{error}</div>}
        {loading && <p className="muted mb-3">Refreshing analytics...</p>}

        {report && (
          <>
            <div className="analytics-grid mb-4">
              <div className="settings-card">
                <h4 className="mb-2">Users</h4>
                <p className="analytics-value mb-0">{report.overview.total_users || 0}</p>
              </div>
              <div className="settings-card">
                <h4 className="mb-2">Posts</h4>
                <p className="analytics-value mb-0">{report.overview.total_posts || 0}</p>
              </div>
              <div className="settings-card">
                <h4 className="mb-2">Moderated</h4>
                <p className="analytics-value mb-0">{report.overview.moderated_posts || 0}</p>
              </div>
              <div className="settings-card">
                <h4 className="mb-2">Tracked Events</h4>
                <p className="analytics-value mb-0">{report.overview.tracked_events || 0}</p>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-xl-7">
                <section className="settings-card h-100">
                  <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
                    <div>
                      <h4 className="mb-1">Author Leaderboard</h4>
                      <p className="muted mb-0">Recomputed from the active filter scope instead of a fixed daily snapshot.</p>
                    </div>
                    <span className="forum-tag">{latestLeaderboard.length} ranked</span>
                  </div>
                  <div className="analytics-leaderboard">
                    {latestLeaderboard.map((item) => (
                      <div key={`${item.author_name}-${item.rank}`} className="analytics-leaderboard-row">
                        <span className="analytics-rank">#{item.rank}</span>
                        <div className="analytics-leaderboard-copy">
                          <strong>{item.author_name}</strong>
                          <span className="muted">{item.post_count} posts · {item.moderated_count} moderated</span>
                        </div>
                        <span className="analytics-score">{item.score}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-xl-5">
                <section className="settings-card h-100">
                  <h4 className="mb-3">Hot Tags</h4>
                  <div className="analytics-bars">
                    {report.topTags.map((item) => {
                      const width = `${Math.max((item.post_count / Math.max(report.topTags[0]?.post_count || 1, 1)) * 100, 8)}%`;
                      return (
                        <div key={item.tag_name} className="analytics-bar-row">
                          <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                            <strong>#{item.tag_name}</strong>
                            <span className="muted">{item.post_count} posts</span>
                          </div>
                          <div className="analytics-bar-track">
                            <div className="analytics-bar-fill" style={{ width }} />
                          </div>
                          <div className="analytics-bar-meta">
                            <span>Live {item.live_post_count}</span>
                            <span>Moderated {item.moderated_post_count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="col-12">
                <section className="settings-card">
                  <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
                    <div>
                      <h4 className="mb-1">User Activity Trend</h4>
                      <p className="muted mb-0">Time-filtered event counts and distinct active users from MongoDB logs.</p>
                    </div>
                    <span className="forum-tag">Last {filters.days} days</span>
                  </div>
                  {report.activityTrend.length > 0 && <TrendChart points={report.activityTrend} />}
                  <div className="analytics-list mt-3">
                    {report.activityTrend.map((item) => (
                      <div key={item.day} className="analytics-list-row">
                        <span>{formatDate(item.day)}</span>
                        <span>{item.events} events · {item.active_users} active users</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-lg-6">
                <section className="settings-card h-100">
                  <h4 className="mb-3">Posts By Section</h4>
                  <div className="analytics-list">
                    {report.sections.map((item) => (
                      <div key={item.section} className="analytics-list-row">
                        <span>{formatSectionLabel(item.section)}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-lg-6">
                <section className="settings-card h-100">
                  <h4 className="mb-3">Activity Types</h4>
                  <div className="analytics-list">
                    {report.activityTypes.map((item) => (
                      <div key={item.type} className="analytics-list-row">
                        <span>{item.type}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-lg-6">
                <section className="settings-card h-100">
                  <h4 className="mb-3">Top Authors</h4>
                  <div className="analytics-list">
                    {report.authors.map((item) => (
                      <div key={`${item.author_email}-${item.author_name}`} className="analytics-list-row">
                        <span>{item.author_name}</span>
                        <span>{item.post_count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-lg-6">
                <section className="settings-card h-100">
                  <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
                    <div>
                      <h4 className="mb-1">Parquet Exports</h4>
                      <p className="muted mb-0">Download DuckDB snapshots and summary datasets as Parquet for local analysis.</p>
                    </div>
                    <span className="forum-tag">{parquetDatasets.length} datasets</span>
                  </div>
                  {downloadMessage && <p className="muted mb-3">{downloadMessage}</p>}
                  <div className="analytics-export-grid">
                    {parquetDatasets.map((dataset) => (
                      <button
                        key={dataset.key}
                        type="button"
                        className="forum-secondary-btn analytics-export-btn"
                        onClick={() => downloadDataset(dataset.key)}
                        disabled={downloadingKey === dataset.key}
                        title={dataset.fileName}
                      >
                        <strong>{dataset.key}</strong>
                        <span title={dataset.fileName}>{dataset.fileName}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="col-lg-6">
                <section className="settings-card h-100">
                  <h4 className="mb-3">Moderation Snapshot</h4>
                  <div className="analytics-list">
                    {report.moderation.map((item) => (
                      <div key={`${item.title}-${item.deleted_by_admin_at || item.author_name}`} className="analytics-list-block">
                        <strong>{item.title}</strong>
                        <span className="muted">{item.author_name}</span>
                        <span className="muted">{item.deleted_reason || 'No reason provided.'}</span>
                        <span className="muted">Removed: {formatTimestamp(item.deleted_by_admin_at)}</span>
                        <span className="muted">Appeal: {formatTimestamp(item.appeal_requested_at)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

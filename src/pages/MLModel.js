import React, { useState, useRef, useEffect } from 'react';
import { Form, Card } from 'react-bootstrap';

// Demo components
const LogisticRegressionDemo = () => <p>Logistic Regression Demo Placeholder</p>;
const KMeansDemo = () => <p>K-Means Clustering Demo Placeholder</p>;

const mlModels = [
  { name: 'Logistic Regression', component: <LogisticRegressionDemo /> },
  { name: 'K-Means Clustering', component: <KMeansDemo /> },
];

export default function MLModel() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  const filtered = mlModels.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="container mt-5 pt-5">
      <h2>Machine Learning Demos</h2>

      {/* Custom dropdown with search */}
      <div ref={dropdownRef} style={{ maxWidth: '400px' }} className="position-relative mb-4">
        <button
          className="btn btn-outline-primary w-100 text-start"
          onClick={() => setOpen(!open)}
        >
          {selected?.name || 'Select a Demo'}
        </button>

        {open && (
          <div className="border position-absolute bg-white w-100 shadow mt-1 z-1" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <Form.Control
              type="text"
              placeholder="Search demos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border-bottom"
            />
            <ul className="list-group list-group-flush">
              {filtered.map((item, idx) => (
                <li
                  key={idx}
                  className="list-group-item list-group-item-action"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelected(item);
                    setOpen(false);
                    setSearch(''); // clear search on select
                  }}
                >
                  {item.name}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="list-group-item text-muted">No results</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Render selected demo */}
      <div>
        {selected ? (
          <Card className="p-3">
            <h5>{selected.name}</h5>
            {selected.component}
          </Card>
        ) : (
          <p>Select a demo from the dropdown above.</p>
        )}
      </div>
    </div>
  );
}
